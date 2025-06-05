/**
 * Integration Test:
 * Focus:
 * - Kafka -> Consumer -> Handler integration
 * - Verifies Kafka consumer integration and event flow
 * - Ensures correct interaction between Kafka broker and consumer integration
 */

import { Kafka, Partitioners, logLevel } from 'kafkajs';
import { KafkaContainer, StartedKafkaContainer } from '@testcontainers/kafka';
import pino from 'pino';

import { initStockConsumer } from '@/modules/stockConsumer';

// Allow enough time for Kafka container startup
jest.setTimeout(180_000);

describe('initStockConsumer (integration)', () => {
    let kafkaContainer: StartedKafkaContainer;
    let kafka: Kafka;
    let consumerInstance: any;

    // Real logger (silenced)
    const logger = pino({ level: 'silent' });

    beforeAll(async () => {
        kafkaContainer = await new KafkaContainer()
            .withStartupTimeout(120_000)
            .start();

        kafka = new Kafka({
            clientId: 'test-stock-consumer',
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
                    topic: 'stock.service.command.topperformers.refresh',
                    numPartitions: 1,
                    replicationFactor: 1,
                },
            ],
        });

        await admin.disconnect();
    });

    afterAll(async () => {
        if (consumerInstance) {
            await consumerInstance.stop();
        }

        await kafkaContainer.stop();
    });

    /**
     * Purpose:
     * Verifies Core behavior:
     * - Kafka message is consumed
     * - handler is invoked with correct topic
     */
    test('consumes Kafka message and invokes handler', async () => {
        const handler = jest.fn().mockResolvedValue(undefined);

        consumerInstance = initStockConsumer({
            broker: `${kafkaContainer.getHost()}:${kafkaContainer.getMappedPort(9093)}`,
            handler,
            fromBeginning: true,
        });

        await consumerInstance.start();

        const producer = kafka.producer({
            createPartitioner: Partitioners.LegacyPartitioner,
        });
        await producer.connect();

        await producer.send({
            topic: 'stock.service.command.topperformers.refresh',
            messages: [
                {
                    value: JSON.stringify({ trigger: 'refresh' }),
                },
            ],
        });

        /**
         * Deterministically wait for handler invocation
         */
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(
                () => reject(new Error('Handler was not invoked')),
                10_000
            );

            const interval = setInterval(() => {
                if (handler.mock.calls.length > 0) {
                    clearTimeout(timeout);
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        });

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0]).toBe(
            'stock.service.command.topperformers.refresh'
        );

        await producer.disconnect();
    });
});
