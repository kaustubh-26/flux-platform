import { CryptoMarket } from "../schemas/cryptoMarket.schema";
import { MoverData } from "../interfaces/moverData";

export function marketToMoverData(
  markets: CryptoMarket[]
): MoverData[] {
  return markets.map((coin) => ({
    id: coin.id,
    symbol: coin.symbol,
    name: coin.name,
    image: coin.image,

    currentPrice: coin.current_price,

    priceChangePercentage1h:
      coin.price_change_percentage_1h_in_currency ?? 0,

    priceChangePercentage24h:
      coin.price_change_percentage_24h ?? 0,

    high24h: coin.high_24h ?? coin.current_price,
    low24h: coin.low_24h ?? coin.current_price,

    marketCap: coin.market_cap ?? 0,
    marketCapRank: coin.market_cap_rank ?? Number.MAX_SAFE_INTEGER,

    totalVolume: coin.total_volume ?? 0,
    lastUpdated: coin.last_updated ?? new Date().toISOString(),
  }));
}
