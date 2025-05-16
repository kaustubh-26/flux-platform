// Mock cache to avoid Valkey connection
jest.mock('@/cache', () => ({
  cacheSet: jest.fn(),
}));

import { initCryptoTopCoinsConsumer } from '@/modules/cryptoTopCoinsConsumer';
import { cacheSet } from '@/cache';
import {
  CRYPTO_GLOBAL_ROOM,
  CRYPTO_TOPCOINS_CACHE_KEY,
} from '@/constants/crypto';

describe('initCryptoTopCoinsConsumer (unit)', () => {
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
  test('starts crypto top coins consumer', async () => {
    await initCryptoTopCoinsConsumer(kafka, io, logger);

    expect(consumer.connect).toHaveBeenCalled();
    expect(consumer.subscribe).toHaveBeenCalledWith({
      topic: 'crypto.topcoins.event.updated',
      fromBeginning: false,
    });
    expect(consumer.run).toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - valid topCoins payload
   * - cache latest top coins
   * - emit update to global crypto room
   */
  test('caches and emits top coins on valid payload', async () => {
    await initCryptoTopCoinsConsumer(kafka, io, logger);

    const payload = {
      topCoins: [{ symbol: 'BTC' }, { symbol: 'ETH' }],
    };

    await eachMessage({
      message: {
        value: Buffer.from(JSON.stringify(payload)),
      },
    });

    expect(cacheSet).toHaveBeenCalledWith(
      CRYPTO_TOPCOINS_CACHE_KEY,
      payload,
      300
    );

    expect(io.to).toHaveBeenCalledWith(CRYPTO_GLOBAL_ROOM);
    expect(io.emit).toHaveBeenCalledWith('topCoinsResponse', {
      status: 'success',
      data: {
        topCoins: payload.topCoins,
      },
      error: null,
    });
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - payload missing required fields is ignored
   * - no cache write or socket emission occurs
   */
  test('ignores payload when topCoins is missing', async () => {
    await initCryptoTopCoinsConsumer(kafka, io, logger);

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
