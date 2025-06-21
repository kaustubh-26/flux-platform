import { renderHook, act, waitFor } from '@testing-library/react';
import { usePriceDelta } from '@/hooks/usePriceDelta';

/**
 * Unit Test:
 * What we verify:
 * - Direction is derived correctly from price changes
 * - Flash is triggered on change
 * - Flash automatically resets after the timeout
 * - Undefined / null inputs are handled defensively
 */

describe('usePriceDelta (unit)', () => {
    beforeEach(() => {
        // Use fake timers so the flash timeout is deterministic
        jest.useFakeTimers();
    });

    afterEach(() => {
        // Always restore real timers to avoid leaking state between tests
        jest.useRealTimers();
    });

    type Props = {
        price?: number | null;
    };
    type Result = {
        direction: 'up' | 'down' | null;
        flash: 'up' | 'down' | null;
    };
    it('does not set direction or flash on first price value', () => {
        const { result, rerender } = renderHook<Result, Props>(
            ({ price }: { price?: number | null }) => usePriceDelta(price ?? undefined),
            { initialProps: { price: undefined } }
        );

        // First valid price initializes previous reference only
        rerender({ price: 100 });

        expect(result.current.direction).toBeNull();
        expect(result.current.flash).toBeNull();
    });

    it('sets direction and flash to up when price increases', () => {
        const { result, rerender } = renderHook<Result, Props>(
            ({ price }) => usePriceDelta(price ?? undefined),
            { initialProps: { price: undefined } }
        );

        // Initialize previous price
        rerender({ price: 100 });

        // Increase price → direction derived
        rerender({ price: 110 });

        expect(result.current.direction).toBe('up');
        expect(result.current.flash).toBe('up');
    });

    it('sets direction and flash to down when price decreases', () => {
        const { result, rerender } = renderHook<Result, Props>(
            ({ price }) => usePriceDelta(price ?? undefined),
            { initialProps: { price: undefined } }
        );

        // Initialize previous price
        rerender({ price: 100 });

        // Decrease price → direction derived
        rerender({ price: 90 });

        expect(result.current.direction).toBe('down');
        expect(result.current.flash).toBe('down');
    });

    it('resets flash after timeout', async () => {
        const { result, rerender } = renderHook<Result, Props>(
            ({ price }) => usePriceDelta(price ?? undefined),
            { initialProps: { price: undefined } }
        );

        // Initialize previous price
        rerender({ price: 100 });

        // Trigger change
        rerender({ price: 105 });
        expect(result.current.flash).toBe('up');

        act(() => {
            jest.advanceTimersByTime(300);
        });

        await waitFor(() => {
            expect(result.current.flash).toBeNull();
        });
    });

    it('ignores updates when price is undefined or null', () => {

        const { result, rerender } = renderHook<Result, Props>(
            ({ price }: { price?: number | null }) => usePriceDelta(price ?? undefined),
            { initialProps: { price: 100 } }
        );

        rerender({ price: undefined });
        rerender({ price: null });

        expect(result.current.direction).toBeNull();
        expect(result.current.flash).toBeNull();
    });
});
