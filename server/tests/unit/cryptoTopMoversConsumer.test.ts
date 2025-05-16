// Mock cache to avoid Valkey connection
jest.mock('@/cache', () => ({
  cacheSet: jest.fn(),
}));

import { initCryptoTopMoversConsumer } from '@/modules/cryptoTopMoversConsumer';
import { CRYPTO_MOVERS_CACHE_KEY } from '@/constants/crypto';
import { cacheSet } from '@/cache';

describe('initCryptoTopMoversConsumer (unit)', () => {
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
  test('starts crypto top movers consumer', async () => {
    await initCryptoTopMoversConsumer(kafka, io, logger);

    expect(consumer.connect).toHaveBeenCalled();
    expect(consumer.subscribe).toHaveBeenCalledWith({
      topic: 'crypto.movers.event.updated',
      fromBeginning: false,
    });
    expect(consumer.run).toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - valid top movers payload
   * - cache latest movers
   * - emit to global crypto room
   */
  test('caches and emits top movers on valid payload', async () => {
    await initCryptoTopMoversConsumer(kafka, io, logger);

    const payload = {
      topGainers: [{ symbol: 'BTC' }],
      topLosers: [{ symbol: 'ETH' }],
    };

    await eachMessage({
      message: {
        value: Buffer.from(JSON.stringify(payload)),
      },
    });

    expect(cacheSet).toHaveBeenCalledWith(
      CRYPTO_MOVERS_CACHE_KEY,
      payload,
      300
    );

    expect(io.to).toHaveBeenCalledWith('crypto.global');
    expect(io.emit).toHaveBeenCalledWith('topMoversResponse', {
      status: 'success',
      data: {
        topGainers: payload.topGainers,
        topLosers: payload.topLosers,
      },
      error: null,
    });
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - incomplete payload should be ignored
   * - no cache write or socket emission
   */
  test('ignores payload when required fields are missing', async () => {
    await initCryptoTopMoversConsumer(kafka, io, logger);

    await eachMessage({
      message: {
        value: Buffer.from(JSON.stringify({ topGainers: [] })),
      },
    });

    expect(cacheSet).not.toHaveBeenCalled();
    expect(io.emit).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});
