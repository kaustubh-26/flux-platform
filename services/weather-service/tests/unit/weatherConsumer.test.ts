import { startWeatherConsumer } from '@/modules/weatherConsumer';
import { WeatherService } from '@/modules/weather';
import { LocationSchema } from '@/interfaces/location';
import { logger } from '@/logger';

// Mocks (boundaries only)
jest.mock('@/modules/weather', () => ({
  WeatherService: jest.fn(),
}));

jest.mock('@/interfaces/location', () => ({
  LocationSchema: {
    safeParse: jest.fn(),
  },
}));

jest.mock('@/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('startWeatherConsumer (unit)', () => {
  let consumer: any;
  let producer: any;
  let eachMessage: any;

  beforeEach(() => {
    jest.clearAllMocks();

    consumer = {
      subscribe: jest.fn(),
      run: jest.fn(({ eachMessage: handler }) => {
        eachMessage = handler;
      }),
    };

    producer = {
      send: jest.fn(),
    };

    (WeatherService as jest.Mock).mockImplementation(() => ({
      getData: jest.fn(),
    }));
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - consumer subscribes to correct topic
   * - consumer is started
   */
  it('subscribes and starts the weather consumer', async () => {
    await startWeatherConsumer(consumer, producer);

    expect(consumer.subscribe).toHaveBeenCalledWith({
      topic: 'weather.service.command.fetch',
      fromBeginning: false,
    });

    expect(consumer.run).toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - valid payload is processed
   * - WeatherService is invoked
   * - result is published
   */
  it('processes valid location payload and publishes weather update', async () => {
    const weatherResponse = { status: 'success' };

    const getDataMock = jest.fn().mockResolvedValue(weatherResponse);
    (WeatherService as jest.Mock).mockImplementation(() => ({
      getData: getDataMock,
    }));

    (LocationSchema.safeParse as jest.Mock).mockReturnValue({
      success: true,
      data: { city: 'Mumbai' },
    });

    await startWeatherConsumer(consumer, producer);

    await eachMessage({
      topic: 'weather.service.command.fetch',
      message: {
        value: Buffer.from(JSON.stringify({ data: { city: 'Mumbai' } })),
      },
    });

    expect(getDataMock).toHaveBeenCalledWith('Mumbai');
    expect(producer.send).toHaveBeenCalledWith({
      topic: 'weather.service.event.updated',
      messages: [{ value: JSON.stringify(weatherResponse) }],
    });
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - invalid payload is ignored
   * - no service call
   * - no publish
   */
  it('ignores invalid location payload', async () => {
    (LocationSchema.safeParse as jest.Mock).mockReturnValue({
      success: false,
    });

    await startWeatherConsumer(consumer, producer);

    await eachMessage({
      topic: 'weather.service.command.fetch',
      message: {
        value: Buffer.from(JSON.stringify({ data: {} })),
      },
    });

    expect(producer.send).not.toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - empty message value is ignored
   * - no side effects occur
   */
  it('ignores messages without value', async () => {
    await startWeatherConsumer(consumer, producer);

    await eachMessage({
      topic: 'weather.service.command.fetch',
      message: {},
    });

    expect(producer.send).not.toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Verifies Error handling:
   * - unexpected errors are caught
   * - consumer does not crash
   * - error is logged
   */
  it('logs error when message processing throws', async () => {
    (LocationSchema.safeParse as jest.Mock).mockImplementation(() => {
      throw new Error('parse failed');
    });

    await startWeatherConsumer(consumer, producer);

    await eachMessage({
      topic: 'weather.service.command.fetch',
      message: {
        value: Buffer.from(JSON.stringify({ data: {} })),
      },
    });

    expect(logger.error).toHaveBeenCalled();
    expect(producer.send).not.toHaveBeenCalled();
  });
});