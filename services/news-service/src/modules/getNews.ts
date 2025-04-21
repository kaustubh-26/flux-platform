import axios from "axios";
import {
  NewsApiResponseSchema,
  Article
} from "../schemas/news.schema";
import { NewsCard } from "../interfaces/news";
import { newsLimiter } from "./newsLimiter";
import { logger } from "../logger";

newsLimiter.on("queued", () => {
  logger.warn("News request queued due to rate limit");
});

newsLimiter.on("executing", () => {
  logger.info("News request executing from queue");
});

const BASE_URL = "https://newsdata.io/api/1/latest";

// -------------------------------------------------
// Circuit Breaker (News API)
// -------------------------------------------------
let consecutiveFailures = 0;
let breakerOpenUntil = 0;

const FAILURE_THRESHOLD = 3;    // failures before opening breaker
const COOLDOWN_MS = 5 * 60_000; // 5 minutes

/**
 * Fetch top news by country & categories
 */
export async function getNews({
  country = "in",
  categories = ["business", "technology", "politics"],
  language = "en",
  apiKey = ""
}: {
  country?: string;
  categories?: string[];
  language?: string;
  apiKey: string;
}): Promise<NewsCard[]> {
  return newsLimiter.schedule(async () => {
    const now = Date.now();

    // -------------------------------------------------
    // CIRCUIT BREAKER GUARD
    // -------------------------------------------------
    if (breakerOpenUntil > now) {
      logger.warn(
        { openUntil: new Date(breakerOpenUntil).toISOString() },
        "News API circuit breaker open, skipping request"
      );
      throw new Error("News API circuit breaker open");
    }

    try {
      const response = await axios.get(BASE_URL, {
        timeout: 10_000,
        params: {
          apikey: apiKey,
          country,
          category: categories.join(","),
          language
        }
      });

      // Runtime validation
      const parsed = NewsApiResponseSchema.safeParse(response.data);

      if (!parsed.success) {
        logger.error(
          { issues: parsed.error.issues },
          "News API schema mismatch"
        );
        throw new Error("Invalid News API response");
      }

      // -------------------------------------------------
      // CIRCUIT BREAKER RESET (SUCCESS)
      // -------------------------------------------------
      consecutiveFailures = 0;
      breakerOpenUntil = 0;

      return parsed.data.results.map((article: Article): NewsCard => ({
        id: article.article_id,
        title: article.title,
        description: article.description,
        image: article.image_url,
        url: article.link,
        source: article.source_id,
        publishedAt: article.pubDate,
        category: article.category,
        country
      }));

    } catch (err: any) {

      // -------------------------------------------------
      // CIRCUIT BREAKER FAILURE COUNT
      // -------------------------------------------------
      consecutiveFailures++;

      if (consecutiveFailures >= FAILURE_THRESHOLD) {
        breakerOpenUntil = Date.now() + COOLDOWN_MS;

        logger.error(
          {
            failures: consecutiveFailures,
            cooldownMs: COOLDOWN_MS
          },
          "Circuit breaker opened for News API"
        );
      }

      // Error classification
      if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
        logger.warn("News API request timed out");
      } else {
        logger.error(
          { message: err.message, code: err.code },
          "News API request failed"
        );
      }

      throw err;
    }
  });
}
