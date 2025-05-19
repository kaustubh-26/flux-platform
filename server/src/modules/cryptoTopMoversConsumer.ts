import { Kafka } from 'kafkajs';
import { Server } from 'socket.io';
import pino from 'pino';
import { cacheSet } from '../cache';
import { CRYPTO_MOVERS_CACHE_KEY } from '../constants/crypto';

const CRYPTO_GLOBAL_ROOM = 'crypto.global';
const TOP_MOVERS_TTL = 300; // seconds (5 minutes TTL)

/**
 * Kafka → Socket.IO consumer for crypto realtime updates
 */
export async function initCryptoTopMoversConsumer(
    kafka: Kafka,
    io: Server,
    logger: pino.Logger,
    opts?: { fromBeginning?: boolean }
) {
    const consumer = kafka.consumer({
        groupId: 'realtime-dashboard-crypto-topmovers',
    });

    await consumer.connect();

    /**
     * Subscribe to all crypto-related update topics
     */

    await consumer.subscribe({
        topic: 'crypto.movers.event.updated',
        fromBeginning: opts?.fromBeginning ?? false,
    });

    await consumer.run({
        eachMessage: async ({ message }) => {
            if (!message.value) return;

            let payload;
            try {
                payload = JSON.parse(message.value.toString());
                logger.debug(
                    `Received crypto movers from Kafka - ${(new Date(Date.now())).toLocaleString()}`
                );
            } catch (err) {
                logger.error({ err }, 'Failed to parse crypto movers payload');
                return;
            }

            if (!payload?.topGainers || !payload?.topLosers) {
                logger.warn({ payload }, 'Movers payload missing topGainers/topLosers');
                return;
            }

            await cacheSet(CRYPTO_MOVERS_CACHE_KEY, payload, TOP_MOVERS_TTL);

            io.to(CRYPTO_GLOBAL_ROOM).emit('topMoversResponse', {
                status: 'success',
                data: {
                    topGainers: payload.topGainers,
                    topLosers: payload.topLosers,
                },
                error: null,
            });
        },
    });


    logger.info('Crypto TopMovers consumer started');
    return consumer;
}
