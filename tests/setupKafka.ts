import { KafkaContainer, StartedKafkaContainer } from '@testcontainers/kafka';

export default async function globalSetup() {
    // If running in GitHub Actions, DO NOT start Testcontainers
    if (process.env.CI === 'true') {
        console.log('CI environment detected. Using GitHub Kafka service.');
        return;
    }
    
    console.log('Starting shared Kafka container for integration tests...');

    let kafkaContainer: StartedKafkaContainer;

    try {
        kafkaContainer = await new KafkaContainer()
            .withStartupTimeout(180_000) // CI is slower
            .start();
    } catch (err) {
        console.error('Kafka container failed to start:', err);
        throw err;
    }

    const broker = `${kafkaContainer.getHost()}:${kafkaContainer.getMappedPort(9093)}`;

    // Store in env for tests
    process.env.KAFKA_BROKER = broker;

    // Store globally so teardown can access it
    (global as any).__KAFKA_CONTAINER__ = kafkaContainer;

    console.log(`Kafka started at ${broker}`);
}