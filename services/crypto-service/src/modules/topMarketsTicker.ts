import axios from "axios";
import { MultiConnectionCoinbaseClient } from './coinbaseWsClient';
import { logger } from '../logger';
import { CryptoMarketListSchema } from "../schemas/cryptoMarket.schema";
import { Producer } from "kafkajs";
import { cacheSet } from "../cache";
import { KafkaHealth } from "../kafkaHealth";
import { TopCoin } from "../interfaces/topCoins";

export const MARKETS_TOPCOINS_CACHE_KEY = 'crypto:markets:topCoins';
const MARKETS_TOPCOINS_TTL = 86400; // 1 day
const TOP_COINS_REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours

let client: MultiConnectionCoinbaseClient;
let refreshTimer: NodeJS.Timeout | undefined;
let refreshInProgress = false;
let currentCoins: TopCoin[] = [];

const URL = "https://api.coingecko.com/api/v3/coins/markets";
const COINBASE_URL = "https://api.exchange.coinbase.com/products";
const FOREX_URL = "https://api.frankfurter.app/latest";

export async function getTopCoins(limit = 50) {
    const { data } = await axios.get(URL, {
        params: {
            vs_currency: "usd",
            order: "market_cap_desc",
            per_page: limit,
            page: 1,
            sparkline: false,
            price_change_percentage: "24h"
        }
    });

    const parsed = CryptoMarketListSchema.safeParse(data);

    if (!parsed.success) {
        logger.error(
            { issues: parsed.error.issues },
            "Invalid CoinGecko market payload"
        );
        throw new Error("CoinGecko market schema validation failed");
    }

    return parsed.data;
}

export async function getCoinbaseTradableSymbols(): Promise<Set<string>> {
    const { data } = await axios.get(COINBASE_URL);

    return new Set(
        data
            .filter(
                (p: any) =>
                    p.quote_currency === "USD" &&
                    p.status === "online"
            )
            .map((p: any) => p.base_currency)
    );
}


export async function getUsdToInrRate() {
    const { data } = await axios.get(FOREX_URL, {
        params: {
            from: "USD",
            to: "INR"
        }
    });

    return data.rates.INR;
}


export async function getCoinbaseExploreList(limit = 10): Promise<TopCoin[]> {
    const [coins, tradable, usdToInr] = await Promise.all([
        getTopCoins(100),
        getCoinbaseTradableSymbols(),
        getUsdToInrRate()
    ]);

    return coins
        .filter(
            (m) =>
                m.symbol &&
                tradable.has(m.symbol.toUpperCase()) &&
                m.current_price != null &&
                m.price_change_percentage_24h != null &&
                m.market_cap != null &&
                m.total_volume != null
        )
        .slice(0, limit)
        .map((m) => ({
            symbol: `${m.symbol.toUpperCase()}-USD`,
            name: m.name,
            price_inr: +(m.current_price * usdToInr).toFixed(2),
            change_24h: +m.price_change_percentage_24h!.toFixed(2),
            market_cap_inr: Math.round(m.market_cap! * usdToInr),
            volume_24h_inr: Math.round(m.total_volume! * usdToInr),
            tradable: true,
        }));
}

/**
 * Refresh top coins cache and resubscribe WS symbols.
 */
export async function refreshCoinbaseMarketsTicker(options?: {
    limit?: number;
    channel?: string;
    producer?: Producer;
    kafkaHealth?: KafkaHealth;
}) {
    if (refreshInProgress) {
        logger.info('Top coins refresh already in progress, skipping');
        return currentCoins;
    }

    refreshInProgress = true;

    try {
        const limit = options?.limit ?? 10;
        const channel = options?.channel ?? "ticker";
        const producer = options?.producer;
        const kafkaHealth = options?.kafkaHealth;

        const coins = await getCoinbaseExploreList(limit);
        logger.info({ count: coins.length }, "Refreshing Coinbase symbols");

        if (process.env.NODE_ENV === 'development') {
            logger.debug({ coins }, 'Coins snapshot');
        }

        await cacheSet(MARKETS_TOPCOINS_CACHE_KEY, coins, MARKETS_TOPCOINS_TTL);

        const canSubscribe = !!client || (producer && kafkaHealth);
        if (canSubscribe) {
            if (!client) {
                client = new MultiConnectionCoinbaseClient(channel, producer!, kafkaHealth!);
            }

            const nextSymbols = new Set(coins.map((coin) => coin.symbol));
            const currentSymbols = new Set(currentCoins.map((coin) => coin.symbol));

            for (const symbol of currentSymbols) {
                if (!nextSymbols.has(symbol)) {
                    client.unsubscribe(symbol);
                }
            }

            for (const symbol of nextSymbols) {
                if (!currentSymbols.has(symbol)) {
                    client.subscribe(symbol);
                }
            }
        }

        currentCoins = coins;
        return coins;
    } finally {
        refreshInProgress = false;
    }
}

/**
 * Start Coinbase WS subscriptions at service boot
 */
export async function startCoinbaseMarketsTicker(options?: {
    limit?: number;
    channel?: string;
    producer: Producer;
    kafkaHealth: KafkaHealth;
}) {
    const limit = options?.limit ?? 10;
    const channel = options?.channel ?? "ticker";
    const producer = options?.producer;
    const kafkaHealth = options?.kafkaHealth;
    const refreshOptions = { limit, channel, producer, kafkaHealth };

    logger.info({ limit, channel }, "Starting Coinbase MarketsTicker module");

    const coins = await refreshCoinbaseMarketsTicker(refreshOptions);

    if (!refreshTimer) {
        refreshTimer = setInterval(() => {
            refreshCoinbaseMarketsTicker(refreshOptions).catch((err) => {
                logger.error({ err }, "Top coins refresh failed");
            });
        }, TOP_COINS_REFRESH_INTERVAL_MS);

        logger.info('Top coins refresh scheduled (every 3 hours)');
    }


    return coins;
}

/**
 * Graceful shutdown
 */
export function shutdownCoinbaseMarketsTicker(signal?: string) {
    if (!client) return;

    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = undefined;
    }

    logger.info({ signal }, "Shutting down Coinbase explore module");
    client.shutdown();
    setTimeout(() => {
        if (process.env.NODE_ENV !== 'test') {
            process.exit(0);
        }
    }, 2000);

}
