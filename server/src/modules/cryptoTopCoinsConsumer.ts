import { Kafka } from "kafkajs";
import { Server } from "socket.io";
import pino from 'pino';
import { cacheSet } from "../cache";

const CRYPTO_GLOBAL_ROOM = 'crypto.global';
const CRYPTO_TOPCOINS_CACHE_KEY = 'crypto:top-coins';
const TOP_COINS_TTL = 300; // seconds (5 minutes TTL)

export async function initCryptoTopCoinsConsumer(
    kafka: Kafka,
    io: Server,
    logger: pino.Logger
) {
    const consumer = kafka.consumer({
        groupId: 'realtime-dashboard-crypto-topcoins',
    });

    await consumer.connect();

    await consumer.subscribe({
        topic: 'crypto.topcoins.event.updated',
        fromBeginning: false,
    });

    await consumer.run({
        eachMessage: async ({ message }) => {
            if (!message.value) return;

            let payload;
            try {
                payload = JSON.parse(message.value.toString());
                logger.debug(
                    { payload },
                    'Received crypto top coins from Kafka'
                );
            } catch (err) {
                logger.error({ err }, 'Failed to parse topCoins payload');
                return;
            }

            if (!payload?.topCoins) {
                logger.warn({ payload }, 'Missing coins in topCoins payload');
                return;
            }

            await cacheSet(CRYPTO_TOPCOINS_CACHE_KEY, payload, TOP_COINS_TTL);

            io.to(CRYPTO_GLOBAL_ROOM).emit('topCoinsResponse', {
                status: 'success',
                data: {
                    topCoins: payload.topCoins,
                },
                error: null,
            });
        },
    });

    logger.info('Crypto TopCoins consumer started');
    return consumer;
}
