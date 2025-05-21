/**
 * Integration Test
 * Focus:
 * - Valkey (Redis) cache integration
 * - Verifies availability, read/write, TTL, and graceful shutdown
 */

import { GenericContainer, StartedTestContainer } from 'testcontainers';

jest.setTimeout(120_000);

describe('cache (integration)', () => {
  let valkeyContainer: StartedTestContainer;

  let cacheAvailable: () => boolean;
  let cacheGet: <T>(key: string) => Promise<T | null>;
  let cacheSet: <T>(key: string, value: T, ttl: number) => Promise<void>;
  let shutdownCache: () => void;

  /**
   * Setup:
   * - Start Valkey using Testcontainers
   * - Set env vars BEFORE importing cache module
   * - Dynamically import cache module
   */
  beforeAll(async () => {
    valkeyContainer = await new GenericContainer('valkey/valkey:7.2')
      .withExposedPorts(6379)
      .start();

    process.env.VALKEY_HOST = valkeyContainer.getHost();
    process.env.VALKEY_PORT = String(valkeyContainer.getMappedPort(6379));

    // IMPORTANT:
    // Cache module must be imported AFTER env vars are set
    const cacheModule = await import('@/cache');

    cacheAvailable = cacheModule.cacheAvailable;
    cacheGet = cacheModule.cacheGet;
    cacheSet = cacheModule.cacheSet;
    shutdownCache = cacheModule.shutdownCache;
  });

  /**
   * Teardown:
   * - Shutdown cache client
   * - Stop Valkey container
   */
  afterAll(async () => {
    shutdownCache();

    // Allow ioredis to fully close sockets
    await new Promise((r) => setTimeout(r, 500));

    await valkeyContainer.stop();
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - cache becomes available when Valkey is reachable
   */
  test('cache becomes available after successful connection', async () => {
    // Allow connection event to fire
    await new Promise((r) => setTimeout(r, 300));

    expect(cacheAvailable()).toBe(true);
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - cacheSet stores JSON data
   * - cacheGet retrieves and parses JSON data
   */
  test('sets and gets cached values', async () => {
    const key = 'test:key';
    const value = { foo: 'bar', count: 42 };

    await cacheSet(key, value, 10);

    const cached = await cacheGet<typeof value>(key);

    expect(cached).toEqual(value);
  });

  /**
   * Purpose:
   * Verifies TTL behavior:
   * - cached value expires after TTL
   */
  test('cached value expires after TTL', async () => {
    const key = 'test:ttl';
    const value = { expires: true };

    await cacheSet(key, value, 1);

    // Immediately available
    expect(await cacheGet(key)).toEqual(value);

    // Wait for TTL to expire
    await new Promise((r) => setTimeout(r, 1200));

    expect(await cacheGet(key)).toBeNull();
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - cacheGet returns null when cache is unavailable
   * - cacheSet does not throw when cache is unavailable
   */
  test('gracefully degrades when cache is unavailable', async () => {
    shutdownCache();

    await expect(cacheSet('key', { a: 1 }, 10)).resolves.toBeUndefined();
    await expect(cacheGet('key')).resolves.toBeNull();
  });
});
