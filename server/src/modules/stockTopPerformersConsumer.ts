import { Kafka } from 'kafkajs';
import { Server } from 'socket.io';
import pino from 'pino';
import { cacheSet } from '../cache';
import { STOCK_TOP_PERFORMERS_CACHE_KEY } from '../constants/stocks';

const STOCK_GLOBAL_ROOM = 'stock.global';
const TOP_PERFORMERS_TTL = 15 * 60; // seconds (5 minutes)

/**
 * Kafka → Socket.IO consumer for stock top performers realtime updates
 */
export async function initStockTopPerformersConsumer(
    kafka: Kafka,
    io: Server,
    logger: pino.Logger
) {
    const consumer = kafka.consumer({
        groupId: 'realtime-dashboard-stock-topperformers',
    });

    await consumer.connect();

    /**
     * Subscribe to stock top performers update topic
     */
    await consumer.subscribe({
        topic: 'stock.service.event.updated',
        fromBeginning: false,
    });

    await consumer.run({
        eachMessage: async ({ message }) => {
            if (!message.value) return;

            let payload;
            try {
                payload = JSON.parse(message.value.toString());
                logger.debug(
                    `Received stock top performers from Kafka - ${new Date().toLocaleString()}`
                );
            } catch (err) {
                logger.error({ err },'Failed to parse Stock performers payload');
                return;
            }

            if (!payload?.data) {
                logger.warn(
                    { payload },
                    'Stock performers payload missing or invalid "data"'
                );
                return;
            }

            // Cache for REST / reconnect clients
            await cacheSet(
                STOCK_TOP_PERFORMERS_CACHE_KEY,
                payload.data,
                TOP_PERFORMERS_TTL
            );

            // Emit to all connected stock dashboard clients
            io.to(STOCK_GLOBAL_ROOM).emit('stockTopPerformersResponse', {
                status: 'success',
                data: payload.data,
                error: null,
            });
        },
    });

    logger.info('Stock TopPerformers consumer started');
    return consumer;
}
