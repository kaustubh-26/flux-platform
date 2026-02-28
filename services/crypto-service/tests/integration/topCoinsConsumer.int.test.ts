/**
 * Integration Test
 * Focus:
 * - Kafka -> TopCoins consumer integration
 * - Verifies Kafka message consumption and handler delegation
 */

import { Kafka, Partitioners, logLevel } from 'kafkajs';
import pino from 'pino';

import { initTopCoinsConsumer } from '@/modules/topCoinsConsumer';

jest.setTimeout(180_000);

describe('initTopCoinsConsumer (integration)', () => {
  let kafka: Kafka;
  let producer: any;
  let consumer: any;

  // Real logger (silenced to keep test output clean)
  const logger = pino({ level: 'silent' });

  /**
   * Setup:
   * - Connect to shared Kafka broker started in globalSetup
   * - Initialize Kafka producer
   */
  beforeAll(async () => {
    if (!process.env.KAFKA_BROKER) {
      throw new Error('KAFKA_BROKER is not set. Did globalSetup run?');
    }

    const kafkaBrokers = process.env.KAFKA_BROKER.split(',');

    kafka = new Kafka({
      clientId: 'test-topcoins',
      brokers: kafkaBrokers,
      logLevel: logLevel.NOTHING,
    });

    producer = kafka.producer({
      createPartitioner: Partitioners.LegacyPartitioner,
    });

    await producer.connect();
  });

  /**
   * Teardown:
   * - Disconnect consumer
   * - Disconnect producer
   * - Stop Kafka container
   */
  afterAll(async () => {
    if (consumer) {
      await consumer.disconnect().catch(() => {});
    }

    if (producer) {
      await producer.disconnect().catch(() => { });
    }

    // Allow Kafka to drain before shutdown
    await new Promise((resolve) => setTimeout(resolve, 500));

  });

  /**
   * Purpose:
   * Verifies wiring:
   * - consumer subscribes to correct topic
   * - real Kafka message is consumed
   * - provided handler is invoked
   */
  test('consumes top coins refresh command from Kafka', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);

    /**
     * Start consumer with fromBeginning enabled
     * for deterministic behavior in tests.
     */
    consumer = await initTopCoinsConsumer(
      kafka,
      logger,
      handler,
      { fromBeginning: true }
    );

    /**
     * Produce Kafka message
     */
    await producer.send({
      topic: 'crypto.service.command.topcoins.refresh',
      messages: [
        {
          value: JSON.stringify({ trigger: true }),
        },
      ],
    });

    /**
     * Allow asynchronous Kafka consumer loop to process message
     */
    await new Promise((resolve) => setTimeout(resolve, 2000));

    /**
     * Assert handler was invoked
     */
    expect(handler).toHaveBeenCalled();
  });
});
