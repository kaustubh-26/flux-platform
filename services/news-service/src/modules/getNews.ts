import { AxiosInstance } from "axios";
import {
  NewsApiResponseSchema,
  Article
} from "../schemas/news.schema";
import { NewsCard, NewsDataResponse } from "../interfaces/news";
import { newsLimiter } from "./newsLimiter";
import { logger } from "../logger";
import { cacheGet, cacheSet } from "../cache";
import { NEWS_CACHE_KEY } from "../constants/news";

newsLimiter.on("queued", () => {
  logger.warn("News request queued due to rate limit");
});

newsLimiter.on("executing", () => {
  logger.info("News request executing from queue");
});

const NEWS_CACHE_TTL = 12 * 60; // 12 minutes

const BASE_URL = "https://newsdata.io/api/1/latest";

// -------------------------------------------------
// Circuit Breaker (News API)
// -------------------------------------------------
let consecutiveFailures = 0;
let breakerOpenUntil = 0;

const FAILURE_THRESHOLD = 3;    // failures before opening breaker
const COOLDOWN_MS = 15 * 60_000; // 15 minutes

const inFlight = new Map<string, Promise<NewsDataResponse>>();

/**
 * Fetch top news by global scope & categories
 */
export async function getNews({
  categories = ["business", "technology", "politics"],
  language = "en",
  apiKey = "",
  axiosClient
}: {
  categories?: string[];
  language?: string;
  apiKey: string;
  axiosClient: AxiosInstance
}): Promise<NewsDataResponse> {
  const now = Date.now();
  const cacheKey = getNewsCacheKey("global", categories, language);

  // -------------------------------------------------
  // CACHE HIT (FAST PATH – NOT RATE LIMITED)
  // -------------------------------------------------
  const cached = await cacheGet<NewsCard[]>(cacheKey);
  if (cached?.length) {
    logger.debug("Serving news from cache");
    return {
      source: "cache",
      scope: "global",
      data: cached
    };
  }

  // CIRCUIT BREAKER CHECK (after cache)
  if (breakerOpenUntil > now) {
    throw new Error("News API circuit breaker open");
  }

  // SINGLE-FLIGHT
  if (inFlight.has(cacheKey)) {
    logger.debug("Awaiting in-flight news fetch");
    return inFlight.get(cacheKey)!;
  }

  // RATE-LIMIT ONLY THE NETWORK CALL
  const promise = newsLimiter
    .schedule(() =>
      fetchAndCacheNews({
        categories,
        language,
        apiKey,
        axiosClient,
        cacheKey
      })
    )
    .finally(() => {
      inFlight.delete(cacheKey);
    });

  inFlight.set(cacheKey, promise);
  return promise;
}

async function fetchAndCacheNews({
  categories,
  language,
  apiKey,
  axiosClient,
  cacheKey
}: {
  categories: string[];
  language: string;
  apiKey: string;
  axiosClient: AxiosInstance;
  cacheKey: string;
}): Promise<NewsDataResponse> {
  try {
    const response = await axiosClient.get(BASE_URL, {
        timeout: 10_000,
        params: {
          apikey: apiKey,
          category: categories.join(","),
          language
        }
      });


    const rawResults = Array.isArray(response.data?.results)
      ? response.data.results
      : [];

    const newsOnly = rawResults.filter(
      (item: any) => item.datatype === "news"
    );

    // Runtime validation
    const parsed = NewsApiResponseSchema.safeParse({
      ...response.data,
      results: newsOnly,
    });

    if (!parsed.success) {
      logger.warn(
        { issues: parsed.error.issues },
        "News API schema mismatch"
      );
      throw new Error("NEWS_SCHEMA_MISMATCH");
    }

    const newsCards = parsed.data.results.map((article: Article): NewsCard => ({
      id: article.article_id,
      title: article.title,
      description: article.description,
      image: article.image_url,
      url: article.link,
      source: article.source_id,
      publishedAt: article.pubDate,
      category: article.category
    }));

    // Cache news
    await cacheSet(cacheKey, newsCards, NEWS_CACHE_TTL);

    consecutiveFailures = 0;
    breakerOpenUntil = 0;

    const newsResponse: NewsDataResponse = {
      source: "api",
      scope: "global",
      data: newsCards
    }

    return newsResponse;

  } catch (err: any) {
    if (err.message === "NEWS_SCHEMA_MISMATCH") throw err;

    // -------------------------------------------------
    // CIRCUIT BREAKER FAILURE COUNT
    // -------------------------------------------------
    const isNetworkError =
      err.code === "ECONNABORTED" ||
      err.code === "ETIMEDOUT" ||
      err.response?.status >= 500;

    if (isNetworkError) consecutiveFailures++;

    if (consecutiveFailures >= FAILURE_THRESHOLD) {
      breakerOpenUntil = Date.now() + COOLDOWN_MS;
      logger.error("Circuit breaker opened for News API");
    }

    throw err;
  }
}


function getNewsCacheKey(
  scope: string,
  categories: string[],
  language: string
) {
  return `${NEWS_CACHE_KEY}:${scope}:${language}:${categories.sort().join(",")}`;
}
