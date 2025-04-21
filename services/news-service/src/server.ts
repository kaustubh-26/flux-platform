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

const consumer = kafka.consumer({
    groupId: "news-group",
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
                        if (value) {
                            const payload = JSON.parse(value);

                            const news = await getNews({
                                apiKey: env.NEWSDATA_API_KEY,
                                axiosClient,
                            });

                            if (!kafkaAvailable) {
                                logger.warn("Kafka unavailable, skipping News publish");
                                return;
                            }

                            await producer.send({
                                topic: "news.service.event.updated",
                                messages: [
                                    {
                                        key: "global",
                                        value: JSON.stringify({
                                            country: payload.data.country,
                                            payload: news,
                                            timestamp: Date.now(),
                                        }),
                                    },
                                ],
                            });

                            logger.info("News data published to Kafka");
                        }
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
            return;

        } catch (err) {
            kafkaAvailable = false;
            logger.warn(
                { err: (err as Error).message },
                "Kafka unavailable, retrying in 10s"
            );
            await new Promise(res => setTimeout(res, 10_000));
        }
    }
}

initKafkaSafely();

async function shutdown(signal: string) {
    logger.info(`Received ${signal}. Shutting down...`);
    try {
        httpsAgent.destroy();

        try {
            logger.info("Disconnecting Kafka producer and consumer...");
            await producer.disconnect();
            await consumer.disconnect();
        } catch (err) {
            logger.warn({ err }, "Error disconnecting Kafka");
        }

        setTimeout(() => process.exit(0), 3000);
    } catch (err) {
        logger.error({ err }, "Shutdown failed");
        process.exit(1);
    }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

