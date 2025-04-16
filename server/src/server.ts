import dotenv from 'dotenv';
import http from 'http';
import express from 'express';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { Kafka, logLevel, Producer } from 'kafkajs';
import pino from 'pino';
import { z } from 'zod';
import { Location } from './interfaces/location';
import { sendLocationIfChanged } from './sendLocation';
import IORedis, { RedisOptions } from 'ioredis';
import { initWeatherConsumer } from './modules/weatherConsumer';
import { initCryptoConsumer } from './modules/cryptoConsumer';
import { cacheGet } from './cache';

export const CRYPTO_MOVERS_CACHE_KEY = 'crypto:top-movers';

// -------------------------------------------------
// Load & validate environment variables
// -------------------------------------------------
dotenv.config();

const envSchema = z.object({
    KAFKA_BROKER_ADDRESS: z.string().min(1),
    FRONTEND_URL: z.string().url(),
    SERVER_PORT: z.string().regex(/^\d+$/),
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
// Kafka connection
// -------------------------------------------------
const kafka = new Kafka({
    clientId: 'realtime-dashboard',
    brokers: [process.env.KAFKA_BROKER_ADDRESS || 'kafka:9092'],
    logLevel: logLevel.ERROR
});
let kafkaReady = false;
const producer = kafka.producer({
    idempotent: true,   // Enables idempotence
});
let weatherConsumer: any;
let cryptoConsumer: any;

let didInitialRefresh = false;

// Helper to (re)connect the producer with retry logic
async function initProducer() {

    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await producer.connect();
            // Start domain-specific consumers
            if (weatherConsumer) await weatherConsumer.disconnect();
            if (cryptoConsumer) await cryptoConsumer.disconnect();

            weatherConsumer = await initWeatherConsumer(kafka, io, logger);
            cryptoConsumer = await initCryptoConsumer(kafka, io, logger);

            kafkaReady = true;
            logger.info('Kafka producer connected');

            if (!didInitialRefresh) {
                // Refresh crypto data on BFF startup
                await sendCryptoMoversRefresh(producer, logger);
                didInitialRefresh = true;
            }
            break;
        } catch (err) {
            kafkaReady = false;
            logger.error({ err, attempt }, 'Kafka producer connection failed');
            if (attempt === maxAttempts) throw err;
            await new Promise(res => setTimeout(res, 2 ** attempt * 1000)); // exponential back‑off
        }
    }
}

async function sendCryptoMoversRefresh(producer: Producer, logger: pino.Logger) {
    const payload = {
        requestedBy: 'bff',
        reason: 'startup',
        timestamp: new Date().toISOString(),
    };

    await producer.send({
        topic: 'crypto.service.command.topmovers.refresh',
        messages: [
            {
                key: 'topmovers',
                value: JSON.stringify(payload),
            },
        ],
    });

    logger.info('Sent crypto movers refresh command');
}


// -------------------------------------------------
// Valkey connection - In-memory cache
// -------------------------------------------------
const redisOpts: RedisOptions = {
    host: process.env.VALKEY_HOST || '127.0.0.1',
    port: Number(process.env.VALKEY_PORT) || 6379,
    password: process.env.VALKEY_PASSWORD || undefined,
    retryStrategy: (times: any) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
};
const redis = new IORedis(redisOpts);
redis.on('connect', () => logger.info('✓ Valkey connected'));
redis.on('error', (err: any) => logger.error('Valkey error:', err));


// -------------------------------------------------
// HTTP Server
// -------------------------------------------------
const app = express();
app.set("trust proxy", true);

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL, // frontend URL origin
        methods: ["GET", "POST"],
        credentials: true
    }
});


