/**
 * Mock logger to avoid noisy output during unit tests
 */
jest.mock('@/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

/**
 * Mock Bottleneck to execute scheduled jobs immediately
 * (no timing / rate-limit behavior in unit tests)
 */
jest.mock('bottleneck', () => {
  return jest.fn().mockImplementation(() => ({
    schedule: (fn: () => Promise<void>) => fn(),
  }));
});

/**
 * Mock CoinbaseWsConnection to avoid real WebSocket usage
 */
jest.mock('@/modules/coinbaseWsConnection', () => ({
  CoinbaseWsConnection: jest.fn(),
}));

import { MultiConnectionCoinbaseClient } from '@/modules/coinbaseWsClient';
import { CoinbaseWsConnection } from '@/modules/coinbaseWsConnection';

describe('MultiConnectionCoinbaseClient (unit)', () => {
  let producer: any;
  let kafkaHealth: any;
  let connections: Record<number, any>;
  let nextConnId: number;

  beforeEach(() => {
    jest.clearAllMocks();

    producer = {};
    kafkaHealth = {};
    connections = {};
    nextConnId = 0;

    /**
     * Controlled fake WebSocket connection
     * simulates internal state without real networking
     */
    (CoinbaseWsConnection as jest.Mock).mockImplementation(() => {
      const id = nextConnId++;

      const conn = {
        id,
        isOpen: true,
        products: new Set<string>(),

        connect: jest.fn(),
        close: jest.fn(),

        subscribe: jest.fn((productId: string) => {
          conn.products.add(productId);
        }),

        unsubscribe: jest.fn((productId: string) => {
          conn.products.delete(productId);
        }),

        flushSubscriptions: jest.fn(),
      };

      connections[id] = conn;
      return conn;
    });
  });

  /**
   * Purpose:
   * Ensures a WebSocket connection is created and connected
   * immediately during client initialization.
   */
  test('initializes with one active WebSocket connection', () => {
    new MultiConnectionCoinbaseClient('ticker', producer, kafkaHealth);

    expect(CoinbaseWsConnection).toHaveBeenCalledTimes(1);
    expect(connections[0].connect).toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - subscribing to a new product
   * - product assigned to an existing connection
   * - subscriptions flushed via rate limiter
   */
  test('subscribes product on existing connection', () => {
    const client = new MultiConnectionCoinbaseClient(
      'ticker',
      producer,
      kafkaHealth
    );

    client.subscribe('BTC-USD');

    expect(connections[0].subscribe).toHaveBeenCalledWith('BTC-USD');
    expect(connections[0].flushSubscriptions).toHaveBeenCalled();
    expect(connections[0].products.has('BTC-USD')).toBe(true);
  });

  /**
   * Purpose:
   * Verifies Idempotent behavior:
   * - subscribing the same product twice
   * - no duplicate subscribe or flush calls
   */
  test('does nothing when subscribing an already subscribed product', () => {
    const client = new MultiConnectionCoinbaseClient(
      'ticker',
      producer,
      kafkaHealth
    );

    client.subscribe('BTC-USD');
    client.subscribe('BTC-USD');

    expect(connections[0].subscribe).toHaveBeenCalledTimes(1);
    expect(connections[0].flushSubscriptions).toHaveBeenCalledTimes(1);
  });

  /**
   * Purpose:
   * Verifies Capacity behavior:
   * - when a connection reaches max subscription capacity
   * - a new WebSocket connection is created automatically
   */
  test('creates new connection when existing connection is at capacity', () => {
    const client = new MultiConnectionCoinbaseClient(
      'ticker',
      producer,
      kafkaHealth
    );

    // MAX_SUBS_PER_CONN = 10
    for (let i = 0; i < 10; i++) {
      client.subscribe(`PRODUCT-${i}`);
    }

    client.subscribe('EXTRA-PRODUCT');

    expect(CoinbaseWsConnection).toHaveBeenCalledTimes(2);
    expect(connections[1].subscribe).toHaveBeenCalledWith('EXTRA-PRODUCT');
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - unsubscribe removes product ownership
   * - unsubscribe triggers flush via rate limiter
   */
  test('unsubscribes product and flushes subscriptions', () => {
    const client = new MultiConnectionCoinbaseClient(
      'ticker',
      producer,
      kafkaHealth
    );

    client.subscribe('ETH-USD');
    client.unsubscribe('ETH-USD');

    expect(connections[0].unsubscribe).toHaveBeenCalledWith('ETH-USD');
    expect(connections[0].products.has('ETH-USD')).toBe(false);
    expect(connections[0].flushSubscriptions).toHaveBeenCalledTimes(2);
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - unsubscribing a non-existent product
   * - no crashes or side effects
   */
  test('ignores unsubscribe for unknown product', () => {
    const client = new MultiConnectionCoinbaseClient(
      'ticker',
      producer,
      kafkaHealth
    );

    expect(() => client.unsubscribe('UNKNOWN')).not.toThrow();
  });

  /**
   * Purpose:
   * Verifies Runtime visibility:
   * - stats accurately reflect connection state
   * - includes connection id, subscription count and open status
   */
  test('returns accurate connection stats', () => {
    const client = new MultiConnectionCoinbaseClient(
      'ticker',
      producer,
      kafkaHealth
    );

    client.subscribe('BTC-USD');
    client.subscribe('ETH-USD');

    expect(client.stats()).toEqual([
      {
        connId: 0,
        subs: 2,
        open: true,
      },
    ]);
  });

  /**
   * Purpose:
   * Verifies Graceful shutdown:
   * - all active connections are closed
   */
  test('closes all connections on shutdown', () => {
    const client = new MultiConnectionCoinbaseClient(
      'ticker',
      producer,
      kafkaHealth
    );

    client.subscribe('BTC-USD');
    client.shutdown();

    expect(connections[0].close).toHaveBeenCalled();
  });
});
