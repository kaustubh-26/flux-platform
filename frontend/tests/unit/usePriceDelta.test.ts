import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { createElement, type ReactNode } from 'react';
import { usePriceDelta } from '@/hooks/usePriceDelta';
import cryptoPriceDeltaReducer, {
  priceDeltaUpdated,
} from '@/store/cryptoPriceDeltaSlice';

/**
 * Unit Test:
 * We verify:
 * - Hook reads price delta state from Redux
 * - Direction and flash update on dispatched price changes
 * - Flash resets after the timeout
 */


const makeStore = () =>
  configureStore({
    reducer: {
      cryptoPriceDelta: cryptoPriceDeltaReducer,
    },
  });

const makeWrapper =
  (store: ReturnType<typeof makeStore>) =>
  ({ children }: { children: ReactNode }) =>
    createElement(Provider, { store }, children);

describe('usePriceDelta (unit)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns nulls when no entry exists', () => {
    const store = makeStore();
    const { result } = renderHook(() => usePriceDelta('BTC-USD'), {
      wrapper: makeWrapper(store),
    });

    expect(result.current.direction).toBeNull();
    expect(result.current.flash).toBeNull();
    expect(result.current.history).toEqual([]);
  });

  it('does not set direction on first price', () => {
    const store = makeStore();

    act(() => {
      store.dispatch(
        priceDeltaUpdated({ productId: 'BTC-USD', price: 100, at: 0 })
      );
    });

    const { result } = renderHook(() => usePriceDelta('BTC-USD'), {
      wrapper: makeWrapper(store),
    });

    expect(result.current.direction).toBeNull();
    expect(result.current.flash).toBeNull();
    expect(result.current.history).toHaveLength(1);
  });

  it('sets direction and flash on increase', () => {
    const store = makeStore();

    const { result } = renderHook(() => usePriceDelta('BTC-USD'), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      store.dispatch(
        priceDeltaUpdated({ productId: 'BTC-USD', price: 100, at: 0 })
      );
      store.dispatch(
        priceDeltaUpdated({ productId: 'BTC-USD', price: 110, at: 0 })
      );
    });

    expect(result.current.direction).toBe('up');
    expect(result.current.flash).toBe('up');
    expect(result.current.history).toHaveLength(2);
  });

  it('clears flash after timeout', () => {
    const store = makeStore();

    const { result } = renderHook(() => usePriceDelta('BTC-USD'), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      store.dispatch(
        priceDeltaUpdated({ productId: 'BTC-USD', price: 100, at: 0 })
      );
      store.dispatch(
        priceDeltaUpdated({ productId: 'BTC-USD', price: 105, at: 0 })
      );
    });

    expect(result.current.flash).toBe('up');

    act(() => {
      jest.advanceTimersByTime(600);
    });

    expect(result.current.flash).toBeNull();
  });

  it('caps history length to a rolling window', () => {
    const store = makeStore();

    act(() => {
      for (let i = 0; i < 80; i += 1) {
        store.dispatch(
          priceDeltaUpdated({
            productId: 'BTC-USD',
            price: 100 + i,
            at: i,
          })
        );
      }
    });

    const { result } = renderHook(() => usePriceDelta('BTC-USD'), {
      wrapper: makeWrapper(store),
    });

    expect(result.current.history).toHaveLength(60);
    expect(result.current.history[0].price).toBe(120);
    expect(result.current.history[59].price).toBe(179);
  });
});
