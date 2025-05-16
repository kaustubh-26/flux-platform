/**
 * Focus:
 * - cache availability tracking
 * - safe read/write behavior
 * - defensive behavior when cache is unavailable
 */

import { EventEmitter } from 'events';

const mockRedis = new EventEmitter() as any;

mockRedis.get = jest.fn();
mockRedis.set = jest.fn();
mockRedis.disconnect = jest.fn();

// Mock ioredis BEFORE importing cache
jest.mock('ioredis', () => {
  return jest.fn(() => mockRedis);
});

jest.mock('@/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('cache module (unit)', () => {
  let cache: any;

  beforeEach(async () => {
    jest.resetModules();
    cache = await import('@/cache');

    mockRedis.get.mockReset();
    mockRedis.set.mockReset();
    mockRedis.disconnect.mockReset();
  });

  /**
   * Purpose:
   * Tracks cache availability based on Redis connection events.
   */
  test('updates availability on connect and error events', () => {
    mockRedis.emit('connect');
    expect(cache.cacheAvailable()).toBe(true);

    mockRedis.emit('error', new Error('redis down'));
    expect(cache.cacheAvailable()).toBe(false);
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - returns parsed value when cache is available
   */
  test('returns cached value when cache is available', async () => {
    mockRedis.emit('connect');
    mockRedis.get.mockResolvedValue(JSON.stringify({ a: 1 }));

    const result = await cache.cacheGet('key1');

    expect(result).toEqual({ a: 1 });
    expect(mockRedis.get).toHaveBeenCalledWith('key1');
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - returns null when cache is unavailable
   * - avoids Redis calls
   */
  test('returns null when cache is unavailable', async () => {
    mockRedis.emit('error', new Error('down'));

    const result = await cache.cacheGet('key1');

    expect(result).toBeNull();
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - writes value with TTL when cache is available
   */
  test('sets cache value with TTL when available', async () => {
    mockRedis.emit('connect');

    await cache.cacheSet('key1', { a: 1 }, 60);

    expect(mockRedis.set).toHaveBeenCalledWith(
      'key1',
      JSON.stringify({ a: 1 }),
      'EX',
      60
    );
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - no-op when cache is unavailable
   */
  test('does nothing when setting cache while unavailable', async () => {
    mockRedis.emit('error', new Error('down'));

    await cache.cacheSet('key1', { a: 1 }, 60);

    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Ensures graceful shutdown of cache client.
   */
  test('disconnects redis client on shutdown', () => {
    cache.shutdownCache();
    expect(mockRedis.disconnect).toHaveBeenCalled();
  });
});
