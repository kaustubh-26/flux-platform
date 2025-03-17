// sendLocationIfChanged.test.ts
import { sendLocationIfChanged } from '../src/sendLocation'
const DEDUP_WINDOW_MS = 2000;

describe('sendLocationIfChanged', () => {
  const FIXED_NOW = 1700000000000; // any fixed timestamp

  let valkeyClient: any;
  let producer: any;
  let socket: any;
  let logger: any;

  beforeEach(() => {
    // Mock Date.now so timing logic is deterministic
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);

    valkeyClient = {
      get: jest.fn(),
      set: jest.fn(),
    };

    producer = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    socket = { id: 'socket-123' };

    logger = {
      info: jest.fn(),
      error: jest.fn(),
    };
  });

  afterEach(() => {
    (Date.now as jest.Mock).mockRestore();
    jest.clearAllMocks();
  });

  const payload = {
    data: { lat: 1.23, lng: 4.56 },
  };

  test('sends location and caches when no previous value', async () => {
    valkeyClient.get.mockResolvedValue(null);

    await sendLocationIfChanged(valkeyClient, producer, socket, payload, logger);

    const expectedHash = JSON.stringify(payload.data);
    const ttlSeconds = Math.ceil(DEDUP_WINDOW_MS / 1000) + 60;

    expect(valkeyClient.set).toHaveBeenCalledWith(
      `loc_dedup:${socket.id}`,
      JSON.stringify({ hash: expectedHash, timestamp: FIXED_NOW }),
      'EX',
      ttlSeconds
    );

    expect(producer.send).toHaveBeenCalledWith({
      topic: 'user.location.reported',
      messages: [
        {
          key: socket.id,
          value: JSON.stringify(payload),
        },
      ],
    });

    expect(logger.info).toHaveBeenCalledWith(
      { socketId: socket.id },
      'Location update sent to Kafka'
    );
  });

  test('skips sending when same data within dedup window', async () => {
    const existing = {
      hash: JSON.stringify(payload.data),
      timestamp: FIXED_NOW - 1000, // within 2s window
    };
    valkeyClient.get.mockResolvedValue(JSON.stringify(existing));

    await sendLocationIfChanged(valkeyClient, producer, socket, payload, logger);

    expect(valkeyClient.set).not.toHaveBeenCalled();
    expect(producer.send).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('sends again when same data but outside dedup window', async () => {
    const existing = {
      hash: JSON.stringify(payload.data),
      timestamp: FIXED_NOW - 3000, // outside 2s window
    };
    valkeyClient.get.mockResolvedValue(JSON.stringify(existing));

    await sendLocationIfChanged(valkeyClient, producer, socket, payload, logger);

    expect(producer.send).toHaveBeenCalledTimes(1);
    expect(valkeyClient.set).toHaveBeenCalledTimes(1);
  });

  test('sends when data changed even within dedup window', async () => {
    const differentPayload = { data: { lat: 9.87, lng: 6.54 } };
    const existing = {
      hash: JSON.stringify(payload.data),
      timestamp: FIXED_NOW - 1000, // within window
    };
    valkeyClient.get.mockResolvedValue(JSON.stringify(existing));

    await sendLocationIfChanged(valkeyClient, producer, socket, differentPayload, logger);

    expect(producer.send).toHaveBeenCalledTimes(1);
    expect(valkeyClient.set).toHaveBeenCalledTimes(1);
  });

  test('logs error but does not throw when producer.send fails', async () => {
    valkeyClient.get.mockResolvedValue(null);
    const error = new Error('Kafka down');
    producer.send.mockRejectedValue(error);

    await sendLocationIfChanged(valkeyClient, producer, socket, payload, logger);

    expect(logger.error).toHaveBeenCalledWith(
      { err: error, socketId: socket.id },
      'Failed to process location update'
    );
    // still should have set cache
    expect(valkeyClient.set).toHaveBeenCalledTimes(1);
  });
});
