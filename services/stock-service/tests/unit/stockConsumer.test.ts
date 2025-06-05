// Logger mock (silence output)
jest.mock('@/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// KafkaJS mock (MUST be defined before import)
const connect = jest.fn();
const subscribe = jest.fn();
const run = jest.fn();
const disconnect = jest.fn();

const mockConsumer = {
  connect,
  subscribe,
  run,
  disconnect,
};

jest.mock('kafkajs', () => ({
  Kafka: jest.fn().mockImplementation(() => ({
    consumer: jest.fn(() => mockConsumer),
  })),
  logLevel: {
    NOTHING: 0,
  },
}));

// Lazy import helper (isolated module state)
const loadModule = async () => {
  jest.resetModules();
  return await import('@/modules/stockConsumer');
};

describe('initStockConsumer (unit)', () => {
  const handler = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Purpose:
   * Verifies Kafka wiring:
   * - consumer connects
   * - subscribes to correct topic
   * - starts consumption loop
   *
   * Validates configuration only, not Kafka behavior.
   */
  test('starts Kafka consumer and subscribes to topic', async () => {
    const { initStockConsumer } = await loadModule();

    const consumer = initStockConsumer({
      broker: 'localhost:9092',
      handler,
    });

    await consumer.start();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith({
      topic: 'stock.service.command.topperformers.refresh',
      fromBeginning: false,
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  /**
   * Purpose:
   * Verifies lifecycle control:
   * - consumer disconnects cleanly
   */
  test('stops Kafka consumer cleanly', async () => {
    const { initStockConsumer } = await loadModule();

    const consumer = initStockConsumer({
      broker: 'localhost:9092',
      handler,
    });

    await consumer.stop();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
