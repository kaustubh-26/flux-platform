jest.mock('@/cache', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
}));

import { initWeatherConsumer } from '@/modules/weatherConsumer';

describe('initWeatherConsumer (unit)', () => {
  let kafka: any;
  let consumer: any;
  let io: any;
  let logger: any;
  let eachMessage: any;

  beforeEach(() => {
    consumer = {
      connect: jest.fn(),
      subscribe: jest.fn(),
      run: jest.fn(({ eachMessage: handler }) => {
        eachMessage = handler;
      }),
    };

    kafka = {
      consumer: jest.fn(() => consumer),
    };

    io = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
  });

  /**
   * Purpose:
   * Ensure Kafka:
   * - consumer connects
   * - subscribes to topic
   * - starts message processing
   */
  test('starts weather consumer and subscribes to topic', async () => {
    await initWeatherConsumer(kafka, io, logger);

    expect(consumer.connect).toHaveBeenCalled();
    expect(consumer.subscribe).toHaveBeenCalledWith({
      topic: 'weather.service.event.updated',
      fromBeginning: false,
    });
    expect(consumer.run).toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - valid weather payload
   * - emit update to city-specific room
   */
  test('emits weather update to city room on valid payload', async () => {
    await initWeatherConsumer(kafka, io, logger);

    const payload = {
      status: 'success',
      data: {
        city: 'Pune',
        temp: 30,
      },
    };

    await eachMessage({
      message: {
        value: Buffer.from(JSON.stringify(payload)),
      },
    });

    expect(io.to).toHaveBeenCalledWith('weather.Pune');
    expect(io.emit).toHaveBeenCalledWith(
      'weather.Pune.update',
      {
        status: 'success',
        data: payload.data,
      }
    );
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - payload without city should be ignored
   * - no socket emission occurs
   */
  test('ignores payload when city is missing', async () => {
    await initWeatherConsumer(kafka, io, logger);

    const payload = {
      data: {
        temp: 25,
      },
    };

    await eachMessage({
      message: {
        value: Buffer.from(JSON.stringify(payload)),
      },
    });

    expect(io.emit).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});
