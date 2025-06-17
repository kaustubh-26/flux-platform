/**
 * Integration Test
 * Focus:
 * - Kafka -> TopMovers consumer integration
 * - Verifies Kafka message is consumed and delegated to handler
 */

import { Kafka, Partitioners, logLevel } from 'kafkajs';
import { KafkaContainer, StartedKafkaContainer } from '@testcontainers/kafka';
import pino from 'pino';

import { initTopMoversConsumer } from '@/modules/topMoversConsumer';

jest.setTimeout(180_000);

describe('initTopMoversConsumer (integration)', () => {
  let kafkaContainer: StartedKafkaContainer;
  let kafka: Kafka;
  let producer: any;
  let consumer: any;

  // Real logger (silenced)
  const logger = pino({ level: 'silent' });

  /**
   * Setup:
   * - Start real Kafka broker
   * - Create producer
   */
  beforeAll(async () => {
    kafkaContainer = await new KafkaContainer()
      .withStartupTimeout(120_000)
      .start();

    kafka = new Kafka({
      clientId: 'test-topmovers',
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
   * - Stop Kafka container
   */
  afterAll(async () => {
    if (consumer) {
      await consumer.disconnect().catch(() => {});
    }

    await producer.disconnect();

    // Allow Kafka to drain
    await new Promise((resolve) => setTimeout(resolve, 500));

    await kafkaContainer.stop();
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
