import { renderHook, act } from '@testing-library/react';
import { useStockTopPerformers } from '@/hooks/useStockTopPerformers';
import { useSocket } from '@/context/socketContext';

/**
 * Unit Test Strategy:
 *
 * - Socket context is fully mocked
 * - No real socket infrastructure
 * - Tests validate observable behavior only
 *
 * We verify:
 * - socket wiring
 * - initial request emission
 * - defensive payload handling
 * - state separation (data vs metaData)
 * - cleanup on unmount
 */

jest.mock('@/context/socketContext', () => ({
  useSocket: jest.fn(),
}));

describe('useStockTopPerformers (unit)', () => {
  const on = jest.fn();
  const off = jest.fn();
  const emit = jest.fn();

  const mockSocket = { on, off, emit };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when socket is unavailable', () => {
    (useSocket as jest.Mock).mockReturnValue({ socket: null });

    renderHook(() => useStockTopPerformers());

    // Guard clause prevents wiring
    expect(on).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('subscribes to response event and emits initial request when socket exists', () => {
    (useSocket as jest.Mock).mockReturnValue({ socket: mockSocket });

    renderHook(() => useStockTopPerformers());

    expect(on).toHaveBeenCalledWith(
      'stockTopPerformersResponse',
      expect.any(Function)
    );

    expect(emit).toHaveBeenCalledWith('stockTopPerformersRequest');
  });

  it('updates data and metaData when payload is successful', () => {
    (useSocket as jest.Mock).mockReturnValue({ socket: mockSocket });

    const { result } = renderHook(() => useStockTopPerformers());
    const handler = on.mock.calls[0][1];

    const payload = {
      status: 'success',
      data: {
        timestamp: '2026-01-01T10:00:00Z',
        topGainers: [{ symbol: 'AAPL', change: 2.5 }],
        topLosers: [{ symbol: 'TSLA', change: -1.8 }],
        meta: { source: 'NSE', count: 2 },
      },
    };

    act(() => {
      handler(payload);
    });

    expect(result.current.data).toEqual({
      timestamp: payload.data.timestamp,
      topGainers: payload.data.topGainers,
      topLosers: payload.data.topLosers,
    });

    expect(result.current.metaData).toEqual(payload.data.meta);
  });

  it('ignores invalid or non-success payloads', () => {
    (useSocket as jest.Mock).mockReturnValue({ socket: mockSocket });

    const { result } = renderHook(() => useStockTopPerformers());
    const handler = on.mock.calls[0][1];

    act(() => {
      handler({ status: 'error' });
      handler({ status: 'success' }); // missing data
    });

    // Defensive behavior: state remains unchanged
    expect(result.current.data).toBeNull();
    expect(result.current.metaData).toBeNull();
  });

  it('cleans up socket listener on unmount', () => {
    (useSocket as jest.Mock).mockReturnValue({ socket: mockSocket });

    const { unmount } = renderHook(() => useStockTopPerformers());

    unmount();

    expect(off).toHaveBeenCalledWith(
      'stockTopPerformersResponse',
      expect.any(Function)
    );
  });
});
