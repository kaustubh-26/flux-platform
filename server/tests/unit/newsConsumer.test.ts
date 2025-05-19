// Mock cache to avoid Valkey connection
jest.mock('@/cache', () => ({
  cacheSet: jest.fn(),
}));

import { initNewsConsumer } from '@/modules/newsConsumer';
import { cacheSet } from '@/cache';
import { NEWS_GLOBAL_CACHE_KEY } from '@/constants/news';

describe('initNewsConsumer (unit)', () => {
  let kafka: any;
  let consumer: any;
  let io: any;
  let logger: any;
  let eachMessage: any;

  beforeEach(() => {
    consumer = {
      connect: jest.fn(),
      subscribe: jest.fn(),
      run: jest.fn(({ eachMessage: handler }) => {
        eachMessage = handler;
      }),
    };

    kafka = {
      consumer: jest.fn(() => consumer),
    };

    io = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    };
  });

  /**
   * Purpose:
   * Verifies Kafka wiring (connect + subscribe + run).
   * This proves the consumer actually starts.
   */
  test('starts Kafka consumer and subscribes to topic', async () => {
    await initNewsConsumer(kafka, io, logger);

    expect(consumer.connect).toHaveBeenCalled();
    expect(consumer.subscribe).toHaveBeenCalledWith({
      topic: 'news.service.event.updated',
      fromBeginning: false,
    });
    expect(consumer.run).toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - valid news payload
   * - cache latest news
   * - emit to global socket room
   */
  test('caches and emits global news on valid payload', async () => {
    await initNewsConsumer(kafka, io, logger);

    const payload = {
      payload: {
        data: [{ title: 'News A' }],
      },
    };

    await eachMessage({
      message: {
        value: Buffer.from(JSON.stringify(payload)),
      },
    });

    expect(cacheSet).toHaveBeenCalledWith(
      NEWS_GLOBAL_CACHE_KEY,
      payload.payload.data,
      12 * 60
    );

    expect(io.to).toHaveBeenCalledWith('news.global');
    expect(io.emit).toHaveBeenCalledWith('newsUpdate', {
      status: 'success',
      scope: 'global',
      data: payload.payload.data,
    });
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - bad payload should not be cached
   * - bad payload should not be emitted
   */
  test('ignores invalid payload structure', async () => {
    await initNewsConsumer(kafka, io, logger);

    const payload = {
      payload: {
        data: { invalid: true },
      },
    };

    await eachMessage({
      message: {
        value: Buffer.from(JSON.stringify(payload)),
      },
    });

    expect(io.emit).not.toHaveBeenCalled();
    expect(cacheSet).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});
