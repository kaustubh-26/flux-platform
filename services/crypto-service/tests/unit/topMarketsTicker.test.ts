// Mock axios to avoid real HTTP calls
jest.mock('axios', () => ({
  get: jest.fn(),
}));

// Mock cache to avoid Valkey connection
jest.mock('@/cache', () => ({
  cacheSet: jest.fn(),
}));

// Mock logger to silence output
jest.mock('@/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Imports
import axios from 'axios';
import { cacheSet } from '@/cache';

import {
  getTopCoins,
  getCoinbaseExploreList,
  startCoinbaseMarketsTicker,
  shutdownCoinbaseMarketsTicker,
  MARKETS_TOPCOINS_CACHE_KEY,
} from '@/modules/topMarketsTicker';

import { MultiConnectionCoinbaseClient } from '@/modules/coinbaseWsClient';

// Fixtures
const FIXED_NOW = 1700000000000;

const validMarket = {
  id: 'bitcoin',
  symbol: 'btc',
  name: 'Bitcoin',
  image: 'https://example.com/btc.png',
  current_price: 100,
  market_cap: 1000,
  market_cap_rank: 1,
  total_volume: 500,
  high_24h: 110,
  low_24h: 90,
  price_change_24h: 2,
  price_change_percentage_24h: 2,
  market_cap_change_24h: 10,
  market_cap_change_percentage_24h: 1,
  circulating_supply: 10,
  total_supply: 20,
  max_supply: 21,
  ath: 200,
  ath_change_percentage: -50,
  ath_date: '2021-11-10T00:00:00Z',
  atl: 1,
  atl_change_percentage: 10000,
  atl_date: '2013-07-06T00:00:00Z',
  roi: null,
  last_updated: '2026-01-29T10:00:00Z',
};

// Tests
describe('topMarketsTicker (unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Purpose:
   * Ensures correct behavior when:
   * - CoinGecko returns a valid market payload
   * - schema validation succeeds
   * - parsed market data is returned
   */
  test('getTopCoins returns parsed market data', async () => {
    (axios.get as jest.Mock).mockResolvedValueOnce({
      data: [validMarket],
    });

    const result = await getTopCoins(1);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('bitcoin');
  });

  /**
   * Purpose:
   * Ensures correct behavior when:
   * - multiple upstream APIs succeed
   * - tradable symbols are filtered
   * - prices are converted and mapped correctly
   */
  test('getCoinbaseExploreList returns transformed explore data', async () => {
    (axios.get as jest.Mock)
      // CoinGecko markets
      .mockResolvedValueOnce({ data: [validMarket] })
      // Coinbase tradable symbols
      .mockResolvedValueOnce({
        data: [{ base_currency: 'BTC', quote_currency: 'USD', status: 'online' }],
      })
      // USD → INR conversion
      .mockResolvedValueOnce({ data: { rates: { INR: 80 } } });

    const result = await getCoinbaseExploreList(1);

    expect(result[0].symbol).toBe('BTC-USD');
    expect(result[0].price_inr).toBe(8000);
  });

  /**
   * Purpose:
   * Ensures correct behavior when:
   * - service boots successfully
   * - top markets are fetched
   * - snapshot is cached with long TTL
   * - WebSocket client is instructed to subscribe
   *
   */
  test('startCoinbaseMarketsTicker subscribes to symbols and caches result', async () => {
    // Spy on infrastructure boundary (behavior, not implementation)
    const subscribeSpy = jest
      .spyOn(MultiConnectionCoinbaseClient.prototype, 'subscribe')
      .mockImplementation(() => {});

    const shutdownSpy = jest
      .spyOn(MultiConnectionCoinbaseClient.prototype, 'shutdown')
      .mockImplementation(() => {});

    (axios.get as jest.Mock)
      .mockResolvedValueOnce({ data: [validMarket] })
      .mockResolvedValueOnce({
        data: [{ base_currency: 'BTC', quote_currency: 'USD', status: 'online' }],
      })
      .mockResolvedValueOnce({ data: { rates: { INR: 80 } } });

    const coins = await startCoinbaseMarketsTicker({
      limit: 1,
      producer: {} as any,
      kafkaHealth: {} as any,
    });

    expect(cacheSet).toHaveBeenCalledWith(
      MARKETS_TOPCOINS_CACHE_KEY,
      coins,
      86400
    );

    expect(subscribeSpy).toHaveBeenCalledWith('BTC-USD');

    shutdownCoinbaseMarketsTicker('SIGTERM');
    expect(shutdownSpy).toHaveBeenCalled();
  });
});
