/**
 * Integration Test
 * Focus:
 * - Kafka -> Weather consumer -> Socket.IO integration
 * - Verifies correct room and event emission based on city
 */

import { Kafka, Partitioners, logLevel } from 'kafkajs';
import { KafkaContainer, StartedKafkaContainer } from '@testcontainers/kafka';
import pino from 'pino';

import { initWeatherConsumer } from '@/modules/weatherConsumer';

jest.setTimeout(180_000);

describe('initWeatherConsumer (integration)', () => {
    let kafkaContainer: StartedKafkaContainer;
    let kafka: Kafka;
    let consumer: any;

    // Real logger (silenced to avoid noisy test output)
    const logger = pino({ level: 'silent' });

    /**
     * Setup:
     * - Start Kafka using Testcontainers
     * - Create required topic for weather events
     */
    beforeAll(async () => {
        kafkaContainer = await new KafkaContainer()
            .withStartupTimeout(120_000)
            .start();

        kafka = new Kafka({
            clientId: 'test-weather-consumer',
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
                    topic: 'weather.service.event.updated',
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
     * - Stop Kafka container
     */
    afterAll(async () => {
        if (consumer) {
            await consumer.disconnect();
        }
        await kafkaContainer.stop();
    });

    /**
     * Purpose:
     * Verifies Core behavior:
     * - weather update Kafka event is consumed
     * - room is derived from city name
     * - correct Socket.IO event is emitted to the city-specific room
     */
    test('consumes weather update and emits city-scoped Socket.IO event', async () => {
        const producer = kafka.producer({
            createPartitioner: Partitioners.LegacyPartitioner,
        });
        await producer.connect();

        /**
         * Socket.IO mock:
         * - validates dynamic room and event name
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
        consumer = await initWeatherConsumer(kafka, io, logger, { fromBeginning: true });

        const payload = {
            status: 'success',
            data: {
                city: 'Mumbai',
                temperature: 32,
                humidity: 70,
            },
        };

        /**
         * Produce Kafka weather update
         */
        await producer.send({
            topic: 'weather.service.event.updated',
            messages: [{ value: JSON.stringify(payload) }],
        });

        /**
         * Allow asynchronous Kafka consumer loop to process message
         */
        await new Promise((resolve) => setTimeout(resolve, 2000));

        /**
         * Verifies:
         * - city-specific Socket.IO room is targeted
         * - correct dynamic event name is emitted
         * - emitted payload matches expected structure
         */
        expect(io.to).toHaveBeenCalledWith('weather.Mumbai');
        expect(emit).toHaveBeenCalledWith('weather.Mumbai.update', {
            status: 'success',
            data: payload.data,
        });

        await producer.disconnect();
    });
});
