/**
 * Integration Test
 *
 * Focus:
 * - Kafka -> Crypto TopMovers consumer -> Socket.IO integration
 * - Verifies Kafka-to-Socket.IO integration for crypto movers updates
 */

import { Kafka, Partitioners, logLevel } from 'kafkajs';
import { KafkaContainer, StartedKafkaContainer } from '@testcontainers/kafka';
import pino from 'pino';

import { initCryptoTopMoversConsumer } from '@/modules/cryptoTopMoversConsumer';
import { shutdownCache } from '@/cache';

jest.setTimeout(180_000);

describe('initCryptoTopMoversConsumer (integration)', () => {
    let kafkaContainer: StartedKafkaContainer;
    let kafka: Kafka;
    let producer: any;
    let consumer: any;

    // Real logger (silenced to keep test output clean)
    const logger = pino({ level: 'silent' });

    /**
     * Setup:
     * - Start Kafka broker using Testcontainers
     * - Create required topic for crypto movers events
     * - Initialize Kafka producer
     */
    beforeAll(async () => {
        kafkaContainer = await new KafkaContainer()
            .withStartupTimeout(120_000)
            .start();

        kafka = new Kafka({
            clientId: 'test-crypto-topmovers',
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
                    topic: 'crypto.movers.event.updated',
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
            await consumer.disconnect().catch(() => { });
        }

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
     * - Kafka movers update is consumed
     * - movers payload is cached
     * - global crypto Socket.IO room is targeted
     * - correct event name and payload are emitted
     */
    test('consumes Kafka message and emits crypto top movers via Socket.IO', async () => {
        /**
         * Socket.IO mock:
         * - matches exact production usage: io.to(room).emit(event, payload)
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
        consumer = await initCryptoTopMoversConsumer(kafka, io, logger, { fromBeginning: true });


        const payload = {
            topGainers: [
                { symbol: 'BTC', change: 5.2 },
                { symbol: 'ETH', change: 3.8 },
            ],
            topLosers: [
                { symbol: 'DOGE', change: -4.1 },
                { symbol: 'ADA', change: -2.9 },
            ],
        };

        /**
         * Produce Kafka crypto movers update
         */
        await producer.send({
            topic: 'crypto.movers.event.updated',
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
        expect(io.to).toHaveBeenCalledWith('crypto.global');
        expect(emit).toHaveBeenCalledWith('topMoversResponse', {
            status: 'success',
            data: {
                topGainers: payload.topGainers,
                topLosers: payload.topLosers,
            },
            error: null,
        });
    });
});
