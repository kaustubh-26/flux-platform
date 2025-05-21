import fs from "fs";
import IORedis, { RedisOptions } from "ioredis";
import { logger } from "../logger"

let isShuttingDown = false;
let isCacheAvailable = false;

function getValkeyPassword() {
  if (process.env.VALKEY_PASSWORD) {
    return process.env.VALKEY_PASSWORD;
  }

  if (process.env.VALKEY_PASSWORD_FILE) {
    try {
      return fs.readFileSync(process.env.VALKEY_PASSWORD_FILE, "utf8").trim();
    } catch {
      logger.warn("Failed to read Valkey password from secret file");
    }
  }
  return undefined;
}

const redisOpts: RedisOptions = {
  host: process.env.VALKEY_HOST || "127.0.0.1",
  port: Number(process.env.VALKEY_PORT) || 6379,
  password: getValkeyPassword(),
  retryStrategy: () => (isShuttingDown ? null : 5000),
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false,
};

export const redis = new IORedis(redisOpts);

// -------------------------
// Connection state tracking
// -------------------------
redis.on("connect", () => {
  if (!isCacheAvailable) {
    isCacheAvailable = true;
    logger.info("Valkey connected");
  }
});

redis.on("error", (err) => {
  if (isCacheAvailable) {
    isCacheAvailable = false;
    logger.warn({ err: err.message }, "Valkey unavailable, running without cache");
  }
});

redis.on("close", () => {
  if (isCacheAvailable) {
    isCacheAvailable = false;
    logger.warn("Valkey connection closed");
  }
});

// -------------------------
// Helpers
// -------------------------
export function cacheAvailable() {
  return isCacheAvailable;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isCacheAvailable) return null;

  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number
) {
  if (!isCacheAvailable) return;

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch(err) {
    /* swallow cache errors */
    logger.error({ err }, 'Error while setting cache');
  }
}

export function shutdownCache() {
  isShuttingDown = true;
  redis.disconnect(); // force close (no await)
}
