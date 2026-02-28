export default async function globalTeardown() {
  if (process.env.CI === 'true') {
    return;
  }
  
  console.log('Stopping shared Kafka container...');

  const container = (global as any).__KAFKA_CONTAINER__;

  if (container) {
    await container.stop();
    console.log('Kafka container stopped.');
  }
}