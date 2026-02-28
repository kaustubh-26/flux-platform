/**
 * Integration Test
 * Focus:
 * - Kafka -> TopMovers consumer integration
 * - Verifies Kafka message is consumed and delegated to handler
 */

import { Kafka, Partitioners, logLevel } from 'kafkajs';
import pino from 'pino';

import { initTopMoversConsumer } from '@/modules/topMoversConsumer';

jest.setTimeout(180_000);

describe('initTopMoversConsumer (integration)', () => {
  let kafka: Kafka;
  let producer: any;
  let consumer: any;

  // Real logger (silenced)
  const logger = pino({ level: 'silent' });

  /**
   * Setup:
   * - Connect to shared Kafka broker started in globalSetup
   * - Create producer
   */
  beforeAll(async () => {
    if (!process.env.KAFKA_BROKER) {
      throw new Error('KAFKA_BROKER is not set. Did globalSetup run?');
    }

    const kafkaBrokers = process.env.KAFKA_BROKER.split(',');

    kafka = new Kafka({
      clientId: 'test-topmovers',
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
   * - Stop Kafka container
   */
  afterAll(async () => {
    if (consumer) {
      await consumer.disconnect().catch(() => {});
    }

    if (producer) {
      await producer.disconnect().catch(() => { });
    }

    // Allow Kafka to drain
    await new Promise((resolve) => setTimeout(resolve, 500));

  });

  /**
   * Purpose:
   * Verifies wiring:
   * - Kafka message is consumed
   * - handler is invoked
   */
  test('consumes top movers refresh command from Kafka', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);

    /**
     * Start consumer with fromBeginning enabled
     * to ensure deterministic behavior.
     */
    consumer = await initTopMoversConsumer(kafka, logger, handler, { fromBeginning: true });

    /**
     * Produce Kafka message
     */
    await producer.send({
      topic: 'crypto.service.command.topmovers.refresh',
      messages: [
        {
          value: JSON.stringify({ trigger: true }),
        },
      ],
    });

    /**
     * Allow async Kafka loop to process message
     */
    await new Promise((resolve) => setTimeout(resolve, 2000));

    /**
     * Assert handler was invoked
     */
    expect(handler).toHaveBeenCalled();
  });
});
