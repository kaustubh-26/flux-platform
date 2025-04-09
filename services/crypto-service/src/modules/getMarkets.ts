import { AxiosInstance } from "axios";
import { cacheGet, cacheSet } from "../cache";
import { CryptoMarket, CryptoMarketListSchema } from "../schemas/cryptoMarket.schema";
import { coinGeckoBreaker } from "./coingeckoBreaker";
import Bottleneck from "bottleneck";

export const coinGeckoLimiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 7000, // 1 request every 2.5s
});


const MARKETS_CACHE_KEY = "crypto:markets:1h";
const MARKETS_TTL = 60;

export async function getMarkets(
    axiosClient: AxiosInstance
): Promise<CryptoMarket[]> {

    const cached = await cacheGet<CryptoMarket[]>(MARKETS_CACHE_KEY);
    if (cached) return cached;

    if (!coinGeckoBreaker.guard()) {
        throw new Error("CoinGecko circuit open");
    }

    try {
        // Rate-limited upstream call
        const markets = await coinGeckoLimiter.schedule(async () => {
            const res = await axiosClient.get(
                "https://api.coingecko.com/api/v3/coins/markets",
                {
                    params: {
                        vs_currency: "usd",
                        order: "market_cap_desc",
                        per_page: 100,
                        page: 1,
                        price_change_percentage: "1h",
                    },
                }
            );

            return CryptoMarketListSchema.parse(res.data);
        });
        coinGeckoBreaker.success();

        await cacheSet(MARKETS_CACHE_KEY, markets, MARKETS_TTL);

        return markets;
    } catch (err) {
        coinGeckoBreaker.failure(err);
        throw err;
    }
}
