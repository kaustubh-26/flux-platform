import { renderHook, act } from '@testing-library/react';
import { useTopNews } from '@/hooks/useTopNews';
import { useSocket } from '@/context/socketContext';

/**
 * Unit Test Strategy:
 *
 * - Socket context is fully mocked
 * - No real socket connection or infrastructure
 * - Tests validate observable behavior only
 *
 * We verify:
 * - socket wiring
 * - initial request emission
 * - defensive payload handling
 * - cleanup on unmount
 */

jest.mock('@/context/socketContext', () => ({
  useSocket: jest.fn(),
}));

describe('useTopNews (unit)', () => {
  const on = jest.fn();
  const off = jest.fn();
  const emit = jest.fn();

  const mockSocket = { on, off, emit };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when socket is not available', () => {
    (useSocket as jest.Mock).mockReturnValue({ socket: null });

    renderHook(() => useTopNews());

    // Guard clause prevents socket wiring
    expect(on).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('subscribes to updates and emits initial request when socket exists', () => {
    (useSocket as jest.Mock).mockReturnValue({ socket: mockSocket });

    renderHook(() => useTopNews());

    expect(on).toHaveBeenCalledWith(
      'newsUpdate',
      expect.any(Function)
    );

    // Initial fetch
    expect(emit).toHaveBeenCalledWith('topNewsRequest');
  });

  it('updates news only when payload is successful and data is an array', () => {
    (useSocket as jest.Mock).mockReturnValue({ socket: mockSocket });

    const { result } = renderHook(() => useTopNews());
    const handler = on.mock.calls[0][1];

    const payload = {
      status: 'success',
      data: [
        { title: 'Market Rally', source: 'Reuters' },
        { title: 'Crypto Update', source: 'Bloomberg' },
      ],
    };

    act(() => {
      handler(payload);
    });

    // Hook exposes news only after validation passes
    expect(result.current).toEqual(payload.data);
  });

  it('ignores unsuccessful or malformed payloads', () => {
    (useSocket as jest.Mock).mockReturnValue({ socket: mockSocket });

    const { result } = renderHook(() => useTopNews());
    const handler = on.mock.calls[0][1];

    act(() => {
      handler({ status: 'error' });
      handler({ status: 'success', data: {} }); // not an array
    });

    // Defensive behavior: state remains unchanged
    expect(result.current).toBeNull();
  });

  it('cleans up socket listener on unmount', () => {
    (useSocket as jest.Mock).mockReturnValue({ socket: mockSocket });

    const { unmount } = renderHook(() => useTopNews());

    unmount();

    expect(off).toHaveBeenCalledWith(
      'newsUpdate',
      expect.any(Function)
    );
  });
});
