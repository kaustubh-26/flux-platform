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
            {
                topic: 'user.location.reported'
            },
            {
                topic: 'weather.service.command.fetch'
            },
            {
                topic: 'weather.service.event.updated'
            },
            {
                topic: 'news.service.event.updated'
            },
            {
                topic: 'stock.service.event.updated'
            },
            {
                topic: 'crypto.service.event.updated'
            }
        ];

        const created = await admin.createTopics({
            topics,
            waitForLeaders: true,
        });

        if (created) {
            console.log('Topic created successfully');
        } else {
            console.log('Topic already existed (no new topics created)');
        }
    } catch (error) {
        console.error('Failed to create topic:', error);
    } finally {
        await admin.disconnect();
    }
}

createTopics();