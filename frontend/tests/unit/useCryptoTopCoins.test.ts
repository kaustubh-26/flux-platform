import { renderHook, act } from '@testing-library/react';
import { useCryptoTopCoins } from '@/hooks/useCryptoTopCoins';
import { useSocket } from '@/context/socketContext';

/**
 * Unit Test Strategy:
 *
 * - Socket context is fully mocked
 * - No real socket connection or infrastructure
 * - Tests validate observable behavior only
 *
 * We verify:
 * - correct socket wiring
 * - initial request emission
 * - defensive payload handling
 * - cleanup on unmount
 */

jest.mock('@/context/socketContext', () => ({
  useSocket: jest.fn(),
}));

describe('useCryptoTopCoins (unit)', () => {
  const on = jest.fn();
  const off = jest.fn();
  const emit = jest.fn();

  const mockSocket = { on, off, emit };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when socket is not available', () => {
    (useSocket as jest.Mock).mockReturnValue({ socket: null });

    renderHook(() => useCryptoTopCoins());

    // Guard clause prevents wiring
    expect(on).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('subscribes to response event and emits initial request when socket is available', () => {
    (useSocket as jest.Mock).mockReturnValue({ socket: mockSocket });

    renderHook(() => useCryptoTopCoins());

    expect(on).toHaveBeenCalledWith(
      'cryptoTopCoinsResponse',
      expect.any(Function)
    );

    // Initial subscribe / fetch
    expect(emit).toHaveBeenCalledWith('cryptoTopCoinsRequest');
  });

  it('updates coins only when payload is successful and contains topCoins', () => {
    (useSocket as jest.Mock).mockReturnValue({ socket: mockSocket });

    const { result } = renderHook(() => useCryptoTopCoins());
    const handler = on.mock.calls[0][1];

    const payload = {
      status: 'success',
      data: {
        topCoins: [
          { symbol: 'BTC', rank: 1 },
          { symbol: 'ETH', rank: 2 },
        ],
      },
    };

    act(() => {
      handler(payload);
    });

    // Hook exposes domain data only after validation passes
    expect(result.current).toEqual(payload.data.topCoins);
  });

  it('ignores unsuccessful or malformed payloads', () => {
    (useSocket as jest.Mock).mockReturnValue({ socket: mockSocket });

    const { result } = renderHook(() => useCryptoTopCoins());
    const handler = on.mock.calls[0][1];

    act(() => {
      handler({ status: 'error' });
      handler({ status: 'success', data: {} });
    });

    // Defensive behavior: no partial state updates
    expect(result.current).toBeNull();
  });

  it('cleans up socket listener on unmount', () => {
    (useSocket as jest.Mock).mockReturnValue({ socket: mockSocket });

    const { unmount } = renderHook(() => useCryptoTopCoins());

    unmount();

    expect(off).toHaveBeenCalledWith(
      'cryptoTopCoinsResponse',
      expect.any(Function)
    );
  });
});
