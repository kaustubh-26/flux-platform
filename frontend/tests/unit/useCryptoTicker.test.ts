import { renderHook, act } from '@testing-library/react';
import { useCryptoTickers } from '@/hooks/useCryptoTicker';
import { useSocket } from '@/context/socketContext';

/**
 * Unit Test Strategy:
 *
 * - Socket context is fully mocked
 * - No real socket connection
 * - Tests validate observable behavior only
 *
 * We verify:
 * - subscription guards
 * - payload validation
 * - incremental state updates
 * - cleanup on unmount
 */

jest.mock('@/context/socketContext', () => ({
  useSocket: jest.fn(),
}));

describe('useCryptoTickers (unit)', () => {
  const on = jest.fn();
  const off = jest.fn();

  const mockSocket = { on, off };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not subscribe when inactive or prerequisites are missing', () => {
    (useSocket as jest.Mock).mockReturnValue({
      socket: mockSocket,
      connected: false,
      userReady: true,
    });

    renderHook(() => useCryptoTickers(true));

    // Guard clause prevents any socket wiring
    expect(on).not.toHaveBeenCalled();
  });

  it('subscribes to ticker events when active and ready', () => {
    (useSocket as jest.Mock).mockReturnValue({
      socket: mockSocket,
      connected: true,
      userReady: true,
    });

    renderHook(() => useCryptoTickers(true));

    expect(on).toHaveBeenCalledWith(
      'cryptoTickerResponse',
      expect.any(Function)
    );
  });

  it('adds ticker data when valid ticker payload is received', () => {
    (useSocket as jest.Mock).mockReturnValue({
      socket: mockSocket,
      connected: true,
      userReady: true,
    });

    const { result } = renderHook(() => useCryptoTickers(true));

    // Extract registered handler
    const handler = on.mock.calls[0][1];

    const payload = {
      data: {
        data: {
          type: 'ticker',
          product_id: 'BTC-USD',
          price: '45000',
        },
      },
    };

    act(() => {
      handler(payload);
    });

    expect(result.current).toEqual({
      'BTC-USD': payload.data.data,
    });
  });

  it('ignores payloads that are not ticker events', () => {
    (useSocket as jest.Mock).mockReturnValue({
      socket: mockSocket,
      connected: true,
      userReady: true,
    });

    const { result } = renderHook(() => useCryptoTickers(true));
    const handler = on.mock.calls[0][1];

    act(() => {
      handler({}); // invalid
      handler({ data: { data: { type: 'snapshot' } } }); // non-ticker
    });

    // Defensive behavior: no state pollution
    expect(result.current).toEqual({});
  });

  it('cleans up socket listener on unmount', () => {
    (useSocket as jest.Mock).mockReturnValue({
      socket: mockSocket,
      connected: true,
      userReady: true,
    });

    const { unmount } = renderHook(() => useCryptoTickers(true));

    unmount();

    expect(off).toHaveBeenCalledWith(
      'cryptoTickerResponse',
      expect.any(Function)
    );
  });
});
