import dotenv from 'dotenv';
import http from 'http';
import express from 'express';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { Consumer, Kafka, logLevel, Partitioners, Producer } from 'kafkajs';
import pino from 'pino';
import { z } from 'zod';
import { Location } from './interfaces/location';
import { sendLocationIfChanged } from './sendLocation';
import { initWeatherConsumer } from './modules/weatherConsumer';
import { initCryptoTopMoversConsumer } from './modules/cryptoTopMoversConsumer';
import { cacheGet, shutdownCache } from './cache';
import { initCryptoTickerConsumer } from './modules/cryptoTickerConsumer';
import { initCryptoTopCoinsConsumer } from './modules/cryptoTopCoinsConsumer';
import { initNewsConsumer } from './modules/newsConsumer';
import { CRYPTO_MOVERS_CACHE_KEY, CRYPTO_TOPCOINS_CACHE_KEY, CRYPTO_TICKER_CACHE_KEY } from './constants/crypto';
import { initStockTopPerformersConsumer } from './modules/stockTopPerformersConsumer';
import { STOCK_TOP_PERFORMERS_CACHE_KEY } from './constants/stocks';
import { NEWS_GLOBAL_CACHE_KEY } from './constants/news';

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
    logLevel: logLevel.NOTHING
});
let kafkaReady = false;
const producer = kafka.producer({
    idempotent: true,   // Enables idempotence
    createPartitioner: Partitioners.LegacyPartitioner,

});
let weatherConsumer: any;
let cryptoTopMoversConsumer: any;
let cryptoTopCoinsConsumer: any;
let cryptoTickerConsumer: Consumer;
let newsConsumer: Consumer;
let stocksConsumer: Consumer;

let didInitialRefresh = false;

// Helper to (re)connect the producer with retry logic
async function initProducer() {
    if (shuttingDown) {
        logger.info('Skipping Kafka init during shutdown');
        return;
    }

    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await producer.connect();
            // Start domain-specific consumers
            if (weatherConsumer) await weatherConsumer.disconnect();
            if (cryptoTopMoversConsumer) await cryptoTopMoversConsumer.disconnect();
            if (cryptoTopCoinsConsumer) await cryptoTopCoinsConsumer.disconnect();
            if (cryptoTickerConsumer) await cryptoTickerConsumer.disconnect();
            if (newsConsumer) await newsConsumer.disconnect();
            if (stocksConsumer) await stocksConsumer.disconnect();

            weatherConsumer = await initWeatherConsumer(kafka, io, logger);
            cryptoTopMoversConsumer = await initCryptoTopMoversConsumer(kafka, io, logger);
            cryptoTopCoinsConsumer = await initCryptoTopCoinsConsumer(kafka, io, logger);
            cryptoTickerConsumer = await initCryptoTickerConsumer(kafka, io, logger);
            newsConsumer = await initNewsConsumer(kafka, io, logger);
            stocksConsumer = await initStockTopPerformersConsumer(kafka, io, logger);


            kafkaReady = true;

            logger.info(
                {
                    kafkaReady,
                    consumers: {
                        weather: !!weatherConsumer,
                        topMovers: !!cryptoTopMoversConsumer,
                        topCoins: !!cryptoTopCoinsConsumer,
                        ticker: !!cryptoTickerConsumer,
                        news: !!newsConsumer,
                        stocks: !!stocksConsumer,
                    },
                },
                'Kafka subsystem ready'
            );

            logger.info('Kafka producer connected');

            if (!didInitialRefresh) {
                await new Promise(res => setTimeout(res, 5000)); // 5s minimum

                // Refresh crypto data on BFF startup
                await sendCryptoTopCoinsRefresh(producer, logger);
                await sendCryptoMoversRefresh(producer, logger);
                await sendStockTopPerformersRefresh(producer, logger);
                await sendTopNewsRefresh(producer, logger, "initial_refresh");
                didInitialRefresh = true;
            }
            break;
        } catch (err) {
            kafkaReady = false;
            logger.error({ attempt }, 'Kafka producer connection failed');
            if (attempt === maxAttempts) {
                logger.fatal('Kafka unavailable – shutting down');
                process.exit(1); // shutdown server - kafka is critical
            }
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
                key: 'cryptotopmovers',
                value: JSON.stringify(payload),
            },
        ],
    });

    logger.info('Sent crypto movers refresh command');
}

