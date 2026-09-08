import { Kafka } from 'kafkajs';
import { Server } from 'socket.io';
import pino from 'pino';
import { cacheSet } from '../cache';
import { CRYPTO_TICKER_CACHE_KEY, CRYPTO_GLOBAL_ROOM } from '../constants/crypto';

const TICKER_TTL = 300; // seconds (short-lived snapshot for UI hydration)

const LOG_INTERVAL_MS = 30_000; // 30 seconds
let lastLogTime = 0;
const tickerSnapshot: Record<string, any> = {};

/**
 * Kafka → Socket.IO consumer for crypto ticker price updates
 */
export async function initCryptoTickerConsumer(
    kafka: Kafka,
    io: Server,
    logger: pino.Logger,
    opts?: { fromBeginning?: boolean },
    onCrash?: () => void
) {
    const consumer = kafka.consumer({
        groupId: 'realtime-dashboard-crypto-ticker',
        sessionTimeout: 60_000,    // 60s gives time during CPU spikes
        heartbeatInterval: 10_000,  // Heartbeat every 10s instead of every 3s
        rebalanceTimeout: 60_000,
    });

    // If Kafka ever disconnects this consumer, report it
    const crashEvent = consumer.events?.CRASH ?? 'consumer.crash';
    consumer.on?.(crashEvent, (e: any) => {
        logger.error({ err: e?.payload?.error }, 'Crypto ticker consumer crashed');
        onCrash?.();
    });

    await consumer.connect();

    /**
     * Subscribe to crypto ticker updates
     */
    await consumer.subscribe({
        topic: 'crypto.ticker.event.updated',
        fromBeginning: opts?.fromBeginning ?? false,
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

            const productId = payload?.data?.product_id;
            if (productId) {
                tickerSnapshot[productId] = payload;
                // Cache last-known tickers for UI hydration
                await cacheSet(CRYPTO_TICKER_CACHE_KEY, tickerSnapshot, TICKER_TTL);
            }

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
