import WebSocket from 'ws';
import { logger } from '../logger';
import { Producer } from 'kafkajs';
import { KafkaHealth } from '../kafkaHealth';

export class CoinbaseWsConnection {
  // ---------- connection state ----------
  readonly id: number;
  readonly products = new Set<string>();        // authoritative ownership
  private pendingSubs = new Set<string>();      // batched outbound subs

  private ws?: WebSocket;
  private reconnectAttempts = 0;
  private isReady = false;

  private kafkaDownLogged = false;
  private shuttingDown = false;

  // ---------- ticker coalescing ----------
  private tickerBuffer = new Map<string, any>(); // product_id -> latest ticker
  private flushTimer?: NodeJS.Timeout;

  constructor(
    id: number,
    private url: string,
    private channel: string,
    private maxReconnects: number,
    private producer: Producer,
    private kafkaHealth: KafkaHealth,
    private flushIntervalMs: number
  ) {
    this.id = id;
  }

  // ------------------------------------------------
  // Lifecycle
  // ------------------------------------------------
  connect() {
    if (this.shuttingDown) return;

    logger.info({ connId: this.id }, 'Opening WebSocket');
    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      logger.info({ connId: this.id }, 'WebSocket opened');
      this.reconnectAttempts = 0;
      this.isReady = true;

      this.tickerBuffer.clear(); // reset stale ticks

      // replay all owned products on reconnect
      this.pendingSubs = new Set(this.products);

      // Replay subscriptions on reconnect; without this, tickers silently stop
      this.flushSubscriptions();

      // start periodic Kafka flush
      this.startFlushLoop();
    });

    this.ws.on('message', (data) => {
      let msg: any;

      try {
        msg = JSON.parse(data.toString());
      } catch {
        logger.warn({ connId: this.id }, 'Failed to parse WS message');
        return;
      }

      this.processTicker(msg);

      // ---------- NORMAL PROCESSING ----------
      switch (msg.channel) {
        case 'heartbeat':
          logger.trace(
            { connId: this.id, product: msg.product_id },
            'Heartbeat'
          );
          break;
        case 'subscriptions':
          logger.info(
            { connId: this.id, channels: msg.events },
            'Subscription acknowledged'
          );
          break;
        case 'error':
          logger.error(
            { connId: this.id, msg },
            'Coinbase error message'
          );
          break;
        case 'ticker':
          break;
        default:
          logger.debug(
            { connId: this.id, type: msg.type },
            'Unhandled WS message'
          );
      }
    });

    this.ws.on('close', (code) => {
      if (this.shuttingDown) {
        logger.debug({ connId: this.id, code }, 'WebSocket closed during shutdown');
      } else {
        logger.warn({ connId: this.id, code }, 'WebSocket closed unexpectedly');
      }

      this.isReady = false;
      this.stopFlushLoop();   // stop flush loop
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      logger.error({ connId: this.id, err }, 'WebSocket error');
    });
  }

  private processTicker(msg: any) {
    const ticker = msg.events?.[0]?.tickers?.[0];
    if (ticker) {
      // keep only latest ticker per product within the interval
      this.tickerBuffer.set(ticker.product_id, {
        source: 'coinbase',
        ts: Date.now(),
        data: ticker
      });
    }
  }


  private startFlushLoop() {
    if (this.flushTimer) return;

    this.flushTimer = setInterval(async () => {
      if (!this.isReady || this.tickerBuffer.size === 0) return;

      const batch = Array.from(this.tickerBuffer.entries());


      if (!this.kafkaHealth.isAvailable()) {
        if (!this.kafkaDownLogged) {
          this.kafkaDownLogged = true;
        }
        // keep latest tickers, do not clear buffer
        return;
      }

      // Kafka is available again
      this.kafkaDownLogged = false;

      this.tickerBuffer.clear();

      try {
        await this.producer.send({
          topic: 'crypto.ticker.event.updated',
          messages: batch.map(([productId, payload]) => ({
            key: productId,
            value: JSON.stringify(payload)
          }))
        });

        logger.debug(
          { connId: this.id, count: batch.length },
          `Flushed ticker batch - ${(new Date(Date.now())).toLocaleString()}`
        );
      } catch (err) {
        logger.warn(
          { err: (err as Error).message },
          'Kafka ticker batch publish failed'
        );
        this.kafkaDownLogged = true;
      }
    }, this.flushIntervalMs);
  }

  private stopFlushLoop() {
    if (!this.flushTimer) return;
    clearInterval(this.flushTimer);
    this.flushTimer = undefined;
  }


  // ------------------------------------------------
  // Subscription API (NO network IO here)
  // ------------------------------------------------
  subscribe(productId: string) {
    if (this.products.has(productId)) return;

    this.products.add(productId);
    this.pendingSubs.add(productId);

    // Flush immediately if connection is already open
    if (this.isReady) {
      this.flushSubscriptions();
    }
  }

  unsubscribe(productId: string) {
    if (!this.products.delete(productId)) return;

    this.ws?.send(JSON.stringify({
      type: 'unsubscribe',
      channel: this.channel,
      product_ids: [productId],
    }));

    logger.debug({ connId: this.id, productId }, 'Unsubscribed');
  }

  // ------------------------------------------------
  // Network IO (rate-limited by caller)
  // ------------------------------------------------
  flushSubscriptions() {
    if (!this.isReady || this.pendingSubs.size === 0) return;

    const productIds = Array.from(this.pendingSubs);
    this.pendingSubs.clear();

    this.ws!.send(JSON.stringify({
      type: 'subscribe',
      channel: this.channel,
      product_ids: productIds,
    }));

    logger.info(
      { connId: this.id, channel: this.channel, productIds },
      'Flushed subscriptions'
    );
  }

  // ------------------------------------------------
  // Reconnect logic
  // ------------------------------------------------
  private scheduleReconnect() {
    if (this.shuttingDown) {
      logger.debug({ connId: this.id }, 'Reconnect skipped (shutting down)');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnects) {
      logger.error({ connId: this.id }, 'Reconnect limit reached');
      return;
    }

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
    this.reconnectAttempts++;

    setTimeout(() => this.connect(), delay);
  }

  close() {
    this.shuttingDown = true;
    this.stopFlushLoop();
    this.ws?.close();
  }

  get isOpen() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
