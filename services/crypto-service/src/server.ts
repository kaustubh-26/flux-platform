import dotenv from 'dotenv';
import { logger } from './logger';
import { z } from 'zod';
import axios from 'axios';
import https from 'https';
import { getTopGainers } from "./modules/topGainers";
import { getTopLosers } from "./modules/topLosers";
import { cacheGet, shutdownCache } from './cache';
import { Kafka, logLevel, Producer } from 'kafkajs';
import { startCoinbaseMarketsTicker, shutdownCoinbaseMarketsTicker, MARKETS_TOPCOINS_CACHE_KEY } from "./modules/topMarketsTicker";
import { TopCoin } from './interfaces/topCoins';
import { KafkaHealth } from './kafkaHealth';


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
    NODE_ENV: z.enum(['development', 'production']).default('production')
});

type Env = z.infer<typeof envSchema>;

const env = envSchema.parse(process.env);


// -------------------------------------------------
// Kafka connection
// -------------------------------------------------
const kafkaHealth = new KafkaHealth();
let kafkaRetryLogged = false;
let topMoversCrashLogged = false;
let topCoinsCrashLogged = false;

const kafka = new Kafka({
    clientId: 'crypto-service',
    brokers: [env.KAFKA_BROKER_ADDRESS || 'kafka:9092'],
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

const topMoversConsumer = kafka.consumer({
    groupId: 'crypto-topmovers-group',
});

const topCoinsConsumer = kafka.consumer({
    groupId: 'crypto-topcoins-group',
});


let kafkaStarting = false;

producer.on(producer.events.CONNECT, () => {
    kafkaRetryLogged = false;
    kafkaHealth.markUp();
    logger.info('Kafka producer connected');
});

producer.on(producer.events.DISCONNECT, () => {
    kafkaHealth.markDown();
    logger.warn('Kafka producer disconnected');
});


topMoversConsumer.on(topMoversConsumer.events.CRASH, event => {
    kafkaHealth.markDown();
    if (!topMoversCrashLogged) {
        topMoversCrashLogged = true;

        logger.error(
            { error: event.payload.error },
            'Kafka topmovers consumer crashed, retrying...'
        );
    }
});

topCoinsConsumer.on(topCoinsConsumer.events.CRASH, event => {
    kafkaHealth.markDown();
    if (!topCoinsCrashLogged) {
        topCoinsCrashLogged = true;

        logger.error(
            { error: event.payload.error },
            'Kafka topcoins consumer crashed, retrying...'
        );
    }
});



async function initKafkaSafely() {
    if (kafkaStarting) return;
    kafkaStarting = true;

    for (; ;) {
        try {
            await producer.connect();

            // Top Movers Consumer
            await topMoversConsumer.connect();
            await topMoversConsumer.subscribe({
                topic: 'crypto.service.command.topmovers.refresh',
                fromBeginning: false,
            });

            await topMoversConsumer.run({
                partitionsConsumedConcurrently: 1,
                eachMessage: async ({ topic, message }) => {
                    await publishTopMovers(topic, message);
                },
            });

            // Top Coins Consumer
            await topCoinsConsumer.connect();

            await topCoinsConsumer.subscribe({
                topic: 'crypto.service.command.topcoins.refresh',
                fromBeginning: false,
            });

            await topCoinsConsumer.run({
                partitionsConsumedConcurrently: 1,
                eachMessage: async () => {
                    await publishTopCoins();
                },
            });


            // Start scheduled execution
            startTopMoversScheduler();

            return;
        } catch (err) {
            if (!kafkaRetryLogged) {
                kafkaRetryLogged = true;
                logger.warn(
                    { err: (err as Error).message },
                    'Kafka unavailable, retrying in 10s'
                );
            }

            await new Promise(res => setTimeout(res, 10_000));
        }
    }
}
initKafkaSafely();


async function bootstrap() {
    await startCoinbaseMarketsTicker({
        limit: 10,
        channel: "ticker",
        producer,
        kafkaHealth
    });
    logger.info("Crypto service started");
}

bootstrap().catch(err => {
    logger.error(err, "CoinbaseMarketsTicker failed to start");
});

// -------------------------------------------------
// Crypto Service
// -------------------------------------------------

// Publish Top Movers
let refreshInProgress = false;

async function publishTopMovers(topic: string, message: any) {
    if (refreshInProgress) {
        logger.info('Top movers refresh already in progress, skipping');
        return;
    }

    refreshInProgress = true;

    try {

        logger.debug({ topic, message }, 'Received Data from kafka');

        // Process the request
        const gainers = await getTopGainers(axiosClient);
        const losers = await getTopLosers(axiosClient);

        const topMoversAndCoins = {
            topGainers: gainers,
            topLosers: losers
        }

        try {
            if (!kafkaHealth.isAvailable()) {
                logger.warn('Kafka unavailable, skipping TopMovers publish');
                return;
            }

            // Send to Kafka
            await producer.send({
                topic: 'crypto.movers.event.updated',
                messages: [{ value: JSON.stringify(topMoversAndCoins) }]
            });

            if (!kafkaHealth.isAvailable()) {
                // kafkaAvailable = true;
                kafkaHealth.markUp();
                logger.info('Kafka recovered');
            }

            logger.info('Data sent to Kafka');
        } catch (err) {
            // set Kafka unavailable
            kafkaHealth.markDown();

            logger.warn(
                { err: (err as Error).message },
                'Kafka publish failed, marking Kafka unavailable'
            );
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
    } finally {
        refreshInProgress = false;
    }
}

function startTopMoversScheduler() {
    const INTERVAL = 90_000;

    setInterval(() => {
        publishTopMovers(
            'scheduler.crypto.topmovers.refresh',
            { value: 'scheduled' }
        );
        logger.info(
            `Top movers scheduler started (runs every ${INTERVAL} seconds). Next run at: ${(new Date(Date.now() + INTERVAL)).toLocaleString()}`
        );
    }, INTERVAL);

    logger.info(
        `Top movers scheduler started (runs every ${INTERVAL} seconds). Next run at: ${(new Date(Date.now() + INTERVAL).toLocaleString())}`
    );

}

// Publish Top Coins
async function publishTopCoins() {
    if (!kafkaHealth.isAvailable()) {
        logger.warn('Kafka unavailable, skipping TopCoins publish');
        return;
    }

    const topCoins = await cacheGet<TopCoin[]>(MARKETS_TOPCOINS_CACHE_KEY);

    if (!topCoins?.length) return;

    await producer.send({
        topic: 'crypto.topcoins.event.updated',
        messages: [
            { value: JSON.stringify({ topCoins }) }
        ]
    });
}



// -------------------------------------------------
// Shutdown handling
// -------------------------------------------------
let shuttingDown = false;

async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(`Received ${signal}. Shutting down gracefully...`);
    try {

        logger.info('Destroying HTTP agent...');
        httpsAgent.destroy();

        logger.info('Closing Valkey connection...');
        shutdownCache();
        logger.info('Valkey disconnected');

        try {
            logger.info('Disconnecting Kafka producer and consumer...');
            await producer.disconnect();
            await topMoversConsumer.disconnect();
            await topCoinsConsumer.disconnect();
        } catch (err) {
            logger.warn({ err }, 'Error while disconnecting Kafka producer');
        }

        shutdownCoinbaseMarketsTicker(signal);


        setTimeout(() => process.exit(0), 3000);

    } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
    }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
