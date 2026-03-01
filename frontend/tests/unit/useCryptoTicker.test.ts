import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useCryptoTickers } from '@/hooks/useCryptoTicker';
import cryptoTickerReducer, {
  tickerReceived,
} from '@/store/cryptoTickerSlice';
import cryptoTopCoinsReducer from '@/store/cryptoTopCoinsSlice';
import type { CryptoTickerData } from '@/interfaces/cryptoTicker';
import { createElement, type ReactNode } from 'react';

/**
 * Unit Test:
 * We verify:
 * - Hook reads ticker map from Redux
 * - Returns empty object when store is empty
 * - Updates when ticker actions are dispatched
 */


const makeStore = () =>
  configureStore({
    reducer: {
      cryptoTicker: cryptoTickerReducer,
      cryptoTopCoins: cryptoTopCoinsReducer,
    },
  });

const makeWrapper =
  (store: ReturnType<typeof makeStore>) =>
  ({ children }: { children: ReactNode }) =>
    createElement(Provider, { store }, children);

const makeTicker = (
  overrides: Partial<CryptoTickerData> = {}
): CryptoTickerData => ({
  type: 'ticker',
  product_id: 'BTC-USD',
  price: '45000',
  volume_24_h: '0',
  low_24_h: '0',
  high_24_h: '0',
  low_52_w: '0',
  high_52_w: '0',
  price_percent_chg_24_h: '0',
  best_bid: '0',
  best_ask: '0',
  best_bid_quantity: '0',
  best_ask_quantity: '0',
  ...overrides,
});

describe('useCryptoTickers (unit)', () => {
  it('returns an empty object when no tickers are in the store', () => {
    const store = makeStore();

    const { result } = renderHook(() => useCryptoTickers(), {
      wrapper: makeWrapper(store),
    });

    expect(result.current).toEqual({});
  });

  it('returns ticker data from the store when available', () => {
    const store = makeStore();
    const ticker = makeTicker({ product_id: 'ETH-USD', price: '3000' });

    act(() => {
      store.dispatch(tickerReceived(ticker));
    });

    const { result } = renderHook(() => useCryptoTickers(), {
      wrapper: makeWrapper(store),
    });

    expect(result.current).toEqual({
      'ETH-USD': ticker,
    });
  });

  it('updates when new ticker events are dispatched', () => {
    const store = makeStore();

    const { result } = renderHook(() => useCryptoTickers(), {
      wrapper: makeWrapper(store),
    });

    const ticker = makeTicker({ product_id: 'SOL-USD', price: '180' });

    act(() => {
      store.dispatch(tickerReceived(ticker));
    });

    expect(result.current).toEqual({
      'SOL-USD': ticker,
    });
  });
});
