import Bottleneck from "bottleneck";

/**
 * 8 requests per hour
 * 1 hour = 60 * 60 * 1000 = 3,600,000 ms
 */
export const newsLimiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 3_600_000 / 8 // 450,000 ms = 7.5 minutes
});
