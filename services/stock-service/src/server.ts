import dotenv from "dotenv";
import https from "https";
import axios from "axios";
import { z } from "zod";
import { logger } from "./logger";
import { getTopPerformers } from "./modules/topPerformers";

// -------------------------------------------------
// Env
// -------------------------------------------------
dotenv.config();

const envSchema = z.object({
  FINNHUB_API_KEY: z.string().min(1),
  NODE_ENV: z.enum(["development", "production"]).default("production"),
});

const env = envSchema.parse(process.env);

// -------------------------------------------------
// Axios client
// -------------------------------------------------
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
});

const axiosClient = axios.create({
  timeout: 10_000,
  httpsAgent,
});

// -------------------------------------------------
// Run once (cron / manual trigger friendly)
// -------------------------------------------------
async function run() {
  try {
    const result = await getTopPerformers({
      apiKey: env.FINNHUB_API_KEY,
      axiosClient,
      limit: 10,
    });

    logger.info(result, "Top stock performers fetched");
  } catch (err) {
    logger.error({ err }, "Failed to fetch stock performers");
  }
}

run();

// -------------------------------------------------
// Graceful shutdown
// -------------------------------------------------
async function shutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down...`);
  httpsAgent.destroy();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
