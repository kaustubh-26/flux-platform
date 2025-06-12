import { Kafka } from 'kafkajs';
import pino from 'pino';

export async function initTopCoinsConsumer(
  kafka: Kafka,
  logger: pino.Logger,
  onMessage: () => Promise<void>,
  opts?: { fromBeginning?: boolean }
) {
  const consumer = kafka.consumer({
    groupId: 'crypto-topcoins-group',
  });

  await consumer.connect();

  await consumer.subscribe({
    topic: 'crypto.service.command.topcoins.refresh',
    fromBeginning: opts?.fromBeginning ?? false,
  });

  await consumer.run({
    partitionsConsumedConcurrently: 1,
    eachMessage: async () => {
      await onMessage();
    },
  });

  logger.info('TopCoins consumer started');
  return consumer;
}
