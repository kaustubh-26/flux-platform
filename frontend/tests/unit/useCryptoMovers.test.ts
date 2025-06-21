import { renderHook, act } from '@testing-library/react';
import { useTopMovers } from '@/hooks/useCryptoMovers';
import { useSocket } from '@/context/socketContext';

/**
 * Unit Test:
 * - Socket.IO is fully mocked
 * - We test observable behavior only:
 *   - event subscription
 *   - initial request emission
 *   - defensive payload handling
 *   - cleanup on unmount
 * */

jest.mock('@/context/socketContext', () => ({
  useSocket: jest.fn(),
}));

jest.mock('@/context/socketContext');

describe('useCryptoMovers (unit)', () => {
    const on = jest.fn();
    const off = jest.fn();
    const emit = jest.fn();

    const mockSocket = { on, off, emit };

    beforeEach(() => {
        jest.clearAllMocks();
        (useSocket as jest.Mock).mockReturnValue({ socket: mockSocket });
    });

    it('subscribes to response event and emits initial request on mount', () => {
        renderHook(() => useTopMovers());

        // Verifies correct wiring to socket layer
        expect(on).toHaveBeenCalledWith(
            'cryptoTopMoversResponse',
            expect.any(Function)
        );

        // Verifies initial fetch trigger
        expect(emit).toHaveBeenCalledWith('cryptoTopMoversRequest');
    });

    it('updates movers only when payload is successful and complete', () => {
        const { result } = renderHook(() => useTopMovers());

        // Extract the registered event handler
        const handler = on.mock.calls[0][1];

        const validPayload = {
            status: 'success',
            data: {
                topGainers: { data: [{ symbol: 'BTC' }] },
                topLosers: { data: [{ symbol: 'ETH' }] }
            }
        };

        act(() => {
            handler(validPayload);
        });

        // Hook exposes domain data only after validation passes
        expect(result.current).toEqual(validPayload.data);
    });

    it('ignores payloads that are unsuccessful or incomplete', () => {
        const { result } = renderHook(() => useTopMovers());
        const handler = on.mock.calls[0][1];

        act(() => {
            handler({ status: 'error' });
            handler({
                status: 'success',
                data: { topGainers: { data: [] } } // missing losers
            });
        });

        // Defensive behavior: no partial or failed state updates
        expect(result.current).toBeNull();
    });

    it('cleans up socket listener on unmount', () => {
        const { unmount } = renderHook(() => useTopMovers());

        unmount();

        // Ensures no listener leaks
        expect(off).toHaveBeenCalledWith(
            'cryptoTopMoversResponse',
            expect.any(Function)
        );
    });
});
