import { Kafka } from 'kafkajs';
import { Server } from 'socket.io';
import pino from 'pino';
import { cacheSet } from '../cache';
import { NEWS_GLOBAL_CACHE_KEY } from '../constants/news';

const NEWS_CACHE_TTL = 12 * 60; // 12 minutes

export async function initNewsConsumer(
  kafka: Kafka,
  io: Server,
  logger: pino.Logger,
  opts?: { fromBeginning?: boolean },
  onCrash?: () => void
) {
  const consumer = kafka.consumer({
    groupId: 'realtime-dashboard-news',
    sessionTimeout: 60_000,    // 60s gives time during CPU spikes
    heartbeatInterval: 10_000,  // Heartbeat every 10s instead of every 3s
    rebalanceTimeout: 60_000,
  });

  // If Kafka ever disconnects this consumer, report it
  const crashEvent = consumer.events?.CRASH ?? 'consumer.crash';
  consumer.on?.(crashEvent, (e: any) => {
    logger.error({ err: e?.payload?.error }, 'News consumer crashed');
    onCrash?.();
  });

  await consumer.connect();

  await consumer.subscribe({
    topic: 'news.service.event.updated',
    fromBeginning: opts?.fromBeginning ?? false,
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
