// Mock cache to avoid Valkey connection
jest.mock('@/cache', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
}));

import { sendLocationIfChanged } from '@/sendLocation';
import * as cache from '@/cache';

const FIXED_NOW = 1700000000000;

describe('sendLocationIfChanged (unit)', () => {
  let producer: any;
  let socket: any;
  let logger: any;
  let isKafkaReady: jest.Mock;

  const baseLocation = {
    lat: '1.23',
    lon: '4.56',
    city: 'Pune',
    region: 'MH',
    country: 'IN',
    ip: '127.0.0.1',
  };

  const payload = {
    event: 'location.update',
    userId: 'user-1',
    data: baseLocation,
    timestamp: '2026-01-29T10:00:00Z',
  };

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);

    producer = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    socket = { id: 'socket-123' };

    logger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    isKafkaReady = jest.fn().mockReturnValue(true);

    jest.spyOn(cache, 'cacheGet');
    jest.spyOn(cache, 'cacheSet');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Purpose:
   * Ensures correct behavior when:
   * - Kafka is available
   * - no previous location exists in cache
   * - location is cached and sent to Kafka
   */
  test('caches and sends location when no previous value exists', async () => {
    (cache.cacheGet as jest.Mock).mockResolvedValue(null);

    await sendLocationIfChanged(
      producer,
      socket,
      payload,
      logger,
      isKafkaReady
    );

    expect(cache.cacheSet).toHaveBeenCalledTimes(1);
    expect(producer.send).toHaveBeenCalledWith({
      topic: 'weather.service.command.fetch',
      messages: [{ key: socket.id, value: JSON.stringify(payload) }],
    });
  });

  /**
   * Purpose:
   * Verifies deduplication logic:
   * - same location within dedup window
   * - no Kafka send
   * - no cache update
   */
  test('skips sending when same location is received within dedup window', async () => {
    (cache.cacheGet as jest.Mock).mockResolvedValue({
      hash: JSON.stringify(payload.data),
      timestamp: FIXED_NOW - 1000,
    });

    await sendLocationIfChanged(
      producer,
      socket,
      payload,
      logger,
      isKafkaReady
    );

    expect(cache.cacheSet).not.toHaveBeenCalled();
    expect(producer.send).not.toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Verifies system safety:
   * - when Kafka is unavailable
   * - function exits early
   * - no cache or Kafka interaction occurs
   */
  test('does nothing when Kafka is not ready', async () => {
    isKafkaReady.mockReturnValue(false);

    await sendLocationIfChanged(
      producer,
      socket,
      payload,
      logger,
      isKafkaReady
    );

    expect(cache.cacheGet).not.toHaveBeenCalled();
    expect(cache.cacheSet).not.toHaveBeenCalled();
    expect(producer.send).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });
});
