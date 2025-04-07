import { CryptoMarketListSchema, CryptoMarket } from "../schemas/cryptoMarket.schema";

/**
 * CoinGecko Markets API endpoint
 */
// const COINGECKO_MARKETS_URL = process.env.COINGECKO_MARKETS_URL;

/**
 * Fetch top gainers based on:
 * 1. 1h price change percentage (DESC, rounded to 1 decimal)
 * 2. Spot volume (DESC)
 *
 * Data is validated using Zod before processing.
 *
 * @param limit number of coins to return (default: 10)
 */
export async function getTopGainers(
    axiosClient: any,
    COINGECKO_MARKETS_URL: string | undefined,
    limit: number = 10
): Promise<CryptoMarket[]> {
    const res = await axiosClient.get(COINGECKO_MARKETS_URL, {
        params: {
            vs_currency: "usd",
            order: "market_cap_desc",
            per_page: 100,
            page: 1,
            price_change_percentage: "1h",
        },
    });

    // Runtime validation + type inference
    const markets = CryptoMarketListSchema.parse(res.data);

    const sorted = markets
        .filter(
            (c) =>
                c.price_change_percentage_1h_in_currency !== undefined &&
                c.market_cap_rank !== null &&
                c.market_cap_rank <= 100
        )
        .sort((a, b) => {
            const aPct =
                Math.round(a.price_change_percentage_1h_in_currency! * 10) / 10;
            const bPct =
                Math.round(b.price_change_percentage_1h_in_currency! * 10) / 10;

            // Primary: rounded 1h % DESC
            if (bPct !== aPct) {
                return bPct - aPct;
            }

            // Secondary: spot volume DESC
            return b.total_volume - a.total_volume;
        });

    return sorted.slice(0, limit);
}
