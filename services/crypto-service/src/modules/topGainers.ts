import { AxiosInstance } from "axios";
import { cacheGet, cacheSet } from "../cache";
import { MoverData } from "../interfaces/moverData";
import { MoverResult } from "../interfaces/moverResult";
import { logger } from "../logger";
import { marketToMoverData } from "../mappers/marketToMoverData";
import { getMarkets } from "./getMarkets";

const CACHE_KEY = (limit: number) => `crypto:top-gainers:1h:${limit}`;

const TTL_SECONDS = 60;

export async function getTopGainers(
    axiosClient: AxiosInstance,
    limit: number = 10
): Promise<MoverResult> {
    const eventTimestamp = Date.now();

    // Try cache first
    const cached = await cacheGet<MoverData[]>(CACHE_KEY(limit));
    if (cached) {
        return {
            status: 'success',
            source: 'cache',
            data: cached,
            timestamp: eventTimestamp
        };
    }

    try {
        const markets = await getMarkets(axiosClient);

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

        const topGainersData = sorted.slice(0, limit);

        const moverData = marketToMoverData(topGainersData)

        // Cache final result
        await cacheSet(CACHE_KEY(limit), moverData, TTL_SECONDS);

        return {
            status: 'success',
            source: 'api',
            data: moverData,
            timestamp: eventTimestamp
        };

    } catch (err: any) {
        logger.warn({ err }, "CoinGecko API failed");
        return {
            status: 'unavailable',
            reason:
                err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED'
                    ? 'timeout'
                    : 'api_error',
            timestamp: eventTimestamp,
        };
    }
}
