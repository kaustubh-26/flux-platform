// Mock cache to avoid Valkey connection
jest.mock('@/cache', () => ({
    cacheGet: jest.fn(),
    cacheSet: jest.fn(),
}));

// Mock circuit breaker behavior
jest.mock('@/modules/coingeckoBreaker', () => ({
    coinGeckoBreaker: {
        guard: jest.fn(),
        success: jest.fn(),
        failure: jest.fn(),
    },
}));

// Execute Bottleneck jobs immediately (no timing concerns in unit tests)
jest.mock('bottleneck', () => {
    return jest.fn().mockImplementation(() => ({
        schedule: (fn: any) => fn(),
    }));
});

import { getMarkets } from '@/modules/getMarkets';
import { cacheGet, cacheSet } from '@/cache';
import { coinGeckoBreaker } from '@/modules/coingeckoBreaker';

describe('getMarkets (unit)', () => {
    let axiosClient: any;

    beforeEach(() => {
        jest.clearAllMocks();

        axiosClient = {
            get: jest.fn(),
        };
    });

    /**
     * Purpose:
     * Ensures correct behavior when:
     * - cached market data exists
     * - function returns cached value immediately
     * - no upstream or breaker interaction occurs
     */
    test('returns cached markets when cache is available', async () => {
        const cachedMarkets = [{ id: 'btc' }];

        (cacheGet as jest.Mock).mockResolvedValue(cachedMarkets);

        const result = await getMarkets(axiosClient);

        expect(result).toEqual(cachedMarkets);
        expect(axiosClient.get).not.toHaveBeenCalled();
        expect(coinGeckoBreaker.guard).not.toHaveBeenCalled();
        expect(cacheSet).not.toHaveBeenCalled();
    });

    /**
     * Purpose:
     * Verifies system safety:
     * - when CoinGecko circuit breaker is open
     * - function fails fast
     * - no upstream call or cache write occurs
     */
    test('throws when CoinGecko circuit breaker is open', async () => {
        (cacheGet as jest.Mock).mockResolvedValue(null);
        (coinGeckoBreaker.guard as jest.Mock).mockReturnValue(false);

        await expect(getMarkets(axiosClient)).rejects.toThrow(
            'CoinGecko circuit open'
        );

        expect(axiosClient.get).not.toHaveBeenCalled();
        expect(cacheSet).not.toHaveBeenCalled();
    });

    /**
     * Purpose:
     * Ensures correct behavior when:
     * - cache is empty
     * - breaker allows request
     * - upstream call succeeds
     * - result is cached and returned
     */
    test('fetches markets, caches result and marks breaker success', async () => {
        const validMarket = {
            id: 'bitcoin',
            symbol: 'btc',
            name: 'Bitcoin',
            image: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',

            current_price: 43000,

            market_cap: 1000000,
            market_cap_rank: 1,

            total_volume: 500000,

            high_24h: 44000,
            low_24h: 42000,

            price_change_24h: 100,
            price_change_percentage_24h: 0.2,

            market_cap_change_24h: 10000,
            market_cap_change_percentage_24h: 1.1,

            circulating_supply: 19000000,
            total_supply: 21000000,
            max_supply: 21000000,

            ath: 69000,
            ath_change_percentage: -38,
            ath_date: '2021-11-10T00:00:00Z',

            atl: 67,
            atl_change_percentage: 64000,
            atl_date: '2013-07-06T00:00:00Z',

            roi: null,

            last_updated: '2026-01-29T10:00:00Z',
        };

        const apiResponse = [validMarket];

        (cacheGet as jest.Mock).mockResolvedValue(null);
        (coinGeckoBreaker.guard as jest.Mock).mockReturnValue(true);

        axiosClient.get.mockResolvedValue({
            data: apiResponse,
        });

        const result = await getMarkets(axiosClient);

        expect(axiosClient.get).toHaveBeenCalled();
        expect(cacheSet).toHaveBeenCalledWith(
            'crypto:markets:1h',
            apiResponse,
            60
        );
        expect(coinGeckoBreaker.success).toHaveBeenCalled();
        expect(result).toEqual(apiResponse);
    });

    /**
     * Purpose:
     * Verifies graceful degradation:
     * - upstream request fails
     * - breaker failure is recorded
     * - error is rethrown
     * - cache is not polluted
     */
    test('records breaker failure and rethrows on upstream error', async () => {
        const err = new Error('upstream failure');

        (cacheGet as jest.Mock).mockResolvedValue(null);
        (coinGeckoBreaker.guard as jest.Mock).mockReturnValue(true);

        axiosClient.get.mockRejectedValue(err);

        await expect(getMarkets(axiosClient)).rejects.toThrow(err);

        expect(coinGeckoBreaker.failure).toHaveBeenCalledWith(err);
        expect(cacheSet).not.toHaveBeenCalled();
    });
});
