import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { createElement, type ReactNode } from 'react';
import { useTopMovers } from '@/hooks/useCryptoMovers';
import cryptoMoversReducer, {
  moversReceived,
} from '@/store/cryptoMoversSlice';
import cryptoTickerReducer from '@/store/cryptoTickerSlice';
import cryptoTopCoinsReducer from '@/store/cryptoTopCoinsSlice';
import cryptoPriceDeltaReducer from '@/store/cryptoPriceDeltaSlice';
import type { CryptoMoversData } from '@/interfaces/crypto';

/**
 * Unit Test:
 * We verify:
 * - Hook reads movers data from Redux
 * - Returns null when store is empty
 * - Updates when movers actions are dispatched
 */

const makeStore = (preloaded?: CryptoMoversData) =>
  configureStore({
    reducer: {
      cryptoMovers: cryptoMoversReducer,
      cryptoTicker: cryptoTickerReducer,
      cryptoTopCoins: cryptoTopCoinsReducer,
      cryptoPriceDelta: cryptoPriceDeltaReducer,
    },
    preloadedState: preloaded
      ? {
          cryptoMovers: {
            data: preloaded,
            status: 'ready',
            lastUpdated: Date.now(),
          },
          cryptoTicker: { byProductId: {}, lastUpdatedById: {} },
          cryptoTopCoins: { items: [], status: 'idle', lastUpdated: null },
          cryptoPriceDelta: { byProductId: {} },
        }
      : undefined,
  });

const makeWrapper =
  (store: ReturnType<typeof makeStore>) =>
  ({ children }: { children: ReactNode }) =>
    createElement(Provider, { store }, children);

describe('useCryptoMovers (unit)', () => {
  it('returns null when movers are not in the store', () => {
    const store = makeStore();
    const { result } = renderHook(() => useTopMovers(), {
      wrapper: makeWrapper(store),
    });

    expect(result.current).toBeNull();
  });

  it('returns movers from the store when available', () => {
    const data: CryptoMoversData = {
      topGainers: { data: [{ id: 'btc' } as any], timestamp: 0 },
      topLosers: { data: [{ id: 'eth' } as any], timestamp: 0 },
    };

    const store = makeStore(data);
    const { result } = renderHook(() => useTopMovers(), {
      wrapper: makeWrapper(store),
    });

    expect(result.current).toEqual(data);
  });

  it('updates when movers are received', () => {
    const store = makeStore();

    const { result } = renderHook(() => useTopMovers(), {
      wrapper: makeWrapper(store),
    });

    const incoming: CryptoMoversData = {
      topGainers: { data: [{ id: 'sol' } as any], timestamp: 0 },
      topLosers: { data: [{ id: 'xrp' } as any], timestamp: 0 },
    };

    act(() => {
      store.dispatch(moversReceived(incoming));
    });

    expect(result.current).toEqual(incoming);
  });
});
