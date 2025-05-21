/**
 * Integration Test:
 * Focus:
 * - Kafka -> Consumer -> Socket.IO integration
 * - Verifies Kafka consumer integration and event flow
 * - Ensures correct interaction between Kafka, consumer logic, and Socket.IO
 */

import { Kafka, Partitioners, logLevel } from 'kafkajs';
import { KafkaContainer, StartedKafkaContainer } from '@testcontainers/kafka';
import pino from 'pino';

import { initCryptoTopCoinsConsumer } from '@/modules/cryptoTopCoinsConsumer';
import { CRYPTO_GLOBAL_ROOM } from '@/constants/crypto';
import { shutdownCache } from '@/cache';

// Allow enough time for Kafka container startup
jest.setTimeout(180_000);

describe('initCryptoTopCoinsConsumer (integration)', () => {
  let kafkaContainer: StartedKafkaContainer;
  let kafka: Kafka;
  let consumer: any;

  // Real logger (silenced to keep test output clean)
  const logger = pino({ level: 'silent' });

  /**
   * Setup:
   * - Start Kafka using Testcontainers
   * - Create required topic for the consumer
   */
  beforeAll(async () => {
    kafkaContainer = await new KafkaContainer()
      .withStartupTimeout(120_000)
      .start();

    kafka = new Kafka({
      clientId: 'test-crypto-topcoins',
      brokers: [
        `${kafkaContainer.getHost()}:${kafkaContainer.getMappedPort(9093)}`,
      ],
      logLevel: logLevel.NOTHING,
    });

    const admin = kafka.admin();
    await admin.connect();

    await admin.createTopics({
      topics: [
        {
          topic: 'crypto.topcoins.event.updated',
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
    shutdownCache();

    if (consumer) {
      await consumer.disconnect();
    }

    await kafkaContainer.stop();
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - Kafka message is consumed
   * - payload is parsed correctly
   * - top coins update is emitted to Socket.IO
   * - correct global crypto room is targeted
   */
  test('consumes Kafka message and emits top coins to Socket.IO', async () => {
    const producer = kafka.producer({
      createPartitioner: Partitioners.LegacyPartitioner,
    });
    await producer.connect();

    /**
     * Socket.IO mock:
     * - validates room targeting and emitted payload
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
    consumer = await initCryptoTopCoinsConsumer(kafka, io, logger, { fromBeginning: true });

    const payload = {
      topCoins: [
        { symbol: 'BTC', price: 45000 },
        { symbol: 'ETH', price: 3000 },
      ],
    };

    /**
     * Produce Kafka event
     */
    await producer.send({
      topic: 'crypto.topcoins.event.updated',
      messages: [{ value: JSON.stringify(payload) }],
    });

    /**
     * Allow async Kafka consumer loop to process message
     */
    await new Promise((resolve) => setTimeout(resolve, 2000));

    /**
     * Verifies:
     * - Socket.IO emission targets the correct global room
     * - emitted event and payload match expected structure
     */
    expect(io.to).toHaveBeenCalledWith(CRYPTO_GLOBAL_ROOM);
    expect(emit).toHaveBeenCalledWith('topCoinsResponse', {
      status: 'success',
      data: {
        topCoins: payload.topCoins,
      },
      error: null,
    });

    await producer.disconnect();
  });
});
