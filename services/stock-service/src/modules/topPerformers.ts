import { AxiosInstance } from "axios";
import { logger } from "../logger";
import { quoteSchema, StockPerformance } from "../schemas/stock.schema";

// -------------------------------------------------
// Constants
// -------------------------------------------------
const BASE_URL = "https://finnhub.io/api/v1";

export const POPULAR_STOCKS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK.B",
  "UNH", "JNJ", "JPM", "V", "PG", "XOM", "HD", "CVX", "MA", "ABBV",
  "PFE", "AVGO", "COST", "DIS", "MRK", "KO", "PEP", "CSCO", "TMO",
  "ACN", "ADBE", "NKE", "WMT", "NFLX", "ABT", "LLY", "CRM", "MCD",
  "DHR", "VZ", "TXN", "NEE", "ORCL", "INTC", "PM", "QCOM", "UPS",
  "AMD", "HON", "RTX", "INTU", "LOW",
];

// -------------------------------------------------
// API calls
// -------------------------------------------------
async function getQuote(
  symbol: string,
  apiKey: string,
  axiosClient: AxiosInstance
) {
  try {
    const res = await axiosClient.get(`${BASE_URL}/quote`, {
      params: { symbol, token: apiKey },
    });

    const parsed = quoteSchema.safeParse(res.data);
    if (!parsed.success || parsed.data.c <= 0) return null;

    return { symbol, ...parsed.data };
  } catch (err) {
    logger.warn({ symbol, err }, "Failed to fetch stock quote");
    return null;
  }
}

async function getMultipleQuotes(
  symbols: string[],
  apiKey: string,
  axiosClient: AxiosInstance,
  delayMs = 1100
) {
  const quotes = [];

  for (let i = 0; i < symbols.length; i++) {
    const quote = await getQuote(symbols[i], apiKey, axiosClient);
    if (quote) quotes.push(quote);

    // Finnhub free tier rate limit (60/min)
    if ((i + 1) % 50 === 0) {
      await new Promise(res => setTimeout(res, delayMs));
    }
  }

  return quotes;
}

// -------------------------------------------------
// Calculations
// -------------------------------------------------
function calculatePerformance(quotes: any[]): StockPerformance[] {
  return quotes.map(q => {
    const change = q.c - q.pc;
    const changePercent = (change / q.pc) * 100;

    return {
      symbol: q.symbol,
      currentPrice: +q.c.toFixed(2),
      previousClose: +q.pc.toFixed(2),
      change: +change.toFixed(2),
      changePercent: +changePercent.toFixed(2),
      high: +q.h.toFixed(2),
      low: +q.l.toFixed(2),
      open: +q.o.toFixed(2),
    };
  });
}

// -------------------------------------------------
// Public API
// -------------------------------------------------
export async function getTopPerformers(params: {
  apiKey: string;
  axiosClient: AxiosInstance;
  limit?: number;
  sortBy?: keyof StockPerformance;
}) {
  const {
    apiKey,
    axiosClient,
    limit = 10,
    sortBy = "changePercent",
  } = params;

  const quotes = await getMultipleQuotes(
    POPULAR_STOCKS,
    apiKey,
    axiosClient
  );

  const performance = calculatePerformance(quotes);
  const sorted = [...performance].sort(
    (a, b) => (b[sortBy] as number) - (a[sortBy] as number)
  );

  return {
    meta: {
      source: 'Finnhub',
      market: 'US',
      exchanges: ['NYSE', 'NASDAQ'],
      currency: 'USD',
      timezone: 'UTC',
    },
    timestamp: new Date().toISOString(),
    topGainers: sorted.slice(0, limit),
    topLosers: sorted.slice(-limit).reverse(),
  };
}
