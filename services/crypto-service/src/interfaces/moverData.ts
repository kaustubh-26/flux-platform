export interface MoverData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  priceChangePercentage1h?: number;
  priceChangePercentage24h: number;
  high24h: number;
  low24h: number;
  marketCap: number;
  marketCapRank: number;
  totalVolume: number;
  lastUpdated: string;
}
