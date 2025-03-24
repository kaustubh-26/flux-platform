import dotenv from 'dotenv';
import pino from 'pino';
import { z } from 'zod';
import axios from 'axios';
import https from 'https';
import IORedis, { RedisOptions } from 'ioredis';
import { WeatherData } from './interfaces/weatherData';
import { WeatherApiResponse } from './interfaces/weather';
import { WeatherApiSchema } from './schemas/weather.schema';

const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 10,
});
const axiosClient = axios.create({
    timeout: 10000,
    httpsAgent
});


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

// -------------------------------------------------
// Valkey connection - In-memory cache
// -------------------------------------------------
let isShuttingDown = false;
const redisOpts: RedisOptions = {
    host: process.env.VALKEY_HOST || '127.0.0.1',
    port: Number(process.env.VALKEY_PORT) || 6379,
    password: process.env.VALKEY_PASSWORD || undefined,
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
    isCacheAvailable = true;
    logger.info('✓ Valkey connected');
});

redis.on('error', (err) => {
    isCacheAvailable = false;
    logger.warn('Valkey unavailable, running without cache');
});

redis.on('close', () => {
    isCacheAvailable = false;
    logger.warn('Valkey connection closed');
});


// -------------------------------------------------
// Weather Service
// -------------------------------------------------
class WeatherService {

    async createResponse(city: string, data: WeatherApiResponse) {
        const weatherData: WeatherData = {
            city: city,
            temperature_c: data.current.temp_c,
            temperature_f: data.current.temp_f,
            condition: data.current.condition.text,
            humidity: data.current.humidity,
            wind_mph: data.current.wind_mph,
            wind_kph: data.current.wind_kph,
            wind_degree: data.current.wind_degree,
            wind_dir: data.current.wind_dir,
            icon: data.current.condition.icon,
            last_updated: data.current.last_updated,
            timestamp: Date.now()
        };
        return weatherData;
    }

    async getData(city: string) {
        const cacheKey = `weather:${city}`;

        if (isCacheAvailable) {
            try {
                // Get cached data from Valkey
                const lastSent = await redis.get(cacheKey);
                if (lastSent) {
                    let data = JSON.parse(lastSent);
                    logger.info(`${city} found in weather cache, getting data from cache`);
                    const weatherData = await this.createResponse(city, data);
                    return weatherData;
                }
            } catch (err) {
                logger.warn({ err }, 'Cache read failed, falling back to API');
            }

        }

        logger.info(`${city} fetching from external api`);
        const data = await this.fetchWeather(cacheKey, city);
        return data;
    }

    async fetchWeather(cacheKey: string, city: string) {
        if (isShuttingDown) {
            logger.error('Service is shutting down');
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

            // runtime validation
            const parsed = WeatherApiSchema.parse(response.data);

            if (!parsed?.current) {
                logger.error('Invalid weather API response');
            }

            if (isCacheAvailable && !isShuttingDown) {
                const now = Date.now();
                const ttlSeconds = 6 * 60 * 60; // 21600 seconds
                await redis.set(
                    cacheKey,
                    JSON.stringify(response.data),
                    'EX',
                    ttlSeconds
                );
                logger.info(`${city} stored to cache with ttl:${ttlSeconds} at ${now}`)
            }


            const weatherData = await this.createResponse(city, response.data);
            return weatherData;
        } catch (err: any) {
            if (axios.isCancel(err)) {
                logger.warn('Axios request cancelled due to shutdown');
                return null;
            }

            logger.error(
                {
                    message: err.message,
                    code: err.code
                },
                'Weather API request failed'
            );
            return null; // return null if failed

        }
    }


}


// -------------------------------------------------
// Fetch Data
// -------------------------------------------------
let poller: NodeJS.Timeout;

(async () => {
    const ws = new WeatherService();

    if (isCacheAvailable && !isShuttingDown) {
        // Clear cache
        const deleted = await redis.del('weather:Pune');
        logger.info(`Deleted keys: ${deleted}`);
    }
    let response = await ws.getData("Pune");
    logger.info({ response }, 'Successfully Fetched Weather Data');

    poller = setInterval(async () => {
        if (isShuttingDown) return;

        try {
            const response = await ws.getData("Pune");
            if (response) {
                logger.info({ response }, 'Successfully Fetched Weather Data');
            } else {
                logger.warn('No weather data this cycle');
            }
        } catch (err) {
            logger.error({ err }, 'Unexpected polling error');
        }
    }, 10000);
})();


// -------------------------------------------------
// Shutdown handling
// -------------------------------------------------
async function shutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    try {
        if (poller) {
            clearInterval(poller);
            logger.info('Poller stopped');
        }

        logger.info('Destroying HTTP agent...');
        httpsAgent.destroy();

        logger.info('Closing Valkey connection...');
        redis.disconnect(); // force close (no await)
        logger.info('Valkey disconnected');

        setTimeout(() => process.exit(0), 3000);

    } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
    }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
