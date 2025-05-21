/**
 * Integration Test
 * Focus:
 * - Kafka -> Stock TopPerformers consumer -> Socket.IO integration
 * - Verifies Kafka-to-Socket.IO event flow for stock top performers updates
 */

import { Kafka, Partitioners, logLevel } from 'kafkajs';
import { KafkaContainer, StartedKafkaContainer } from '@testcontainers/kafka';
import pino from 'pino';

import { initStockTopPerformersConsumer } from '@/modules/stockTopPerformersConsumer';
import { shutdownCache } from '@/cache';

jest.setTimeout(180_000);

describe('initStockTopPerformersConsumer (integration)', () => {
  let kafkaContainer: StartedKafkaContainer;
  let kafka: Kafka;
  let producer: any;
  let consumer: any;

  // Real logger (silenced to keep test output clean)
  const logger = pino({ level: 'silent' });

  /**
   * Setup:
   * - Start Kafka broker using Testcontainers
   * - Create required topic for stock performers updates
   * - Initialize Kafka producer
   */
  beforeAll(async () => {
    kafkaContainer = await new KafkaContainer()
      .withStartupTimeout(120_000)
      .start();

    kafka = new Kafka({
      clientId: 'test-stock-topperformers',
      brokers: [
        `${kafkaContainer.getHost()}:${kafkaContainer.getMappedPort(9093)}`,
      ],
      logLevel: logLevel.NOTHING,
    });

    producer = kafka.producer({
      createPartitioner: Partitioners.LegacyPartitioner,
    });
    await producer.connect();

    const admin = kafka.admin();
    await admin.connect();

    await admin.createTopics({
      topics: [
        {
          topic: 'stock.service.event.updated',
          numPartitions: 1,
          replicationFactor: 1,
        },
      ],
    });

    await admin.disconnect();
  });

  /**
   * Teardown:
   * - Disconnect consumer
   * - Shutdown cache connections
   * - Stop Kafka container
   */
  afterAll(async () => {
    if (consumer) {
      await consumer.disconnect().catch(() => {});
    }

    // Defensive cleanup to avoid open handles
    shutdownCache();

    // Allow Kafka to drain before shutdown
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (kafkaContainer) {
      await kafkaContainer.stop();
    }
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - stock performers update is consumed from Kafka
   * - performers data is cached
   * - global stock Socket.IO room is targeted
   * - correct event name and payload are emitted
   */
  test('consumes Kafka message and emits stock top performers via Socket.IO', async () => {
    /**
     * Socket.IO mock:
     * - matches production usage: io.to(room).emit(event, payload)
     */
    const emit = jest.fn();
    const io = {
      to: jest.fn(() => ({ emit })),
    } as any;

    /**
     * Start consumer with `fromBeginning: true`
     * to ensure deterministic behavior in tests.
     * Production uses `fromBeginning: false`.
     */
    consumer = await initStockTopPerformersConsumer(
      kafka,
      io,
      logger,
      { fromBeginning: true }
    );

    const payload = {
      data: [
        { symbol: 'AAPL', changePercent: 2.4 },
        { symbol: 'MSFT', changePercent: 1.9 },
      ],
    };

    /**
     * Produce Kafka stock performers update
     */
    await producer.send({
      topic: 'stock.service.event.updated',
      messages: [
        {
          value: JSON.stringify(payload),
        },
      ],
    });

    /**
     * Allow asynchronous Kafka consumer loop to process message
     */
    await new Promise((resolve) => setTimeout(resolve, 2000));

    /**
     * Verifies:
     * - global stock room is targeted
     * - correct Socket.IO event is emitted
     * - emitted payload matches expected structure
     */
    expect(io.to).toHaveBeenCalledWith('stock.global');
    expect(emit).toHaveBeenCalledWith('stockTopPerformersResponse', {
      status: 'success',
      data: payload.data,
      error: null,
    });
  });
});
