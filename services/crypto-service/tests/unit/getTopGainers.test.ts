// Mock cache to avoid Valkey connection
jest.mock('@/cache', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
}));

// Mock market fetcher
jest.mock('@/modules/getMarkets', () => ({
  getMarkets: jest.fn(),
}));

// Mock mapper
jest.mock('@/mappers/marketToMoverData', () => ({
  marketToMoverData: jest.fn(),
}));

// Mock logger to silence output
jest.mock('@/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

import { getTopGainers } from '@/modules/topGainers';
import { cacheGet, cacheSet } from '@/cache';
import { getMarkets } from '@/modules/getMarkets';
import { marketToMoverData } from '@/mappers/marketToMoverData';

const FIXED_NOW = 1700000000000;

describe('getTopGainers (unit)', () => {
  let axiosClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);

    axiosClient = {};
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Purpose:
   * Ensures correct behavior when:
   * - cached top gainers exist
   * - function returns cached value immediately
   * - no upstream or transformation logic runs
   */
  test('returns cached top gainers when cache is available', async () => {
    const cachedData = [{ id: 'btc' }];

    (cacheGet as jest.Mock).mockResolvedValue(cachedData);

    const result = await getTopGainers(axiosClient, 5);

    expect(result).toEqual({
      status: 'success',
      source: 'cache',
      data: cachedData,
      timestamp: FIXED_NOW,
    });

    expect(getMarkets).not.toHaveBeenCalled();
    expect(marketToMoverData).not.toHaveBeenCalled();
    expect(cacheSet).not.toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Ensures correct behavior when:
   * - cache is empty
   * - upstream markets fetch succeeds
   * - filtered and transformed data is cached and returned
   */
  test('fetches markets, computes top gainers, caches and returns result', async () => {
    const markets = [
      {
        id: 'btc',
        total_volume: 1000,
        price_change_percentage_1h_in_currency: 2.5,
        market_cap_rank: 1,
      },
      {
        id: 'eth',
        total_volume: 2000,
        price_change_percentage_1h_in_currency: 1.2,
        market_cap_rank: 2,
      },
    ];

    const mapped = [{ id: 'btc', symbol: 'BTC' }];

    (cacheGet as jest.Mock).mockResolvedValue(null);
    (getMarkets as jest.Mock).mockResolvedValue(markets);
    (marketToMoverData as jest.Mock).mockReturnValue(mapped);

    const result = await getTopGainers(axiosClient, 1);

    expect(getMarkets).toHaveBeenCalledWith(axiosClient);
    expect(marketToMoverData).toHaveBeenCalledWith([markets[0]]);
    expect(cacheSet).toHaveBeenCalledWith(
      'crypto:top-gainers:1h:1',
      mapped,
      60
    );

    expect(result).toEqual({
      status: 'success',
      source: 'api',
      data: mapped,
      timestamp: FIXED_NOW,
    });
  });

  /**
   * Purpose:
   * Verifies graceful degradation:
   * - upstream market fetch fails
   * - function does not throw
   * - returns unavailable status with correct reason
   */
  test('returns unavailable result when upstream API fails', async () => {
    const err = { code: 'ECONNABORTED' };

    (cacheGet as jest.Mock).mockResolvedValue(null);
    (getMarkets as jest.Mock).mockRejectedValue(err);

    const result = await getTopGainers(axiosClient, 10);

    expect(result).toEqual({
      status: 'unavailable',
      reason: 'timeout',
      timestamp: FIXED_NOW,
    });

    expect(cacheSet).not.toHaveBeenCalled();
  });
});
