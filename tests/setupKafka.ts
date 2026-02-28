import { KafkaContainer } from '@testcontainers/kafka';

export default async function globalSetup() {
  console.log('Starting shared Kafka container for integration tests...');

  const kafkaContainer = await new KafkaContainer()
    .withStartupTimeout(120_000) // CI is slower
    .start();

  const broker = `${kafkaContainer.getHost()}:${kafkaContainer.getMappedPort(9093)}`;

  // Store in env for tests
  process.env.KAFKA_BROKER = broker;

  // Store globally so teardown can access it
  (global as any).__KAFKA_CONTAINER__ = kafkaContainer;

  console.log(`Kafka started at ${broker}`);
}