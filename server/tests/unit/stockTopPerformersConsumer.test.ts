// Mock cache to avoid Valkey connection
jest.mock('@/cache', () => ({
  cacheSet: jest.fn(),
}));

import { initStockTopPerformersConsumer } from '@/modules/stockTopPerformersConsumer';
import { cacheSet } from '@/cache';
import { STOCK_TOP_PERFORMERS_CACHE_KEY } from '@/constants/stocks';

describe('initStockTopPerformersConsumer (unit)', () => {
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
   * Ensures the consumer is correctly initialized and started.
   */
  test('starts stock top performers consumer', async () => {
    await initStockTopPerformersConsumer(kafka, io, logger);

    expect(consumer.connect).toHaveBeenCalled();
    expect(consumer.subscribe).toHaveBeenCalledWith({
      topic: 'stock.service.event.updated',
      fromBeginning: false,
    });
    expect(consumer.run).toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - valid performers payload
   * - cache latest performers
   * - emit update to global stock room
   */
  test('caches and emits stock top performers on valid payload', async () => {
    await initStockTopPerformersConsumer(kafka, io, logger);

    const payload = {
      data: [{ symbol: 'AAPL', change: 3.2 }],
    };

    await eachMessage({
      message: {
        value: Buffer.from(JSON.stringify(payload)),
      },
    });

    expect(cacheSet).toHaveBeenCalledWith(
      STOCK_TOP_PERFORMERS_CACHE_KEY,
      payload.data,
      15 * 60
    );

    expect(io.to).toHaveBeenCalledWith('stock.global');
    expect(io.emit).toHaveBeenCalledWith(
      'stockTopPerformersResponse',
      {
        status: 'success',
        data: payload.data,
        error: null,
      }
    );
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - payload missing required data is ignored
   * - no cache write or socket emission
   */
  test('ignores payload when data is missing', async () => {
    await initStockTopPerformersConsumer(kafka, io, logger);

    await eachMessage({
      message: {
        value: Buffer.from(JSON.stringify({})),
      },
    });

    expect(cacheSet).not.toHaveBeenCalled();
    expect(io.emit).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});
