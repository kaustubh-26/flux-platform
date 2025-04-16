/**
 * Raw Coinbase WS ticker payload.
 * Mirrors upstream schema exactly; all numeric values are strings.
 * Intended for transport (Kafka/BFF/UI), not in hot-path transformation.
 */
export interface CoinbaseTickerRaw {
  type: 'ticker';
  product_id: string;
  price: string;
  volume_24_h: string;
  low_24_h: string;
  high_24_h: string;
  low_52_w: string;
  high_52_w: string;
  price_percent_chg_24_h: string;
  best_bid: string;
  best_ask: string;
  best_bid_quantity: string;
  best_ask_quantity: string;
}
