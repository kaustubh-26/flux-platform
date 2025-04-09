import { CryptoMarketListSchema, CryptoMarket } from "../schemas/cryptoMarket.schema";
import { coinGeckoBreaker } from "./coingeckoBreaker";

export async function getTopLosers(
    axiosClient: any,
    COINGECKO_MARKETS_URL: string | undefined,
    limit: number = 10
): Promise<CryptoMarket[]> {

    if (!coinGeckoBreaker.guard()) {
        return [];
    }

    try {
        const res = await axiosClient.get(COINGECKO_MARKETS_URL, {
            params: {
                vs_currency: "usd",
                order: "market_cap_desc",
                per_page: 100,
                page: 1,
                price_change_percentage: "1h",
            },
        });

        const markets = CryptoMarketListSchema.parse(res.data);

        coinGeckoBreaker.success();

        // existing sort logic...
         const sorted = markets
        .filter(
            (c) =>
                c.price_change_percentage_1h_in_currency != null &&
                c.market_cap_rank !== null &&
                c.market_cap_rank <= 100
        )
        .sort((a, b) => {
            const aPct =
                Math.round(a.price_change_percentage_1h_in_currency! * 10) / 10;
            const bPct =
                Math.round(b.price_change_percentage_1h_in_currency! * 10) / 10;

            // 1️⃣ Primary: rounded 1h % ASC (biggest losers first)
            if (aPct !== bPct) {
                return aPct - bPct;
            }

            // 2️⃣ Secondary: spot volume DESC
            return b.total_volume - a.total_volume;
        });

    return sorted.slice(0, limit);

    } catch (err) {
        coinGeckoBreaker.failure(err);
        return [];
    }
}
