import dotenv from 'dotenv';
import { Kafka, logLevel } from 'kafkajs';

dotenv.config();

const kafka = new Kafka({
    clientId: 'realtime-dashboard',
    brokers: [process.env.KAFKA_BROKER_ADDRESS || 'kafka:9092'],
    logLevel: logLevel.ERROR,
    retry: {
        initialRetryTime: 300,
        retries: 10,
    },
});

const admin = kafka.admin();

async function createTopics() {
    try {
        await admin.connect();

        const topics = [
            { topic: 'user.location.reported' },
            { topic: 'crypto.service.command.topmovers.refresh' },
            { topic: 'weather.service.command.fetch' },
            { topic: 'crypto.ticker.event.updated' },
            { topic: 'crypto.movers.event.updated' },
            { topic: 'news.service.event.updated' },
            { topic: 'stock.service.event.updated' },
            { topic: 'weather.service.event.updated' }
        ];

        const created = await admin.createTopics({
            topics,
            waitForLeaders: true,
        });

        console.log(
            created
                ? 'Kafka topics created successfully'
                : 'Kafka topics already exist (no new topics created)'
        );
    } catch (error) {
        console.error('Failed to create Kafka topics:', error);
    } finally {
        await admin.disconnect();
    }
}

createTopics();
