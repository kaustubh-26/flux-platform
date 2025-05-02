import dotenv from "dotenv";
import https from "https";
import axios from "axios";
import { z } from "zod";
import { Kafka, logLevel, Producer } from "kafkajs";

import { logger } from "./logger";
import { getTopPerformers } from "./modules/topPerformers";
import { cacheGet, cacheSet, shutdownCache } from "./cache";

// -------------------------------------------------
// Env
// -------------------------------------------------
dotenv.config();

const envSchema = z.object({
  FINNHUB_API_KEY: z.string().min(1),
  KAFKA_BROKER_ADDRESS: z.string().min(1),
  NODE_ENV: z.enum(["development", "production"]).default("production"),
});

const env = envSchema.parse(process.env);

// -------------------------------------------------
// Axios client
// -------------------------------------------------
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
});

const axiosClient = axios.create({
  timeout: 10_000,
  httpsAgent,
});

// -------------------------------------------------
// Kafka
// -------------------------------------------------
let kafkaAvailable = false;

const kafka = new Kafka({
  clientId: "stock-service",
  brokers: [env.KAFKA_BROKER_ADDRESS],
  logLevel: logLevel.NOTHING,
});

const producer: Producer = kafka.producer({
  idempotent: true,
  retry: {
    retries: 20,
    initialRetryTime: 300,
    maxRetryTime: 30_000,
  },
});

const consumer = kafka.consumer({
  groupId: "stock-topperformers-group",
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
  logger.warn("Kafka producer disconnected");
});

// -------------------------------------------------
// Cache
// -------------------------------------------------
const STOCK_TOP_PERFORMERS_CACHE_KEY = "stock:top:performers";
const CACHE_TTL_SECONDS = 120; // 2 minutes

// -------------------------------------------------
// Kafka Init
// -------------------------------------------------
let kafkaStarting = false;
let kafkaDownLogged = false;

async function initKafkaSafely() {
  if (kafkaStarting) return;
  kafkaStarting = true;

  for (; ;) {
    try {
      await producer.connect();
      await consumer.connect();

      await consumer.subscribe({
        topic: "stock.service.command.topperformers.refresh",
        fromBeginning: false,
      });

      await consumer.run({
        partitionsConsumedConcurrently: 1,
        eachMessage: async ({ topic, message }) => {
          await handleBffTopPerformersRequest(topic, message);
        },
      });

      startTopPerformersScheduler();
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

// -------------------------------------------------
// Publisher
// -------------------------------------------------
let refreshInProgress = false;
let bffRequestInProgress = false;

async function handleBffTopPerformersRequest(topic: string, message: any) {
  try {
    logger.debug(`Trigger from BFF received ${new Date().toLocaleString()}`);

    // Check cache first
    const cached = await cacheGet(STOCK_TOP_PERFORMERS_CACHE_KEY);
    if (cached) {
      logger.debug(`Trigger from BFF - Serving top performers from cache: ${new Date().toLocaleString()}`);
      await publishTopPerformersEvent(cached); // publish from cache
      return;
    }

    logger.debug(`Trigger from BFF - Data not in cache, fetching from API: ${new Date().toLocaleString()}`);

    // Fetch fresh data
    const performers = await getTopPerformers({
      apiKey: env.FINNHUB_API_KEY,
      axiosClient,
      limit: 10,
    });

    // Cache result
    await cacheSet(
      STOCK_TOP_PERFORMERS_CACHE_KEY,
      performers,
      CACHE_TTL_SECONDS
    );
    logger.debug(`Trigger from BFF - Data in cache updated: ${new Date().toLocaleString()}`);

    // Publish to Kafka
    await publishTopPerformersEvent(performers); // publish after fetch

    logger.debug(`Trigger from BFF - Data from API published to kafka: ${new Date().toLocaleString()}`);


  } catch (err) {
    kafkaAvailable = false;
    logger.error({ err }, "Failed to publish top performers");
  }
}

async function publishTopPerformersEvent(performers: any) {
  if (!kafkaAvailable) {
    logger.warn("Kafka unavailable, skipping publish");
    return;
  }

  await producer.send({
    topic: "stock.service.event.updated",
    messages: [
      {
        value: JSON.stringify({ data: performers }),
      },
    ],
  });

  logger.info("Top performers published to Kafka");
}

async function scheduledTopPerformersRefresh(topic: string, message: any) {
  if (refreshInProgress) {
    logger.info("Top performers refresh already running, skipping");
    return;
  }

  refreshInProgress = true;

  try {
    logger.debug({ topic, message }, `Trigger scheduled refresh received ${new Date().toLocaleString()}`);

    // Fetch fresh data
    const performers = await getTopPerformers({
      apiKey: env.FINNHUB_API_KEY,
      axiosClient,
      limit: 10,
    });

    // Cache result
    await cacheSet(
      STOCK_TOP_PERFORMERS_CACHE_KEY,
      performers,
      CACHE_TTL_SECONDS
    );

    logger.debug(`Trigger scheduled refresh - cache updated: ${new Date().toLocaleString()}`);
    // Publish to Kafka
    await publishTopPerformersEvent(performers); // publish after fetch

    logger.debug(`Trigger scheduled refresh - Top performers published: ${new Date().toLocaleString()}`);

  } catch (err) {
    kafkaAvailable = false;
    logger.warn(
      { err: (err as Error).message },
      "Kafka unavailable, skipping publish"
    );
  } finally {
    refreshInProgress = false;
  }
}

// -------------------------------------------------
// Scheduler (fallback)
// -------------------------------------------------
function startTopPerformersScheduler() {
  const INTERVAL = 90_000;

  // Initial call on service start
  scheduledTopPerformersRefresh(
    "stock.service.topperformers.refresh",
    { value: "initial" }
  );

  setInterval(() => {
    scheduledTopPerformersRefresh(
      "scheduler.stock.topperformers.refresh",
      { value: "scheduled" }
    );
  }, INTERVAL);

  logger.info(
    `Top performers scheduler started (every ${INTERVAL / 1000}s). Next run at: ${(new Date(Date.now() + INTERVAL)).toLocaleString()}`
  );
}

// -------------------------------------------------
// Graceful shutdown
// -------------------------------------------------
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`Received ${signal}. Shutting down...`);

  try {
    httpsAgent.destroy();
    shutdownCache();

    await producer.disconnect();
    await consumer.disconnect();

    setTimeout(() => process.exit(0), 3000);
  } catch (err) {
    logger.error({ err }, "Shutdown error");
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

