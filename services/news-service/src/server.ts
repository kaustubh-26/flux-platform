import dotenv from 'dotenv';
import { logger } from './logger';
import { z } from 'zod';
import axios from "axios";
import https from 'https';
import { getNews } from "./modules/getNews";
import { Kafka, logLevel, Producer } from 'kafkajs';

const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 10,
});
const axiosClient = axios.create({
    timeout: 10000,
    httpsAgent
});

let scheduler: any;
// -------------------------------------------------
// Load & validate environment variables
// -------------------------------------------------
dotenv.config();

const envSchema = z.object({
    KAFKA_BROKER_ADDRESS: z.string().min(1),
    NEWSDATA_API_KEY: z.string().min(1),
    NODE_ENV: z.enum(['development', 'production']).default('production')
});

type Env = z.infer<typeof envSchema>;

const env = envSchema.parse(process.env);

// -------------------------------------------------
// Kafka connection (News Service)
// -------------------------------------------------
const kafka = new Kafka({
    clientId: "news-service",
    brokers: [env.KAFKA_BROKER_ADDRESS || "kafka:9092"],
    logLevel: logLevel.NOTHING,
    connectionTimeout: 10_000,
    authenticationTimeout: 10_000,
});

const producer: Producer = kafka.producer({
    idempotent: true,
    retry: {
        initialRetryTime: 300,
        retries: 20,
        factor: 0.2,
        multiplier: 2,
        maxRetryTime: 30_000,
    },
    maxInFlightRequests: 5,
});

producer.on(producer.events.CONNECT, () => {
    kafkaAvailable = true;
    if (kafkaDownLogged) {
        logger.info("Kafka connection restored");
        kafkaDownLogged = false;
    } else {
        logger.info("Kafka producer connected");
    }
});

producer.on(producer.events.DISCONNECT, () => {
    kafkaAvailable = false;
    if (!kafkaDownLogged) {
        kafkaDownLogged = true;
        logger.warn("Kafka producer disconnected");
    }
});

const consumer = kafka.consumer({
    groupId: "news-group",
});

let kafkaAvailable = false;
let kafkaDownLogged = false;
let kafkaStarting = false;
let schedulerStarted = false;

async function initKafkaSafely() {
    if (kafkaStarting) return;
    kafkaStarting = true;

    for (; ;) {
        try {
            await producer.connect();
            await consumer.connect();

            if (!kafkaAvailable) {
                kafkaAvailable = true;
                logger.info("Kafka recovered");
            }

            await consumer.subscribe({
                topic: "news.service.command.refresh",
                fromBeginning: false,
            });

            await consumer.run({
                eachMessage: async ({ topic, message }) => {
                    try {

                        const value = message.value?.toString();
                        logger.debug({ topic, value }, "Received Kafka command");

                        // Process the request
                        await fetchAndPublishTopNews("bff");
                    } catch (err) {
                        logger.error(
                            {
                                err,
                                topic,
                                value: message.value?.toString(),
                            },
                            "Unhandled error while processing News Kafka message"
                        );
                    }
                },
            });

            kafkaAvailable = true;
            logger.info("Kafka connected (News service)");

            if (!schedulerStarted) {
                startNewsScheduler();
                schedulerStarted = true;
            }

            return;

        } catch (err) {
            if (!kafkaDownLogged) {
                kafkaDownLogged = true;
                kafkaAvailable = false;
                logger.warn(`Kafka unavailable, retrying every 10s`);
            }
            await new Promise(res => setTimeout(res, 10_000));
        }
    }
}

initKafkaSafely();

// Handle Server requests
let refreshInProgress = false;
async function fetchAndPublishTopNews(trigger: string) {
    if (refreshInProgress) {
        logger.debug("News refresh already in progress, skipping");
        return;
    }

    refreshInProgress = true;

    try {
        logger.debug(`News refresh triggered by: ${trigger}`);

        const news = await getNews({
            apiKey: env.NEWSDATA_API_KEY,
            axiosClient,
        });

        await publishNewsEvent(news, trigger);

    } catch (err) {
        // kafkaAvailable = false;
        logger.warn(
            { err },
            "Kafka publish failed during scheduled news refresh"
        );
    } finally {
        refreshInProgress = false;
    }
}

async function publishNewsEvent(news: any, source: string) {
    if (!kafkaAvailable) {
        logger.warn("Kafka unavailable, skipping News publish");
        return;
    }

    await producer.send({
        topic: "news.service.event.updated",
        messages: [
            {
                key: "globalnews",
                value: JSON.stringify({
                    scope: "global",
                    payload: news,
                    timestamp: Date.now(),
                    source,
                }),
            },
        ],
    });

    logger.info(`News published to Kafka (${source}) - ${new Date().toLocaleString()}`);
}

// Scheduler
const NEWS_SCHEDULER_INTERVAL = 8 * 60 * 1000; // 480_000 ms (8 minutes)
function startNewsScheduler() {
    // Initial fetch on startup
    fetchAndPublishTopNews("initial");

    scheduler = setInterval(() => {
        fetchAndPublishTopNews("interval");

        logger.info(
            `News scheduler - (every ${NEWS_SCHEDULER_INTERVAL / 1000}s). Next run at ${new Date(
                Date.now() + NEWS_SCHEDULER_INTERVAL
            ).toLocaleString()}`
        );
    }, NEWS_SCHEDULER_INTERVAL);

    logger.info(
        `News scheduler started (every ${NEWS_SCHEDULER_INTERVAL / 1000}s). Next run at ${new Date(
            Date.now() + NEWS_SCHEDULER_INTERVAL
        ).toLocaleString()}`
    );
}


async function shutdown(signal: string) {
    logger.info(`Received ${signal}. Shutting down...`);
    try {
        httpsAgent.destroy();
        logger.info("Stopping Scheduler...");
        clearInterval(scheduler);

        try {
            logger.info("Disconnecting Kafka producer and consumer...");
            await producer.disconnect();
            await consumer.disconnect();
        } catch (err) {
            logger.warn({ err }, "Error disconnecting Kafka");
        }

        setTimeout(() => process.exit(0), 2000);
    } catch (err) {
        logger.error({ err }, "Shutdown failed");
        process.exit(1);
    }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