async function sendCryptoTopCoinsRefresh(producer: Producer, logger: pino.Logger) {
    const payload = {
        requestedBy: 'bff',
        reason: 'startup',
        timestamp: new Date().toISOString(),
    };

    await producer.send({
        topic: 'crypto.service.command.topcoins.refresh',
        messages: [
            {
                key: 'cryptotopcoins',
                value: JSON.stringify(payload),
            },
        ],
    });

    logger.info('Sent crypto top coins refresh command');
}

async function sendStockTopPerformersRefresh(producer: Producer, logger: pino.Logger) {
    const payload = {
        requestedBy: 'bff',
        reason: 'startup',
        timestamp: new Date().toISOString(),
    };

    await producer.send({
        topic: 'stock.service.command.topperformers.refresh',
        messages: [
            {
                key: 'stocktopperformers',
                value: JSON.stringify(payload),
            },
        ],
    });

    logger.info('Sent stock movers refresh command');
}
let topNewsRefreshInProgress = false;
async function sendTopNewsRefresh(producer: Producer, logger: pino.Logger, reason: string) {
    if (topNewsRefreshInProgress) {
        logger.debug({ reason }, "Top news refresh already in progress, skipping");
        return;
    }

    topNewsRefreshInProgress = true;
    try {
        const payload = {
            requestedBy: 'bff',
            reason,
            timestamp: new Date().toISOString(),
        };

        // Send to Kafka
        await producer.send({
            topic: 'news.service.command.refresh',
            messages: [{
                key: 'topglobalnews',
                value: JSON.stringify(payload)
            }]
        });
        logger.info('Sent top news refresh command');
    } finally {
        topNewsRefreshInProgress = false;
    }
}


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

        const cityName = locationData.city || 'Delhi';
        const weatherRoom = `weather.${cityName}`;
        logger.debug(`cityName:${cityName}, weatherRoom: ${weatherRoom}`);

        // Join user to city-specific weather room
        socket.join(weatherRoom);
        logger.info({ socketId: socket.id, room: weatherRoom }, 'User joined weather room');

        // Join global crypto room
        socket.join('crypto.global');
        logger.info({ socketId: socket.id, room: 'crypto.global' }, 'User joined crypto global room');

        // Join global news room
        const newsRoom = `news.global`;
        socket.join(newsRoom);
        logger.info({ socketId: socket.id, room: newsRoom }, 'User joined news room');

        // Join stock news room
        const stockRoom = `stock.global`;
        socket.join(stockRoom);
        logger.info({ socketId: socket.id, room: stockRoom }, 'User joined stock room');

        // Immediately hydrate the client with the latest cached news on room join.
        // This prevents race conditions where news updates are emitted
        // before the client joins the room and ensures fast initial render.
        const cached = await cacheGet(NEWS_GLOBAL_CACHE_KEY);
        if (cached) {
            socket.emit("newsUpdate", {
                status: "success",
                scope: "global",
                data: cached
            });
        }

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
        await sendLocationIfChanged(producer, socket, payload, logger, () => kafkaReady);
    });

    // Crypto events
    socket.on('cryptoTopMoversRequest', async () => {
        try {
            const cached = await cacheGet<any>(CRYPTO_MOVERS_CACHE_KEY);
            logger.debug('topMoversRequest::cached::::', cached)

            if (!cached) {
                socket.emit('cryptoTopMoversResponse', {
                    status: 'loading',
                    message: 'Data will refresh when backend reconnects'
                });
                await sendCryptoMoversRefresh(producer, logger);
                return;
            }

            socket.emit('cryptoTopMoversResponse', {
                status: 'success',
                source: 'cache',
                data: cached
            });

        } catch (err) {
            socket.emit('cryptoTopMoversResponse', {
                status: 'error',
                message: 'Failed to fetch top movers',
                error: (err as Error).message
            });
        }
    });

    socket.on('cryptoTopCoinsRequest', async () => {
        try {
            const cached = await cacheGet<any>(CRYPTO_TOPCOINS_CACHE_KEY);
            logger.debug('cryptoTopCoinsRequest::cached::::', cached)

            if (!cached) {
                socket.emit('stockTopPerformersResponse', {
                    status: 'loading',
                    message: 'Fetching latest stock data'
                });
                return;
            }

            socket.emit('cryptoTopCoinsResponse', {
                status: 'success',
                source: 'cache',
                data: cached
            });

        } catch (err) {
            socket.emit('cryptoTopCoinsResponse', {
                status: 'error',
                message: 'Failed to fetch crypto top coins',
                error: (err as Error).message
            });
        }
    });

    // Stock events
    socket.on('stockTopPerformersRequest', async (userId: string) => {
        try {
            const cached = await cacheGet<any>(STOCK_TOP_PERFORMERS_CACHE_KEY);
            logger.debug('stockTopPerformersRequest::cached:::: ', cached, new Date().toLocaleString())

            if (!cached) {
                socket.emit('stockTopPerformersResponse', {
                    status: 'loading',
                    message: 'Data will refresh when backend reconnects'
                });
                return;
            }

            socket.emit('stockTopPerformersResponse', {
                status: 'success',
                data: cached
            });

        } catch (err) {
            socket.emit('stockTopPerformersResponse', {
                status: 'error',
                message: 'Failed to fetch stocks top performers',
                error: (err as Error).message
            });
        }
    });

    // News events
    socket.on('topNewsRequest', async () => {
        try {
            const cached = await cacheGet<any[]>(NEWS_GLOBAL_CACHE_KEY);

            if (!cached) {
                await sendTopNewsRefresh(producer, logger, 'refresh_cache');
                socket.emit('newsUpdate', {
                    status: 'loading',
                    message: 'Fetching latest news'
                });
                return;
            }

            socket.emit('newsUpdate', {
                status: 'success',
                scope: 'global',
                data: cached
            });
        } catch (err) {
            socket.emit('newsUpdate', {
                status: 'error',
                message: 'Failed to fetch news',
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
    if (shuttingDown) {
        logger.warn(`Shutdown already in progress, ignoring ${signal}`);
        return;
    }
    shuttingDown = true;

    kafkaReady = false; // stop kafka reconnect loop


    logger.info(`Received ${signal}. Shutting down gracefully...`);
    try {
        await io.close();
        logger.info('Socket.io closed');

        await server.close(() => {
            logger.info('HTTP server closed');
        });

        shutdownCache();
        logger.info('Cache connection closed');

        if (cryptoTickerConsumer) {
            await cryptoTickerConsumer.stop();  // stop rejoin
            await cryptoTickerConsumer.disconnect();
            logger.info('Kafka cryptoTickerConsumer disconnected');
        }

        if (weatherConsumer) {
            await weatherConsumer.stop();  // stop rejoin
            await weatherConsumer.disconnect();
            logger.info('Kafka weatherConsumer disconnected');
        }

        if (newsConsumer) {
            await newsConsumer.stop();  // stop rejoin
            await newsConsumer.disconnect();
            logger.info('Kafka newsConsumer disconnected');
        }

        if (stocksConsumer) {
            await stocksConsumer.stop();  // stop rejoin
            await stocksConsumer.disconnect();
            logger.info('Kafka stocksConsumer disconnected');
        }

        if (cryptoTopMoversConsumer) {
            await cryptoTopMoversConsumer.stop();  // stop rejoin
            await cryptoTopMoversConsumer.disconnect();
            logger.info('Kafka cryptoTopMoversConsumer disconnected');
        }

        if (cryptoTopCoinsConsumer) {
            await cryptoTopCoinsConsumer.stop();  // stop rejoin
            await cryptoTopCoinsConsumer.disconnect();
            logger.info('Kafka cryptoTopCoinsConsumer disconnected');
        }

        if (producer) {
            await producer.disconnect();
            logger.info('Kafka producer disconnected');
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
        await initProducer();   // first controlled attempt
    } catch (err) {
        logger.error({ err }, 'Kafka unavailable at startup, running in degraded mode');
    }

    try {
        const PORT = Number(env.SERVER_PORT);
        server.listen(PORT, () => {
            logger.info(`Server running on http://localhost:${PORT}`);
        });
    } catch (err) {
        logger.fatal({ err }, 'Failed to start server');
        process.exit(1);
    }

    // Background recovery loop (self-healing)
    kafkaRecoveryLoop();
})();
