/**
 * Integration Test
 * Focus:
 * - Kafka -> Weather consumer -> Kafka producer integration
 * - Verifies Kafka wiring and message flow
 */

import { Kafka, logLevel, Partitioners } from 'kafkajs';
import { shutdownCache } from '@/cache';

jest.setTimeout(180_000);

/**
 * Mock WeatherService constructor
 * We mock behavior, not wiring.
 */
const mockGetData = jest.fn();

jest.mock('@/modules/weather', () => ({
  WeatherService: jest.fn(() => ({
    getData: mockGetData,
  })),
}));

describe('startWeatherConsumer (integration)', () => {
  let kafka: Kafka;
  let producer: any;
  let consumer: any;
  let startWeatherConsumer: any;

  /**
   * Setup:
   * - Start Kafka using Testcontainers
   * - Create required topics
   * - Initialize producer
   */
  beforeAll(async () => {
    if (!process.env.KAFKA_BROKER) {
      throw new Error('KAFKA_BROKER is not set. Did globalSetup run?');
    }

    const kafkaBrokers = process.env.KAFKA_BROKER.split(',');

    kafka = new Kafka({
      clientId: 'weather-int-test',
      brokers: kafkaBrokers,
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
          topic: 'weather.service.command.fetch',
          numPartitions: 1,
          replicationFactor: 1,
        },
        {
          topic: 'weather.service.event.updated',
          numPartitions: 1,
          replicationFactor: 1,
        },
      ],
    });

    await admin.disconnect();
  });

  /**
   * Cleanup after each test
   */
  afterEach(async () => {
    if (consumer) {
      await consumer.disconnect().catch(() => { });
    }
    mockGetData.mockReset();
  });

  /**
   * Teardown:
   * - Shutdown cache
   * - Stop Kafka container
   */
  afterAll(async () => {
    shutdownCache();

    if (consumer) {
      await consumer.disconnect().catch(() => { });
    }

    if (producer) {
      await producer.disconnect().catch(() => { });
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - Valid location payload is consumed
   * - WeatherService.getData is called
   * - Weather update is published to Kafka
   */
  test('consumes weather fetch command and publishes weather update', async () => {
    mockGetData.mockResolvedValue({
      status: 'success',
      source: 'api',
      data: { city: 'Mumbai' },
      timestamp: Date.now(),
    });

    /**
     * Output consumer to capture published weather updates
     */
    const outputConsumer = kafka.consumer({
      groupId: 'weather-output-int-test',
    });

    const publishedMessages: any[] = [];

    await outputConsumer.connect();
    await outputConsumer.subscribe({
      topic: 'weather.service.event.updated',
      fromBeginning: true,
    });

    await outputConsumer.run({
      eachMessage: async ({ message }) => {
        publishedMessages.push(
          JSON.parse(message.value!.toString())
        );
      },
    });

    /**
     * CRITICAL:
     * Import consumer AFTER mocks are applied
     */
    await jest.isolateModulesAsync(async () => {
      const mod = await import('@/modules/weatherConsumer');
      startWeatherConsumer = mod.startWeatherConsumer;
    });

    consumer = kafka.consumer({
      groupId: 'weather-consumer-int-test',
    });
    await consumer.connect();

    await startWeatherConsumer(consumer, producer);

    /**
     * Produce VALID location payload
     * (must satisfy LocationSchema exactly)
     */
    await producer.send({
      topic: 'weather.service.command.fetch',
      messages: [
        {
          value: JSON.stringify({
            data: {
              city: 'Mumbai',
              region: 'Maharashtra',
              country: 'India',
              lat: 19.076,
              lon: 72.8777,
              ip: '8.8.8.8',
            },
          }),
        },
      ],
    });

    /**
     * Allow Kafka consumer loop to process message
     */
    await new Promise((resolve) => setTimeout(resolve, 3000));

    /**
     * Assertions
     */
    expect(mockGetData).toHaveBeenCalledWith('Mumbai');
    expect(publishedMessages.length).toBe(1);
    expect(publishedMessages[0].status).toBe('success');

    await outputConsumer.disconnect();
  });
});
