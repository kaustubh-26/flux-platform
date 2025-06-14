/**
 * Mock WebSocket (CommonJS constructor)
 */
jest.mock('ws', () => {
  const WS = jest.fn().mockImplementation(() => ({
    readyState: 1,
    send: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
  }));

  (WS as any).OPEN = 1;
  return WS;
});

/**
 * Mock logger
 */
jest.mock('@/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    trace: jest.fn(),
  },
}));

describe('CoinbaseWsConnection (unit)', () => {
  let CoinbaseWsConnection: any;
  let WebSocket: jest.Mock;
  let conn: any;
  let wsInstance: any;
  let producer: any;
  let kafkaHealth: any;

  beforeEach(() => {
    jest.resetModules();          // 🔑 CRITICAL
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Re-require AFTER mocks are applied
    WebSocket = require('ws');
    ({ CoinbaseWsConnection } = require('@/modules/coinbaseWsConnection'));

    producer = { send: jest.fn() };
    kafkaHealth = { isAvailable: jest.fn(() => true) };

    conn = new CoinbaseWsConnection(
      1,
      'wss://test',
      'ticker',
      3,
      producer,
      kafkaHealth,
      1000
    );

    conn.connect();

    wsInstance = WebSocket.mock.results[0].value;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Purpose:
   * Ensures WebSocket is created and listeners are registered.
   */
  test('opens websocket on connect()', () => {
    expect(WebSocket).toHaveBeenCalledWith('wss://test');
    expect(wsInstance.on).toHaveBeenCalledWith('open', expect.any(Function));
    expect(wsInstance.on).toHaveBeenCalledWith('message', expect.any(Function));
    expect(wsInstance.on).toHaveBeenCalledWith('close', expect.any(Function));
    expect(wsInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  /**
   * Purpose:
   * Verifies Runtime visibility:
   * - isOpen reflects websocket state
   */
  test('isOpen reflects websocket state', () => {
    expect(conn.isOpen).toBe(true);
  });
});
