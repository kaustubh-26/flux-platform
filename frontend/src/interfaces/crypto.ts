export interface CryptoAsset {
    id: string;
    symbol: string;
    name: string;
    image: string;
    currentPrice: number;
    priceChangePercentage1h?: number;
    priceChangePercentage24h?: number;
    high24h?: number;
    low24h?: number;
    marketCap: number;
    marketCapRank: number;
    totalVolume: number;
    lastUpdated: string;
}

export interface CryptoMoversData {
    topGainers: {
        data: CryptoAsset[];
        timestamp: number;
    };
    topLosers: {
        data: CryptoAsset[];
        timestamp: number;
    };
}

export interface CryptoMoversPayload {
    status: 'success' | 'error';
    source?: 'cache' | 'api';
    data: CryptoMoversData;
}

export interface TopCoin {
  symbol: string;
  name: string;
  price_inr: number;
  change_24h: number;
  market_cap_inr: number;
  volume_24h_inr: number;
  tradable: boolean;
}

export interface CryptoTopCoinsData {
    topCoins: TopCoin[];
}

export interface CryptoTopCoinsPayload {
    status: 'success' | 'error';
    source?: 'cache' | 'api';
    data: CryptoTopCoinsData;
}