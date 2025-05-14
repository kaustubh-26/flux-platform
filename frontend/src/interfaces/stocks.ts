export interface StockPerformer {
    symbol: string;
    price: number;
    changePercent: number;
}

export interface StockTopPerformersPayload {
    status: 'success' | 'error';
    data?: {
        performers: StockPerformer[];
    };
    error?: string | null;
}

export interface StockMover {
  symbol: string;
  currentPrice: number;
  changePercent: number;
  change: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
}

export interface MetaObject {
  currency: string;
  exchanges: string[]
  market: string;
  source: string;
  timezone: string;
}

export interface StockTopMovers {
  timestamp: string;
  topGainers: StockMover[];
  topLosers: StockMover[];
}
