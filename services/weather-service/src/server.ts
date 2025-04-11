import dotenv from 'dotenv';
import pino from 'pino';
import fs from 'fs';
import { z } from 'zod';
import axios from 'axios';
import https from 'https';
import IORedis, { RedisOptions } from 'ioredis';
import { Kafka, logLevel, Producer } from 'kafkajs';
import { WeatherData } from './interfaces/weatherData';
import { WeatherApiResponse, Hour } from './interfaces/weather';
import { WeatherApiSchema } from './schemas/weather.schema';
import { formatIST } from './utils/time';
import { WeatherResult } from './interfaces/weatherResult';
import { LocationSchema } from './interfaces/location';
import { getCurrentHourForecast } from './utils/currentData';

const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 10,
});
const axiosClient = axios.create({
    timeout: 10000,
    httpsAgent
});
// -------------------------------------------------
// Circuit Breaker (Weather API)
// -------------------------------------------------
let consecutiveFailures = 0;
let breakerOpenUntil = 0;

const FAILURE_THRESHOLD = 3;   // open breaker after 3 consecutive failures
const COOLDOWN_MS = 60_000;    // 1 minute cooldown



// -------------------------------------------------
// Load & validate environment variables
// -------------------------------------------------
dotenv.config();

const envSchema = z.object({
    KAFKA_BROKER_ADDRESS: z.string().min(1),
    WEATHER_API_KEY: z.string().min(1),
    NODE_ENV: z.enum(['development', 'production']).default('production')
});

type Env = z.infer<typeof envSchema>;

const env = envSchema.parse(process.env);

// -------------------------------------------------
// Logger (structured, level‑aware)
// -------------------------------------------------
const logger = pino({
    level: env.NODE_ENV === 'development' ? 'debug' : 'info',
    base: { pid: process.pid },
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'yyyy-mm-dd HH:MM:ss',
                ignore: 'pid,hostname',
            },
        }
        : undefined,
});
logger.info(env.NODE_ENV, logger.level);

logger.info({
    kafka: process.env.KAFKA_BROKER_ADDRESS,
    valkey: process.env.VALKEY_HOST,
    nodeEnv: env.NODE_ENV,
}, 'Runtime configuration');


function getValkeyPassword() {
    if (process.env.VALKEY_PASSWORD) {
        return process.env.VALKEY_PASSWORD;
    }

    if (process.env.VALKEY_PASSWORD_FILE) {
        try {
            return fs
                .readFileSync(process.env.VALKEY_PASSWORD_FILE, 'utf8')
                .trim();
        } catch (err) {
            logger.warn('Failed to read Valkey password from secret file');
        }
    }

    return undefined;
}


// -------------------------------------------------
// Valkey connection - In-memory cache
// -------------------------------------------------
let isShuttingDown = false;
const redisOpts: RedisOptions = {
    host: process.env.VALKEY_HOST || 'valkey',
    port: Number(process.env.VALKEY_PORT) || 6379,
    password: getValkeyPassword(),
    retryStrategy: () => {
        if (isShuttingDown) {
            return null;
        }
        return 5000; // best-effort cache retry

    },
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
};
const redis = new IORedis(redisOpts);
let isCacheAvailable = false;

redis.on('connect', () => {
    if (!isCacheAvailable) {
        isCacheAvailable = true;
        logger.info('Valkey connected');
    }
});

redis.on('error', (err) => {
    if (isCacheAvailable) {
        isCacheAvailable = false;
        logger.warn(
            { err: err.message },
            'Valkey unavailable, running without cache'
        );
    }
});

redis.on('close', () => {
    if (isCacheAvailable) {
        isCacheAvailable = false;
        logger.warn('Valkey connection closed');
    }
});


// -------------------------------------------------
// Kafka connection
// -------------------------------------------------
const kafka = new Kafka({
    clientId: 'weather-service',
    brokers: [process.env.KAFKA_BROKER_ADDRESS || 'kafka:9092'],
    logLevel: logLevel.NOTHING,
    connectionTimeout: 10000,
    authenticationTimeout: 10000
});

