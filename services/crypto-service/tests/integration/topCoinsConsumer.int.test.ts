/**
 * Integration Test
 * Focus:
 * - Kafka -> TopCoins consumer integration
 * - Verifies Kafka message consumption and handler delegation
 */

import { Kafka, Partitioners, logLevel } from 'kafkajs';
import { KafkaContainer, StartedKafkaContainer } from '@testcontainers/kafka';
import pino from 'pino';

import { initTopCoinsConsumer } from '@/modules/topCoinsConsumer';

jest.setTimeout(180_000);

describe('initTopCoinsConsumer (integration)', () => {
  let kafkaContainer: StartedKafkaContainer;
  let kafka: Kafka;
  let producer: any;
  let consumer: any;

  // Real logger (silenced to keep test output clean)
  const logger = pino({ level: 'silent' });

  /**
   * Setup:
   * - Start real Kafka broker using Testcontainers
   * - Initialize Kafka producer
   */
  beforeAll(async () => {
    kafkaContainer = await new KafkaContainer()
      .withStartupTimeout(120_000)
      .start();

    kafka = new Kafka({
      clientId: 'test-topcoins',
      brokers: [
        `${kafkaContainer.getHost()}:${kafkaContainer.getMappedPort(9093)}`,
      ],
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

    await producer.disconnect();

    // Allow Kafka to drain before shutdown
    await new Promise((resolve) => setTimeout(resolve, 500));

    await kafkaContainer.stop();
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
