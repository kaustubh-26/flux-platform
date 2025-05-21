import dotenv from 'dotenv';
import { z } from 'zod';
import { Kafka, logLevel, Producer } from 'kafkajs';
import { logger } from './logger';
import { shutdownCache } from './cache';
import { WeatherService } from './modules/weather';
import { startWeatherConsumer } from './modules/weatherConsumer';

// -------------------------------------------------
// Env
// -------------------------------------------------
dotenv.config();

const envSchema = z.object({
  KAFKA_BROKER_ADDRESS: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production']).default('production'),
});

envSchema.parse(process.env);

// -------------------------------------------------
// Kafka setup
// -------------------------------------------------
const kafka = new Kafka({
  clientId: 'weather-service',
  brokers: [process.env.KAFKA_BROKER_ADDRESS!],
  logLevel: logLevel.NOTHING,
});

const producer: Producer = kafka.producer({ idempotent: true });
const consumer = kafka.consumer({ groupId: 'weather-group' });

const weatherService = new WeatherService();

let kafkaAvailable = false;
let kafkaStarting = false;
let isShuttingDown = false;
let kafkaDownLogged = false;

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
// Kafka init
// -------------------------------------------------
async function initKafkaSafely() {
  if (kafkaStarting) return;
  kafkaStarting = true;

  for (;;) {
    try {
      await producer.connect();
      await consumer.connect();

      await startWeatherConsumer(consumer, producer);

      logger.info('Kafka consumer started');
      break;
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

// Shutdown
async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}. Shutting down...`);

  try {
    shutdownCache();

    await producer.disconnect();
    await consumer.disconnect();

    setTimeout(() => process.exit(0), 3000);
  } catch (err) {
    logger.error({ err }, 'Shutdown error');
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