const producer: Producer = kafka.producer({
    idempotent: true, // enable idempotence for safe retries
    retry: {
        initialRetryTime: 300,      // ms, flat delay for 1st retry [page:1]
        retries: 20,                // Finite limit prevents infinite hangs
        factor: 0.2,                // Randomization factor (±20%) [page:1]
        multiplier: 2,              // Exponential growth multiplier [page:1]
        maxRetryTime: 30000,        // Cap total retry window at 30s
    },
    maxInFlightRequests: 5,       // Limit parallelism during retries
});

const consumer = kafka.consumer({
    groupId: 'weather-group',
});

let kafkaAvailable = false;
let kafkaStarting = false;

async function initKafkaSafely() {
    if (kafkaStarting) return;
    kafkaStarting = true;

    for (; ;) {
        try {
            await producer.connect();
            await consumer.connect();

            await consumer.subscribe({
                topic: 'weather.service.command.fetch',
                fromBeginning: false,
            });

            await consumer.run({
                eachMessage: async ({ topic, message }) => {
                    try {
                        if (!kafkaAvailable) {
                            kafkaAvailable = true;
                            logger.info('Kafka recovered');
                        }

                        // existing logic
                        const key = message.key?.toString();
                        const value = message.value?.toString();

                        logger.debug({ topic, value }, 'Received Data from kafka');

                        // Process the request
                        if (value) {
                            const raw = JSON.parse(value);

                            const result = LocationSchema.safeParse(raw.data);

                            logger.info({ result }, 'Consumed message');

                            const city = result.data?.city;
                            if (city) {
                                const response = await ws.getData(city);

                                try {
                                    if (!kafkaAvailable) {
                                        logger.warn('Kafka unavailable, skipping publish');
                                        return;
                                    }

                                    // Send to Kafka
                                    await producer.send({
                                        topic: 'weather.service.event.updated',
                                        messages: [{ value: JSON.stringify(response) }]
                                    });

                                    if (!kafkaAvailable) {
                                        kafkaAvailable = true;
                                        logger.info('Kafka recovered');
                                    }

                                    logger.info('Data sent to Kafka');
                                } catch (err) {
                                    kafkaAvailable = false; // set Kafka unavailable

                                    logger.warn(
                                        { err: (err as Error).message },
                                        'Kafka publish failed, marking Kafka unavailable'
                                    );
                                }
                            }
                        }
                    } catch (err) {
                        logger.error(
                            {
                                err,
                                topic,
                                value: message.value?.toString(),
                            },
                            'Unhandled error while processing Kafka message'
                        );
                    }
                },
            });

            kafkaAvailable = true;
            logger.info('Kafka connected');
            return;
        } catch (err) {
            kafkaAvailable = false;
            logger.warn(
                { err: (err as Error).message },
                'Kafka unavailable, retrying in 10s'
            );

            await new Promise(res => setTimeout(res, 10_000));
        }
    }
}
initKafkaSafely();



// -------------------------------------------------
// Weather Service
// -------------------------------------------------
class WeatherService {

    createResponse(city: string, data: WeatherApiResponse | Hour): WeatherData {
        const source = 'current' in data ? data.current : data;
        return {
            city,
            temperatureC: source.temp_c,
            temperatureF: source.temp_f,
            feelslikeC: source.feelslike_c,
            condition: source.condition.text,
            humidity: source.humidity,
            windMph: source.wind_mph,
            windKph: source.wind_kph,
            windDegree: source.wind_degree,
            windDir: source.wind_dir,
            icon: source.condition.icon,
            pressureMb: source.pressure_mb,
            visibilityKm: source.vis_km,
            airQuality: source.air_quality,
            lastUpdated:
                'current' in data
                    ? data.current.last_updated
                    : data.time,
            fetchedAt: Date.now(),
        };
    }

