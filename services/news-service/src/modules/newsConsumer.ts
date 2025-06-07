import { Consumer } from 'kafkajs';
import { logger } from '../logger';

export type NewsConsumerDeps = {
  consumer: Consumer;
  onRefreshCommand: (trigger: string) => Promise<void>;
  fromBeginning?: boolean;

};

export async function initNewsConsumer({
  consumer,
  onRefreshCommand,
  fromBeginning = false,
}: NewsConsumerDeps) {
  await consumer.subscribe({
    topic: 'news.service.command.refresh',
    fromBeginning,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const value = message.value?.toString();

      try {
        logger.debug({ topic, value }, 'Received Kafka command');
        await onRefreshCommand('bff');
      } catch (err) {
        logger.error(
          { err, topic, value },
          'Unhandled error while processing News Kafka message'
        );
      }
    },
  });

  logger.info('Kafka consumer started (News service)');
}

export async function stopNewsConsumer(consumer: Consumer) {
  try {
    await consumer.disconnect();
    logger.info('Kafka consumer disconnected');
  } catch (err) {
    logger.warn({ err }, 'Error disconnecting Kafka consumer');
  }
}
