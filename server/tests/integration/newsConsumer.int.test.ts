/**
 * Integration Test
 * Focus:
 * - Kafka -> News consumer -> Socket.IO integration
 * - Verifies Kafka-to-Socket.IO integration for global news updates
 */

import { Kafka, logLevel, Partitioners } from 'kafkajs';
import { initNewsConsumer } from '@/modules/newsConsumer';
import { shutdownCache } from '@/cache';

jest.setTimeout(180_000);

describe('initNewsConsumer (integration)', () => {
    let kafka: Kafka;
    let producer: any;
    let consumer: any;
    let logger: any;

    /**
     * Setup:
     * - Connect to shared Kafka broker started in globalSetup
     * - Create required topic for news events
     * - Initialize Kafka producer
     * - Prepare test logger
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

        producer = kafka.producer({
            createPartitioner: Partitioners.LegacyPartitioner,
        });
        await producer.connect();

        const admin = kafka.admin();
        await admin.connect();

        await admin.createTopics({
            topics: [
                {
                    topic: 'news.service.event.updated',
                    numPartitions: 1,
                    replicationFactor: 1,
                },
            ],
        });

        await admin.disconnect();

        /**
         * Lightweight logger mock:
         * - avoids noisy logs
         * - allows verification of debug paths
         */
        logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };
    });

    /**
     * Cleanup after each test:
     * - Ensure consumer disconnects cleanly
     * - Prevent Kafka group leakage across tests
     */
    afterEach(async () => {
        if (consumer) {
            try {
                await consumer.disconnect();
            } catch {
                // ignore disconnect errors during cleanup
            }
        }
    });

    /**
     * Teardown:
     * - Shutdown cache connections
     * - Stop Kafka container
     */
    afterAll(async () => {
        if (consumer) {
            await consumer.disconnect().catch(() => { });
        }

        if (producer) {
            await producer.disconnect().catch(() => { });
        }

        shutdownCache();

        // Allow Kafka to drain before shutdown
        await new Promise((resolve) => setTimeout(resolve, 500));

    });

    /**
     * Purpose:
     * Verifies Core behavior:
     * - Kafka news update is consumed
     * - global news Socket.IO room is targeted
     * - correct event name and payload are emitted
     */
    test('consumes Kafka message and emits news via Socket.IO', async () => {
        /**
         * Socket.IO mock:
         * - matches exact production usage: io.to(room).emit(event, payload)
         */
        const mockEmit = jest.fn();
        const io = {
            to: jest.fn(() => ({
                emit: mockEmit,
            })),
        } as any;

        /**
         * Start consumer with `fromBeginning: true`
         * to ensure deterministic behavior in tests.
         * Production uses `fromBeginning: false`.
         */
        consumer = await initNewsConsumer(kafka, io, logger, { fromBeginning: true });

        const payload = {
            payload: {
                data: [{ title: 'Kafka News Test' }],
            },
        };

        /**
         * Produce Kafka news update
         */
        await producer.send({
            topic: 'news.service.event.updated',
            messages: [
                {
                    key: 'news',
                    value: JSON.stringify(payload),
                },
            ],
        });

        /**
         * Allow asynchronous Kafka consumer loop to process message
         */
        await new Promise((resolve) => setTimeout(resolve, 3000));

        /**
         * Verifies:
         * - global news room is targeted
         * - correct event name is emitted
         * - emitted payload matches expected structure
         */
        expect(io.to).toHaveBeenCalledWith('news.global');
        expect(mockEmit).toHaveBeenCalledWith('newsUpdate', {
            status: 'success',
            scope: 'global',
            data: payload.payload.data,
        });

        /**
         * Confirms debug path executed
         */
        expect(logger.debug).toHaveBeenCalled();
    });
});