    async getData(city: string): Promise<WeatherResult> {
        const eventTimestamp = Date.now();
        const cacheKey = `weather:${city}`;

        // Cache first (best effort)
        if (isCacheAvailable) {
            try {
                // Get cached data from Valkey
                const cached = await redis.get(cacheKey);
                if (cached) {
                    let data = JSON.parse(cached);
                    const hourData = getCurrentHourForecast(data);
                    logger.debug(`hourData:${JSON.stringify(hourData)}`);
                    logger.info({ city }, 'Weather cache hit');
                    return {
                        status: 'success',
                        source: 'cache',
                        data: this.createResponse(city, hourData),
                        timestamp: eventTimestamp
                    };
                }
            } catch (err) {
                logger.warn({ err }, 'Cache read failed, falling back to API');
            }

        }

        logger.info(`${city} fetching from external api`);
        const data = await this.fetchWeather(cacheKey, city, eventTimestamp);
        return data;
    }

    async fetchWeather(cacheKey: string, city: string, eventTimestamp: number): Promise<WeatherResult> {

        // -------------------------------------------------
        // CIRCUIT BREAKER GUARD (BEFORE API CALL)
        // -------------------------------------------------
        const now = Date.now();

        if (breakerOpenUntil > now) {
            logger.warn(
                { openUntil: formatIST(breakerOpenUntil) },
                'Circuit breaker open, skipping WeatherAPI call'
            );
            return {
                status: 'unavailable',
                reason: 'circuit_open',
                timestamp: eventTimestamp,
            };
        }

        try {
            // Call external API
            const url = 'https://api.weatherapi.com/v1/forecast.json';

            const response = await axiosClient.get(url, {
                params: {
                    q: city,
                    days: 1,
                    aqi: 'yes',
                    alerts: 'yes',
                    key: process.env.WEATHER_API_KEY,
                },
            });

            // Runtime validation
            const parsed = WeatherApiSchema.safeParse(response.data);
            logger.info(parsed)

            if (!parsed.success) {
                logger.error(
                    { issues: parsed.error.issues },
                    'Weather API schema mismatch'
                );
                throw new Error('Invalid Weather API response');
            }

            // -------------------------------------------------
            // CIRCUIT BREAKER RESET (SUCCESS)
            // -------------------------------------------------
            consecutiveFailures = 0;
            breakerOpenUntil = 0;

            const weather = parsed.data;

            // Cache write (best effort)
            if (isCacheAvailable && !isShuttingDown) {
                const now = Date.now();
                const ttlSeconds = 6 * 60 * 60; // 21600 seconds
                await redis.set(
                    cacheKey,
                    JSON.stringify(weather),
                    'EX',
                    ttlSeconds
                );
                logger.debug(`${city} stored to cache with ttl:${ttlSeconds} at ${now}`)
            }

            return {
                status: 'success',
                source: 'api',
                data: this.createResponse(city, weather),
                timestamp: eventTimestamp,
            };
        } catch (err: any) {

            // -------------------------------------------------
            // CIRCUIT BREAKER FAILURE COUNT
            // -------------------------------------------------
            consecutiveFailures++;

            if (consecutiveFailures >= FAILURE_THRESHOLD) {
                breakerOpenUntil = Date.now() + COOLDOWN_MS;

                logger.error(
                    {
                        failures: consecutiveFailures,
                        cooldownMs: COOLDOWN_MS,
                    },
                    'Circuit breaker opened for WeatherAPI'
                );
            }

            // Error classification
            if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
                logger.warn('Weather API request timed out');
            } else {
                logger.error(
                    { message: err.message, code: err.code },
                    'Weather API request failed'
                );
            }
            return {
                status: 'unavailable',
                reason:
                    err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED'
                        ? 'timeout'
                        : 'api_error',
                timestamp: eventTimestamp,
            };

        }
    }


}


// -------------------------------------------------
// Service Instance
// -------------------------------------------------
const ws = new WeatherService();


// -------------------------------------------------
// Shutdown handling
// -------------------------------------------------
async function shutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    try {

        logger.info('Destroying HTTP agent...');
        httpsAgent.destroy();

        logger.info('Closing Valkey connection...');
        redis.disconnect(); // force close (no await)
        logger.info('Valkey disconnected');

        try {
            logger.info('Disconnecting Kafka producer and consumer...');
            await producer.disconnect();
            await consumer.disconnect();
        } catch (err) {
            logger.warn({ err }, 'Error while disconnecting Kafka producer');
        }

        setTimeout(() => process.exit(0), 3000);

    } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
    }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
