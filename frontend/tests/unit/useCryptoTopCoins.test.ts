import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useCryptoTopCoins } from '@/hooks/useCryptoTopCoins';
import cryptoTopCoinsReducer, {
  topCoinsReceived,
} from '@/store/cryptoTopCoinsSlice';
import cryptoTickerReducer from '@/store/cryptoTickerSlice';
import type { TopCoin } from '@/interfaces/crypto';
import { createElement, type ReactNode } from 'react';

/**
 * Unit Test:
 * We verify:
 * - Hook reads top coins from Redux
 * - Returns empty list when store is empty
 * - Updates when actions are dispatched
 */

const makeStore = (preloadedTopCoins?: TopCoin[]) =>
  configureStore({
    reducer: {
      cryptoTopCoins: cryptoTopCoinsReducer,
      cryptoTicker: cryptoTickerReducer,
    },
    preloadedState: preloadedTopCoins
      ? {
          cryptoTopCoins: {
            items: preloadedTopCoins,
            status: 'ready',
            lastUpdated: Date.now(),
          },
          cryptoTicker: {
            byProductId: {},
            lastUpdatedById: {},
          },
        }
      : undefined,
  });

const makeWrapper =
  (store: ReturnType<typeof makeStore>) =>
  ({ children }: { children: ReactNode }) =>
    createElement(Provider, { store }, children);

describe('useCryptoTopCoins (unit)', () => {
  it('returns an empty list when no coins are in the store', () => {
    const store = makeStore();
    const { result } = renderHook(() => useCryptoTopCoins(), {
      wrapper: makeWrapper(store),
    });

    expect(result.current).toEqual([]);
  });

  it('returns top coins from the store when available', () => {
    const mockTopCoins: TopCoin[] = [
      { symbol: 'BTC', name: 'Bitcoin' } as TopCoin,
      { symbol: 'ETH', name: 'Ethereum' } as TopCoin,
    ];

    const store = makeStore(mockTopCoins);

    const { result } = renderHook(() => useCryptoTopCoins(), {
      wrapper: makeWrapper(store),
    });

    expect(result.current).toEqual(mockTopCoins);
  });

  it('reacts to store updates when coins are received', () => {
    const store = makeStore();

    const { result } = renderHook(() => useCryptoTopCoins(), {
      wrapper: makeWrapper(store),
    });

    const incoming: TopCoin[] = [
      { symbol: 'SOL', name: 'Solana' } as TopCoin,
    ];

    act(() => {
      store.dispatch(topCoinsReceived(incoming));
    });

    expect(result.current).toEqual(incoming);
  });
});
