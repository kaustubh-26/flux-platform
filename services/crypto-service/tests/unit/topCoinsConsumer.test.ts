import { initTopCoinsConsumer } from '@/modules/topCoinsConsumer';

describe('initTopCoinsConsumer (unit)', () => {
  let kafka: any;
  let consumer: any;
  let logger: any;
  let eachMessage: any;

  beforeEach(() => {
    /**
     * Mock Kafka consumer.
     * We capture the eachMessage handler so we can invoke it manually.
     */
    consumer = {
      connect: jest.fn(),
      subscribe: jest.fn(),
      run: jest.fn(({ eachMessage: handler }) => {
        eachMessage = handler;
      }),
    };

    /**
     * Mock Kafka instance.
     * Ensures no real Kafka connection is attempted.
     */
    kafka = {
      consumer: jest.fn(() => consumer),
    };

    /**
     * Mock logger.
     * Logging behavior itself is not asserted.
     */
    logger = {
      info: jest.fn(),
    };
  });

  /**
   * Purpose:
   * Verifies Kafka wiring:
   * - consumer is created
   * - connects successfully
   * - subscribes to the correct topic
   * - starts consuming messages
   *
   */
  test('starts Kafka consumer and subscribes to topic', async () => {
    await initTopCoinsConsumer(
      kafka,
      logger,
      jest.fn(),
      { fromBeginning: false }
    );

    expect(kafka.consumer).toHaveBeenCalledWith({
      groupId: 'crypto-topcoins-group',
    });

    expect(consumer.connect).toHaveBeenCalled();

    expect(consumer.subscribe).toHaveBeenCalledWith({
      topic: 'crypto.service.command.topcoins.refresh',
      fromBeginning: false,
    });

    expect(consumer.run).toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - a Kafka message triggers the provided handler
   */
  test('delegates message handling to provided handler', async () => {
    const onMessage = jest.fn().mockResolvedValue(undefined);

    await initTopCoinsConsumer(
      kafka,
      logger,
      onMessage,
      { fromBeginning: true }
    );

    await eachMessage({
      message: {
        value: Buffer.from('ignored'),
      },
    });

    expect(onMessage).toHaveBeenCalledTimes(1);
  });
});