// -------------------------------------------------
// Socket event handlers
// -------------------------------------------------
io.on('connection', (socket: Socket) => {
    logger.info({ socketId: socket.id }, 'Client connected');

    socket.on('getUserId', () => {
        const forwarded = socket.handshake.headers["x-forwarded-for"];
        const ip = forwarded?.toString().split(",")[0].trim() || socket.handshake.address;

        logger.debug({ socketId: socket.id, ip }, 'Client IP resolved');

        const uniqueId = uuidv4();
        socket.emit('userUniqueId', uniqueId);
    });

    // User joining event
    socket.on('userLocationUpdate', async (locationData: Location, userId: string) => {
        logger.debug({ socketId: socket.id, locationData, userId }, 'Location received');

        // 1) Derive city name (adjust according to your Location type)
        const cityName = locationData.city || 'Delhi';
        const weatherRoom = `weather.${cityName}`;
        logger.debug(`cityName:${cityName}, weatherRoom: ${weatherRoom}`);

        // 2) Join user to city-specific weather room
        socket.join(weatherRoom);
        logger.info({ socketId: socket.id, room: weatherRoom }, 'User joined weather room');

        // Join global crypto room
        socket.join('crypto.global');
        logger.info({ socketId: socket.id, room: 'crypto.global' }, 'User joined crypto global room');

        logger.debug({
            key: socket.id,
            value: JSON.stringify({
                event: 'locationUpdate',
                userId: userId,
                data: locationData,
                timestamp: new Date().toISOString()
            })
        });

        const payload = {
            event: 'locationUpdate',
            userId,
            data: locationData,
            timestamp: new Date().toISOString()
        };
        if (!kafkaReady) {
            logger.warn('Kafka unavailable Real-time updates temporarily unavailable');
            return;
        }
        await sendLocationIfChanged(redis, producer, socket, payload, logger);
    });

    // Crypto events
    socket.on('topMoversRequest', async () => {
        try {
            const cached = await cacheGet<any>(CRYPTO_MOVERS_CACHE_KEY);
            logger.debug('topMoversRequest::cached::::', cached)

            if (!cached) {
                if (!kafkaReady) {
                    socket.emit('topMoversResponse', {
                        status: 'loading',
                        message: 'Data will refresh when backend reconnects'
                    });
                    return;
                }
                // Get crypto data on first request if not cached
                await sendCryptoMoversRefresh(producer, logger);

                socket.emit('topMoversResponse', {
                    status: 'loading'
                });
                return;
            }

            socket.emit('topMoversResponse', {
                status: 'success',
                source: 'cache',
                data: cached
            });

        } catch (err) {
            socket.emit('topMoversResponse', {
                status: 'error',
                message: 'Failed to fetch top movers',
                error: (err as Error).message
            });
        }
    });


    socket.on('disconnect', (reason) => {
        logger.info({ socketId: socket.id, reason }, 'Client disconnected');
    });
});


// -------------------------------------------------
// Graceful shutdown handling
// -------------------------------------------------
async function shutdown(signal: string) {
    if(shuttingDown) {
        logger.warn(`Shutdown already in progress, ignoring ${signal}`);
        return;
    }
    shuttingDown = true;

    logger.info(`Received ${signal}. Shutting down gracefully...`);
    try {
        await io.close();
        logger.info('Socket.io closed');

        await server.close(() => {
            logger.info('HTTP server closed');
        });

        if (producer && kafkaReady) {
            await producer.disconnect();
            logger.info('Kafka producer disconnected');
        }
        if (weatherConsumer) {
            await weatherConsumer.disconnect();
            logger.info('Kafka weatherConsumer disconnected');
        }

        if (cryptoConsumer) {
            await cryptoConsumer.disconnect();
            logger.info('Kafka cryptoConsumer disconnected');
        }

        setTimeout(() => process.exit(0), 3000);
    } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
    }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));


// -------------------------------------------------
// Start the service
// -------------------------------------------------
let shuttingDown = false;

async function kafkaRecoveryLoop() {
    while (!shuttingDown) {
        if (!kafkaReady) {
            try {
                logger.info('Attempting Kafka reconnect...');
                await initProducer();
            } catch {
                logger.warn('Kafka still unavailable, retrying...');
            }
        }
        await new Promise(r => setTimeout(r, 10_000));
    }
}

(async () => {
    try {
        const PORT = Number(env.SERVER_PORT);
        server.listen(PORT, () => {
            logger.info(`Server running on http://localhost:${PORT}`);
        });
    } catch (err) {
        logger.fatal({ err }, 'Failed to start server');
        process.exit(1);
    }

    initProducer().catch(err => {
        logger.error({ err }, 'Kafka unavailable at startup, running in degraded mode');
    });

    // Background recovery loop (self-healing)
    kafkaRecoveryLoop();
})();
