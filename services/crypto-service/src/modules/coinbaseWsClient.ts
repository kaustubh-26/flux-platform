import { CoinbaseWsConnection } from './coinbaseWsConnection';
import { logger } from '../logger';
import Bottleneck from 'bottleneck';
import { Producer } from 'kafkajs';
import { KafkaHealth } from '../kafkaHealth';

const COINBASE_WS_URL = 'wss://advanced-trade-ws.coinbase.com';
const MAX_RECONNECT_ATTEMPTS = 5;
const TICKER_FLUSH_INTERVAL_MS = Number(process.env.TICKER_FLUSH_INTERVAL_MS) || 1000; // default 1 second

/**
 * Coinbase limits (unauthenticated):
 * - subscribe / unsubscribe messages: 8 per second per IP
 * - max product_ids per connection: 10
 */
const MAX_SUBS_PER_CONN = 10; // 10
const MAX_UNAUTH_MSGS_PER_SEC = 8;

// Global rate limiter for subscribe/unsubscribe messages
const subscribeLimiter = new Bottleneck({
    reservoir: MAX_UNAUTH_MSGS_PER_SEC,
    reservoirRefreshAmount: MAX_UNAUTH_MSGS_PER_SEC,
    reservoirRefreshInterval: 1000, // 1 second
});

export class MultiConnectionCoinbaseClient {
    private nextConnId = 0;

    // connectionId -> connection
    private connections = new Map<number, CoinbaseWsConnection>();

    // productId -> connectionId
    private productToConn = new Map<string, number>();

    constructor(private channel = 'ticker', private producer: Producer, private kafkaHealth: KafkaHealth) {
        // Bootstrap with a single connection
        this.createConnection();
    }

    /**
     * Create a new WebSocket connection.
     * This should be rare and only happen when all existing
     * connections are at full capacity.
     */
    private createConnection(): CoinbaseWsConnection {
        const conn = new CoinbaseWsConnection(
            this.nextConnId++,
            COINBASE_WS_URL,
            this.channel,
            MAX_RECONNECT_ATTEMPTS,
            this.producer,
            this.kafkaHealth,
            TICKER_FLUSH_INTERVAL_MS
        );

        conn.connect();
        this.connections.set(conn.id, conn);

        logger.info(
            { connId: conn.id, totalConnections: this.connections.size },
            'New WS connection created'
        );

        return conn;
    }

    /**
     * Subscribe to a product_id.
     * - Idempotent
     * - Capacity-aware
     * - Rate-limit safe
     */
    subscribe(productId: string) {
        // Already subscribed → no-op
        if (this.productToConn.has(productId)) {
            const connId = this.productToConn.get(productId)!;
            logger.debug(
                { productId, connId },
                'Product already subscribed'
            );
            return;
        }

        // Find a connection with available capacity
        let targetConn: CoinbaseWsConnection | undefined;

        for (const conn of this.connections.values()) {
            if (conn.products.size < MAX_SUBS_PER_CONN) {
                targetConn = conn;
                break;
            }
        }

        // No capacity → create new connection
        if (!targetConn) {
            targetConn = this.createConnection();
        }

        // Assign ownership immediately (authoritative)
        this.productToConn.set(productId, targetConn.id);

        // Queue subscription on the connection
        targetConn.subscribe(productId);

        // Flush subscriptions with GLOBAL rate limiting
        subscribeLimiter.schedule(() => {
            targetConn!.flushSubscriptions();
            return Promise.resolve();
        });

        logger.debug(
            {
                productId,
                connId: targetConn.id,
                subsOnConn: targetConn.products.size,
            },
            'Subscribed product'
        );
    }

    /**
     * Unsubscribe from a product_id.
     * Also rate-limited as unauth message.
     */
    unsubscribe(productId: string) {
        const connId = this.productToConn.get(productId);
        if (connId === undefined) return;

        const conn = this.connections.get(connId);
        if (!conn) return;

        this.productToConn.delete(productId);
        conn.unsubscribe(productId);

        subscribeLimiter.schedule(() => {
            conn.flushSubscriptions();
            return Promise.resolve();
        });


        logger.info({ productId, connId }, 'Unsubscribed product');
    }

    /**
     * Runtime visibility
     */
    stats() {
        return Array.from(this.connections.values()).map(conn => ({
            connId: conn.id,
            subs: conn.products.size,
            open: conn.isOpen,
        }));
    }

    /**
     * Graceful shutdown
     */
    shutdown() {
        logger.info('Shutting down WS client');
        for (const conn of this.connections.values()) {
            conn.close();
        }
    }
}
