import dotenv from 'dotenv';
import { logger } from './logger';
import { z } from 'zod';
import axios from "axios";
import https from 'https';
import { getNews } from "./modules/getNews";
import { Kafka, logLevel, Producer } from 'kafkajs';
import { initNewsConsumer, stopNewsConsumer } from './modules/newsConsumer';
import fs from "fs";

function resolveSecret(envVar: string): string {
  const value = process.env[envVar];
  if (!value) {
    throw new Error(`${envVar} is not set`);
  }
  if (value.startsWith("/run/secrets/")) {
    return fs.readFileSync(value, "utf8").trim();
  }
  return value;
}

const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 10,
});
const axiosClient = axios.create({
    timeout: 10000,
    httpsAgent
});

let scheduler: NodeJS.Timeout | undefined;
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

// Resolve secret once
const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY && !process.env.NEWSDATA_API_KEY.startsWith("/run/secrets/")
    ? process.env.NEWSDATA_API_KEY : resolveSecret("NEWSDATA_API_KEY");


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

            kafkaAvailable = true;

            await initNewsConsumer({
                consumer,
                onRefreshCommand: fetchAndPublishTopNews,
            });

            logger.info("Kafka connected (News service)");

            if (!schedulerStarted) {
                startNewsScheduler();
                schedulerStarted = true;
            }

            return;

        } catch (err) {
            if (!kafkaDownLogged) {
                kafkaDownLogged = true;
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
            apiKey: NEWSDATA_API_KEY,
            axiosClient,
        });

        await publishNewsEvent(news, trigger);

    } catch (err) {
        logger.warn(
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
        if (scheduler) clearInterval(scheduler);

        try {
            logger.info("Disconnecting Kafka producer and consumer...");
            await stopNewsConsumer(consumer);
            await producer.disconnect();
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

