/**
 * Integration Test
 * Focus:
 * - Kafka producer integration for location updates
 * - Verifies message publication to the expected Kafka topic
 */

import { Kafka, Partitioners, EachMessagePayload, logLevel } from 'kafkajs';
import pino from 'pino';

import { sendLocationIfChanged } from '@/sendLocation';
import { shutdownCache } from '@/cache';

jest.setTimeout(120_000);

describe('sendLocationIfChanged (Kafka integration)', () => {
  let kafka: Kafka;
  let producer: any;

  /**
   * Setup:
   * - Connect to shared Kafka broker started in globalSetup
   * - Initialize Kafka producer
   * - Initialize Kafka consumer subscribed to weather fetch command topic
   */
  beforeAll(async () => {
    if (!process.env.KAFKA_BROKER) {
      throw new Error('KAFKA_BROKER is not set. Did globalSetup run?');
    }

    const kafkaBrokers = process.env.KAFKA_BROKER.split(',');

    kafka = new Kafka({
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
   * - Disconnect producer and consumer
   * - Shutdown cache connections
   * - Stop Kafka container
   */
  afterAll(async () => {
    if (producer) {
      await producer.disconnect().catch(() => { });
    }

    // Defensive cleanup to avoid open handles
    shutdownCache();

  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - location update triggers Kafka publish
   * - message is written to the expected Kafka topic
   */
  test('publishes message to Kafka topic', async () => {
    /**
     * Minimal socket mock:
     * - only socket ID is required for this flow
     */
    const socket = { id: 'sock-1' } as any;

    const payload = {
      event: 'location.update',
      userId: 'user-42',
      timestamp: new Date().toISOString(),
      data: {
        lat: '1.23',
        lon: '4.56',
        city: 'Pune',
        region: 'MH',
        country: 'IN',
        ip: '127.0.0.1',
      },
    };

    const consumer = kafka.consumer({ groupId: `test-group-${Date.now()}` });
    await consumer.connect();
    await consumer.subscribe({
      topic: 'weather.service.command.fetch',
      fromBeginning: false,
    });

    /**
     * Collects messages received by the Kafka consumer
     */
    const received: string[] = [];

    /**
     * Start Kafka consumer processing loop
     */
    await consumer.run({
      eachMessage: async ({ message }: EachMessagePayload) => {
        if (message.value) {
          received.push(message.value.toString());
        }
      },
    });

    /**
     * Trigger producer logic
     * - condition callback returns true to force publish
     */
    await sendLocationIfChanged(
      producer,
      socket,
      payload,
      pino({ level: 'silent' }),
      () => true
    );

    /**
     * Allow asynchronous Kafka delivery
     */
    await new Promise((r) => setTimeout(r, 1000));

    /**
     * Verifies:
     * - exactly one Kafka message is published
     * - published payload matches expected structure
     */
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(JSON.stringify(payload));

    await consumer.disconnect();

  });
});
