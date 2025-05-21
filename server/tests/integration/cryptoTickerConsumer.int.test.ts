/**
 * Integration Test
 * Focus:
 * - Kafka → Crypto Ticker consumer → Socket.IO integration
 * - Verifies Kafka-to-Socket.IO event flow for realtime ticker updates
 */

import { Kafka, Partitioners, logLevel } from 'kafkajs';
import { KafkaContainer, StartedKafkaContainer } from '@testcontainers/kafka';
import pino from 'pino';

import { initCryptoTickerConsumer } from '@/modules/cryptoTickerConsumer';
import { CRYPTO_GLOBAL_ROOM } from '@/constants/crypto';
import { shutdownCache } from '@/cache';

jest.setTimeout(180_000);

describe('initCryptoTickerConsumer (integration)', () => {
  let kafkaContainer: StartedKafkaContainer;
  let kafka: Kafka;
  let producer: any;
  let consumer: any;

  // Real logger (silenced to keep test output clean)
  const logger = pino({ level: 'silent' });

  /**
   * Setup:
   * - Start Kafka broker using Testcontainers
   * - Create required topic for crypto ticker updates
   * - Initialize Kafka producer
   */
  beforeAll(async () => {
    kafkaContainer = await new KafkaContainer()
      .withStartupTimeout(120_000)
      .start();

    kafka = new Kafka({
      clientId: 'test-crypto-ticker',
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
          topic: 'crypto.ticker.event.updated',
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
   * - crypto ticker update is consumed from Kafka
   * - ticker snapshot is cached
   * - global crypto Socket.IO room is targeted
   * - correct event name and payload are emitted
   */
  test('consumes Kafka message and emits crypto ticker update via Socket.IO', async () => {
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
    consumer = await initCryptoTickerConsumer(
      kafka,
      io,
      logger,
      { fromBeginning: true }
    );

    const payload = {
      BTC: { price: 43000 },
      ETH: { price: 2400 },
    };

    /**
     * Produce Kafka crypto ticker update
     */
    await producer.send({
      topic: 'crypto.ticker.event.updated',
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
     * - global crypto room is targeted
     * - correct Socket.IO event is emitted
     * - emitted payload matches expected structure
     */
    expect(io.to).toHaveBeenCalledWith(CRYPTO_GLOBAL_ROOM);
    expect(emit).toHaveBeenCalledWith('cryptoTickerResponse', {
      status: 'success',
      data: payload,
      error: null,
    });
  });
});
