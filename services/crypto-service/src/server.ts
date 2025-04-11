import dotenv from 'dotenv';
import { logger } from './logger';
import { z } from 'zod';
import axios from 'axios';
import https from 'https';
import { getTopGainers } from "./modules/topGainers";
import { getTopLosers } from "./modules/topLosers";
import { shutdownCache } from './cache';
import { Kafka, logLevel, Producer } from 'kafkajs';

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
const kafka = new Kafka({
    clientId: 'crypto-service',
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
    groupId: 'crypto-group',
});

let kafkaAvailable = false;
let kafkaStarting = false;

producer.on(producer.events.CONNECT, () => {
    kafkaAvailable = true;
    logger.info('Kafka producer connected');
});

producer.on(producer.events.DISCONNECT, () => {
    kafkaAvailable = false;
    logger.warn('Kafka producer disconnected');
});


consumer.on(consumer.events.CRASH, event => {
    kafkaAvailable = false;
    logger.error(
        { error: event.payload.error },
        'Kafka consumer crashed'
    );
});


async function initKafkaSafely() {
    if (kafkaStarting) return;
    kafkaStarting = true;

    for (; ;) {
        try {
            await producer.connect();
            await consumer.connect();

            // Top Movers Consumer
            await consumer.subscribe({
                topic: 'crypto.service.command.topmovers.refresh',
                fromBeginning: false,
            });

            await consumer.run({
                partitionsConsumedConcurrently: 1,
                eachMessage: async ({ topic, message }) => {
                    publishTopMovers(topic, message);
                },
            });

            // ✅ Start scheduled execution
            startTopMoversScheduler();

            return;
        } catch (err) {
            // kafkaAvailable = false;
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
        if (!kafkaAvailable) {
            kafkaAvailable = true;
            logger.info('Kafka recovered');
        }

        logger.debug({ topic, message }, 'Received Data from kafka');

        // Process the request
        const gainers = await getTopGainers(axiosClient);
        const losers = await getTopLosers(axiosClient);

        const topMovers = {
            topGainers: gainers,
            topLosers: losers
        }

        try {
            if (!kafkaAvailable) {
                logger.warn('Kafka unavailable, skipping publish');
                return;
            }

            // Send to Kafka
            await producer.send({
                topic: 'crypto.movers.event.updated',
                messages: [{ value: JSON.stringify(topMovers) }]
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



// -------------------------------------------------
// Shutdown handling
// -------------------------------------------------
async function shutdown(signal: string) {
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
