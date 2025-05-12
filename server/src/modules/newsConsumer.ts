import { Kafka } from 'kafkajs';
import { Server } from 'socket.io';
import pino from 'pino';
import { cacheSet } from '../cache';
import { NEWS_GLOBAL_CACHE_KEY } from '../constants/news';

const NEWS_CACHE_TTL = 12 * 60; // 12 minutes

export async function initNewsConsumer(
  kafka: Kafka,
  io: Server,
  logger: pino.Logger
) {
  const consumer = kafka.consumer({
    groupId: 'realtime-dashboard-news'
  });

  await consumer.connect();

  await consumer.subscribe({
    topic: 'news.service.event.updated',
    fromBeginning: true
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;

      let raw: any;
      try {
        raw = JSON.parse(message.value.toString());
      } catch (err) {
        logger.error(
          { err, value: message.value.toString() },
          'Invalid JSON in news payload'
        );
        return;
      }

      const articles = raw.payload.data;
      let scope = "global";

      if (!Array.isArray(articles)) {
        logger.warn({ raw }, 'Invalid news payload structure');
        return;
      }

      logger.debug(
        {
          articlesCount: articles.length
        },
        'News payload received'
      );

      const room = `news.global`;
      const newsEvent = `newsUpdate`;

      // Cache latest news
      await cacheSet(
        NEWS_GLOBAL_CACHE_KEY,
        articles,
        NEWS_CACHE_TTL
      );

      io.to(room).emit(newsEvent, {
        status: 'success',
        scope,
        data: articles
      });

      logger.debug(
        { room: room, event: newsEvent },
        'Global news emitted'
      );

    }
  });

  logger.info('News consumer started');
  return consumer;
}
