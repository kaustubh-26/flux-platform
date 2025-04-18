import { Kafka } from 'kafkajs';
import { Server } from 'socket.io';
import pino from 'pino';
import { cacheSet } from '../cache';
import { CRYPTO_TICKER_CACHE_KEY } from '../server';

const CRYPTO_GLOBAL_ROOM = 'crypto.global';
const TICKER_TTL = 5; // seconds (near-realtime)

const LOG_INTERVAL_MS = 30_000; // 30 seconds
let lastLogTime = 0;

/**
 * Kafka → Socket.IO consumer for crypto ticker price updates
 */
export async function initCryptoTickerConsumer(
    kafka: Kafka,
    io: Server,
    logger: pino.Logger
) {
    const consumer = kafka.consumer({
        groupId: 'realtime-dashboard-crypto-ticker',
    });

    await consumer.connect();

    /**
     * Subscribe to crypto ticker updates
     */
    await consumer.subscribe({
        topic: 'crypto.ticker.event.updated',
        fromBeginning: false,
    });

    await consumer.run({
        eachMessage: async ({ message }) => {
            if (!message.value) return;

            let payload;
            try {
                payload = JSON.parse(message.value.toString());
                
                const now = Date.now();
                if (now - lastLogTime >= LOG_INTERVAL_MS) {
                    logger.debug(
                        `Received crypto ticker update from Kafka - ${new Date(now).toLocaleString()}`
                    );
                    lastLogTime = now;
                }
            } catch (err) {
                logger.error({ err }, 'Failed to parse crypto ticker payload');
                return;
            }

            if (!payload || Object.keys(payload).length === 0) {
                logger.warn({ payload }, 'Ticker payload is empty or invalid');
                return;
            }

            // Cache latest ticker snapshot (short TTL for realtime feel)
            await cacheSet(CRYPTO_TICKER_CACHE_KEY, payload, TICKER_TTL);

            // Emit to all connected clients
            io.to(CRYPTO_GLOBAL_ROOM).emit('cryptoTickerResponse', {
                status: 'success',
                data: payload,
                error: null,
            });
        },
    });

    logger.info('Crypto ticker consumer started');
    return consumer;
}
