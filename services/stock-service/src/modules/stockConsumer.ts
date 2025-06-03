import { Kafka, logLevel, Consumer } from "kafkajs";
import { logger } from "../logger";

export type TopPerformersHandler = (topic: string, message: any) => Promise<void>;

export function initStockConsumer(params: {
  broker: string;
  groupId?: string;
  handler: TopPerformersHandler;
  fromBeginning?: boolean;
}) {
  const {
    broker,
    groupId = "stock-topperformers-group",
    handler,
  } = params;

  const kafka = new Kafka({
    clientId: "stock-service",
    brokers: [broker],
    logLevel: logLevel.NOTHING,
  });

  const consumer: Consumer = kafka.consumer({ groupId });

  async function start() {
    await consumer.connect();

    await consumer.subscribe({
      topic: "stock.service.command.topperformers.refresh",
      fromBeginning: params.fromBeginning ?? false,
    });

    await consumer.run({
      partitionsConsumedConcurrently: 1,
      eachMessage: async ({ topic, message }) => {
        await handler(topic, message);
      },
    });

    logger.info("Top performers Kafka consumer started");
  }

  async function stop() {
    await consumer.disconnect();
    logger.info("Top performers Kafka consumer stopped");
  }

  return {
    start,
    stop,
    consumer,
  };
}

export type StockConsumer = ReturnType<typeof initStockConsumer>;