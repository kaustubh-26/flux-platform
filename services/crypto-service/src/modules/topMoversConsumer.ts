import { Kafka } from 'kafkajs';
import pino from 'pino';

export async function initTopMoversConsumer(
  kafka: Kafka,
  logger: pino.Logger,
  onMessage: (topic: string, message: any) => Promise<void>,
  opts?: { fromBeginning?: boolean }
) {
  const consumer = kafka.consumer({
    groupId: 'crypto-topmovers-group',
  });

  await consumer.connect();

  await consumer.subscribe({
    topic: 'crypto.service.command.topmovers.refresh',
    fromBeginning: opts?.fromBeginning ?? false,
  });

  await consumer.run({
    partitionsConsumedConcurrently: 1,
    eachMessage: async ({ topic, message }) => {
      await onMessage(topic, message);
    },
  });

  logger.info('TopMovers consumer started');
  return consumer;
}
