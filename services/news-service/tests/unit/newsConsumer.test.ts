import { initNewsConsumer, stopNewsConsumer } from '@/modules/newsConsumer';
import { logger } from '@/logger';

jest.mock('@/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('newsConsumer (unit)', () => {
  /**
   * Purpose:
   * Verifies consumer initialization:
   * - Subscribes to the correct topic
   * - Starts Kafka consumer loop
   */
  test('subscribes to refresh command topic and starts consumer', async () => {
    const subscribe = jest.fn();
    const run = jest.fn();

    const consumer = {
      subscribe,
      run,
    } as any;

    const onRefreshCommand = jest.fn().mockResolvedValue(undefined);

    await initNewsConsumer({
      consumer,
      onRefreshCommand,
    });

    expect(subscribe).toHaveBeenCalledWith({
      topic: 'news.service.command.refresh',
      fromBeginning: false,
    });

    expect(run).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'Kafka consumer started (News service)'
    );
  });

  /**
   * Purpose:
   * Verifies message handling behavior:
   * - Kafka message triggers refresh handler
   * - Correct trigger source is passed
   */
  test('invokes refresh handler when Kafka message is received', async () => {
    let eachMessageHandler: any;

    const consumer = {
      subscribe: jest.fn(),
      run: jest.fn(({ eachMessage }) => {
        eachMessageHandler = eachMessage;
      }),
    } as any;

    const onRefreshCommand = jest.fn().mockResolvedValue(undefined);

    await initNewsConsumer({
      consumer,
      onRefreshCommand,
    });

    await eachMessageHandler({
      topic: 'news.service.command.refresh',
      message: {
        value: Buffer.from('refresh'),
      },
    });

    expect(onRefreshCommand).toHaveBeenCalledWith('bff');
  });

  /**
   * Purpose:
   * Verifies defensive behavior:
   * - Errors inside refresh handler are caught
   * - Consumer does not crash
   * - Error is logged
   */
  test('logs error when refresh handler throws', async () => {
    let eachMessageHandler: any;

    const consumer = {
      subscribe: jest.fn(),
      run: jest.fn(({ eachMessage }) => {
        eachMessageHandler = eachMessage;
      }),
    } as any;

    const onRefreshCommand = jest
      .fn()
      .mockRejectedValue(new Error('handler failed'));

    await initNewsConsumer({
      consumer,
      onRefreshCommand,
    });

    await eachMessageHandler({
      topic: 'news.service.command.refresh',
      message: {
        value: Buffer.from('refresh'),
      },
    });

    expect(logger.error).toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Verifies shutdown behavior:
   * - Consumer disconnect is attempted
   * - Successful disconnect is logged
   */
  test('disconnects consumer on shutdown', async () => {
    const disconnect = jest.fn().mockResolvedValue(undefined);

    const consumer = {
      disconnect,
    } as any;

    await stopNewsConsumer(consumer);

    expect(disconnect).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'Kafka consumer disconnected'
    );
  });

  /**
   * Purpose:
   * Verifies defensive shutdown:
   * - Disconnect failure does not throw
   * - Error is logged
   */
  test('logs warning when consumer disconnect fails', async () => {
    const disconnect = jest
      .fn()
      .mockRejectedValue(new Error('disconnect failed'));

    const consumer = {
      disconnect,
    } as any;

    await expect(stopNewsConsumer(consumer)).resolves.not.toThrow();

    expect(logger.warn).toHaveBeenCalled();
  });
});
