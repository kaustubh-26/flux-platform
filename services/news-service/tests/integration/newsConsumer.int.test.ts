/**
 * Integration Test
 * Focus:
 * - Kafka -> News consumer -> refresh handler integration
 * - Verifies Kafka consumer wiring and real message consumption
 * - Ensures refresh command handler is triggered correctly
 */

import { Kafka, logLevel, Partitioners } from 'kafkajs';
import { initNewsConsumer, stopNewsConsumer } from '@/modules/newsConsumer';
import { shutdownCache } from '@/cache';
import { __resetNewsModuleState } from '@/modules/getNews';

jest.setTimeout(180_000);

describe('initNewsConsumer (integration)', () => {
  let kafka: Kafka;
  let producer: any;
  let consumer: any;

  /**
   * Setup:
   * - Connect to shared Kafka broker started in globalSetup
   * - Create required topic for refresh commands
   * - Initialize Kafka producer
   */
  beforeAll(async () => {
    if (!process.env.KAFKA_BROKER) {
      throw new Error('KAFKA_BROKER is not set. Did globalSetup run?');
    }

    const kafkaBrokers = process.env.KAFKA_BROKER.split(',');

    kafka = new Kafka({
      clientId: 'test-news-consumer',
      brokers: kafkaBrokers,
      logLevel: logLevel.NOTHING,
    });

    const admin = kafka.admin();
    await admin.connect();

    await admin.createTopics({
      topics: [
        {
          topic: 'news.service.command.refresh',
          numPartitions: 1,
          replicationFactor: 1,
        },
      ],
    });

    await admin.disconnect();

    producer = kafka.producer({
      createPartitioner: Partitioners.LegacyPartitioner,
    });
    await producer.connect();
  });

  // resets circuit breaker + inFlight map before each test
  beforeEach(() => {
    __resetNewsModuleState();
  });

  /**
   * Cleanup after each test:
   * - Disconnect consumer to avoid group leakage
   */
  afterEach(async () => {
    if (consumer) {
      await stopNewsConsumer(consumer).catch(() => {});
      consumer = null;
    }
  });

  /**
   * Teardown:
   * - Shutdown cache connections
   * - Disconnect producer
   * - Stop Kafka container
   */
  afterAll(async () => {
    shutdownCache();

    if (consumer) {
      await consumer.disconnect().catch(() => { });
    }

    if (producer) {
      await producer.disconnect().catch(() => {});
    }

    // Allow Kafka to drain
    await new Promise((resolve) => setTimeout(resolve, 500));

  });

  /**
   * Purpose:
   * Verifies core integration behavior:
   * - Kafka message is consumed by real consumer
   * - Refresh handler is invoked
   * - Correct trigger source is passed
   */
  test('consumes refresh command and invokes refresh handler', async () => {
    /**
     * Refresh handler mock
     */
    const onRefreshCommand = jest.fn().mockResolvedValue(undefined);

    consumer = kafka.consumer({
      groupId: `news-consumer-test-group-${Date.now()}`, // unique group per test
    });

    /**
     * Start consumer
     * - fromBeginning: true ensures deterministic behavior
     */
    await initNewsConsumer({
      consumer,
      onRefreshCommand,
      fromBeginning: true,
    });

    /**
     * Produce Kafka refresh command
     */
    await producer.send({
      topic: 'news.service.command.refresh',
      messages: [
        {
          value: JSON.stringify({ command: 'refresh' }),
        },
      ],
    });

    /**
     * Wait until handler is called (no flaky sleep)
     */
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Refresh handler was not invoked')),
        5000
      );

      onRefreshCommand.mockImplementationOnce(async () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    /**
     * Assertions
     */
    expect(onRefreshCommand).toHaveBeenCalledTimes(1);
    expect(onRefreshCommand).toHaveBeenCalledWith('bff');
  });
});
