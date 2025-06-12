import dotenv from 'dotenv';
import { logger } from './logger';
import { z } from 'zod';
import axios from 'axios';
import https from 'https';
import { getTopGainers } from "./modules/topGainers";
import { getTopLosers } from "./modules/topLosers";
import { cacheGet, shutdownCache } from './cache';
import { Consumer, Kafka, logLevel, Producer } from 'kafkajs';
import { startCoinbaseMarketsTicker, shutdownCoinbaseMarketsTicker, MARKETS_TOPCOINS_CACHE_KEY } from "./modules/topMarketsTicker";
import { TopCoin } from './interfaces/topCoins';
import { KafkaHealth } from './kafkaHealth';
import { initTopMoversConsumer } from './modules/topMoversConsumer';
import { initTopCoinsConsumer } from './modules/topCoinsConsumer';

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

let topMoversConsumer: Consumer;
let topCoinsConsumer: Consumer;


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


async function initKafkaSafely() {
    if (kafkaStarting) return;
    kafkaStarting = true;

    for (; ;) {
        try {
            await producer.connect();

            // Top Movers Consumer
            topMoversConsumer = await initTopMoversConsumer(kafka, logger, publishTopMovers, { fromBeginning: false });

            // Top Coins Consumer
            topCoinsConsumer = await initTopCoinsConsumer(kafka, logger, publishTopCoins, { fromBeginning: false });


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
                kafkaHealth.markUp();
                logger.info('Kafka recovered');
            }

            logger.info(`TopMovers Data sent to Kafka ${new Date().toLocaleString()}`);

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

    setInterval(async () => {
        publishTopMovers(
            'scheduler.crypto.topmovers.refresh',
            { value: 'scheduled' }
        );
        await publishTopCoins();
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
        logger.debug(`Kafka unavailable, skipping TopCoins publish ${new Date().toLocaleString()}`);
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
    logger.debug(`Kafka crypto.topcoins.event.updated, TopCoins published ${new Date().toLocaleString()}`);
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
            if (topMoversConsumer) {
                await topMoversConsumer.disconnect();
            }

            if (topCoinsConsumer) {
                await topCoinsConsumer.disconnect();
            }

            await producer.disconnect();
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
