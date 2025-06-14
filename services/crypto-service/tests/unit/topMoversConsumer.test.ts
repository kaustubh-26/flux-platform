import { initTopMoversConsumer } from '@/modules/topMoversConsumer';

describe('initTopMoversConsumer (unit)', () => {
  let kafka: any;
  let consumer: any;
  let logger: any;
  let eachMessage: any;

  beforeEach(() => {
    /**
     * Mock Kafka consumer.
     * Capture the eachMessage handler for direct invocation.
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
     * Prevents real Kafka connections.
     */
    kafka = {
      consumer: jest.fn(() => consumer),
    };

    /**
     * Mock logger.
     * Logging output is not asserted.
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
   */
  test('starts Kafka consumer and subscribes to topic', async () => {
    await initTopMoversConsumer(
      kafka,
      logger,
      jest.fn(),
      { fromBeginning: false }
    );

    expect(kafka.consumer).toHaveBeenCalledWith({
      groupId: 'crypto-topmovers-group',
    });

    expect(consumer.connect).toHaveBeenCalled();

    expect(consumer.subscribe).toHaveBeenCalledWith({
      topic: 'crypto.service.command.topmovers.refresh',
      fromBeginning: false,
    });

    expect(consumer.run).toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - Kafka message is delegated to the provided handler
   * - topic and message are forwarded as-is
   */
  test('delegates topic and message to provided handler', async () => {
    const onMessage = jest.fn().mockResolvedValue(undefined);

    await initTopMoversConsumer(
      kafka,
      logger,
      onMessage,
      { fromBeginning: true }
    );

    const message = { value: Buffer.from('payload') };

    await eachMessage({
      topic: 'crypto.service.command.topmovers.refresh',
      message,
    });

    expect(onMessage).toHaveBeenCalledWith(
      'crypto.service.command.topmovers.refresh',
      message
    );
  });
});
