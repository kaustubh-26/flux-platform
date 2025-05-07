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
let rateLimited = false;

async function getQuote(
  symbol: string,
  apiKey: string,
  axiosClient: AxiosInstance
) {
  if (rateLimited) return null;

  try {
    const res = await axiosClient.get(`${BASE_URL}/quote`, {
      params: { symbol, token: apiKey },
    });

    const parsed = quoteSchema.safeParse(res.data);
    if (!parsed.success || parsed.data.c <= 0) return null;

    return { symbol, ...parsed.data };
  } catch (err: any) {
    logger.warn({ symbol, err }, "Failed to fetch stock quote");
    if (err.response?.status === 429) {
      rateLimited = true;
      logger.warn("Rate limit hit. Backing off for 60s");
      await new Promise(res => setTimeout(res, 60_000));
    }
    return null;
  }
}
/*
 Rate limit calls with 2.1 s delay
 1 request ≈ every 2.1s

~28 requests/min -> safe

*/
async function getMultipleQuotes(
  symbols: string[],
  apiKey: string,
  axiosClient: AxiosInstance,
  delayMs = 2100
) {
  const quotes = [];

  rateLimited = false; // reset on new batch start

  const start = Date.now();
  logger.info({ symbolsCount: symbols.length, delayMs }, "Starting Finnhub batch");

  for (let i = 0; i < symbols.length; i++) {
    const quote = await getQuote(symbols[i], apiKey, axiosClient);
    if (quote) quotes.push(quote);

    // Finnhub free tier rate limit (30/min)
    await new Promise(res => setTimeout(res, delayMs));
  }

  logger.info({ durationMs: Date.now() - start, quotes: quotes.length }, "Finnhub batch complete");
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
let fetchInProgress = false;

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

  if (fetchInProgress) {
    logger.info("Top performers fetch already running, skipping new fetch");
    return null;
  }
  fetchInProgress = true;

  try {
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
  } finally {
    fetchInProgress = false;
  }
}
