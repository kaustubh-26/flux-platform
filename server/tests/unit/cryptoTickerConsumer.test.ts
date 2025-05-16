// Mock cache to avoid Valkey connection
jest.mock('@/cache', () => ({
  cacheSet: jest.fn(),
}));

import { initCryptoTickerConsumer } from '@/modules/cryptoTickerConsumer';
import { cacheSet } from '@/cache';
import {
  CRYPTO_TICKER_CACHE_KEY,
  CRYPTO_GLOBAL_ROOM,
} from '@/constants/crypto';

describe('initCryptoTickerConsumer (unit)', () => {
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
  test('starts crypto ticker consumer', async () => {
    await initCryptoTickerConsumer(kafka, io, logger);

    expect(consumer.connect).toHaveBeenCalled();
    expect(consumer.subscribe).toHaveBeenCalledWith({
      topic: 'crypto.ticker.event.updated',
      fromBeginning: false,
    });
    expect(consumer.run).toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - valid ticker payload
   * - cache latest snapshot with short TTL
   * - emit update to global crypto room
   */
  test('caches and emits crypto ticker update on valid payload', async () => {
    await initCryptoTickerConsumer(kafka, io, logger);

    const payload = {
      BTC: { price: 43000 },
      ETH: { price: 2400 },
    };

    await eachMessage({
      message: {
        value: Buffer.from(JSON.stringify(payload)),
      },
    });

    expect(cacheSet).toHaveBeenCalledWith(
      CRYPTO_TICKER_CACHE_KEY,
      payload,
      5
    );

    expect(io.to).toHaveBeenCalledWith(CRYPTO_GLOBAL_ROOM);
    expect(io.emit).toHaveBeenCalledWith('cryptoTickerResponse', {
      status: 'success',
      data: payload,
      error: null,
    });
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - empty or invalid payload is ignored
   * - no cache write or socket emission
   */
  test('ignores empty payload', async () => {
    await initCryptoTickerConsumer(kafka, io, logger);

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
