import dotenv from 'dotenv';
import pino from 'pino';
import fs from 'fs';
import { z } from 'zod';
import axios from 'axios';
import https from 'https';
import { getTopGainers } from "./modules/topGainers";
import { getTopLosers } from "./modules/topLosers";

const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 10,
});
const axiosClient = axios.create({
    timeout: 10000,
    httpsAgent
});

// -------------------------------------------------
// Load & validate environment variables
// -------------------------------------------------
dotenv.config();

const envSchema = z.object({
    KAFKA_BROKER_ADDRESS: z.string().min(1),
    COINGECKO_MARKETS_URL: z.string().min(1),
    NODE_ENV: z.enum(['development', 'production']).default('production')
});

type Env = z.infer<typeof envSchema>;

const env = envSchema.parse(process.env);

// -------------------------------------------------
// Logger (structured, level‑aware)
// -------------------------------------------------
const logger = pino({
    level: env.NODE_ENV === 'development' ? 'debug' : 'info',
    base: { pid: process.pid },
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'yyyy-mm-dd HH:MM:ss',
                ignore: 'pid,hostname',
            },
        }
        : undefined,
});
logger.info(env.NODE_ENV, logger.level);

logger.info({
    kafka: process.env.KAFKA_BROKER_ADDRESS,
    valkey: process.env.VALKEY_HOST,
    nodeEnv: env.NODE_ENV,
}, 'Runtime configuration');

// -------------------------------------------------
// Crypto Service
// -------------------------------------------------
(async () => {

    const gainers = await getTopGainers(axiosClient, process.env.COINGECKO_MARKETS_URL, 10);
    console.log(gainers);

    setTimeout(() => {
        (async () => {

            const losers = await getTopLosers(axiosClient, process.env.COINGECKO_MARKETS_URL, 10);
            console.log(losers);


        })();
    }, 2000);

})();



// -------------------------------------------------
// Shutdown handling
// -------------------------------------------------
async function shutdown(signal: string) {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    try {

        logger.info('Destroying HTTP agent...');
        httpsAgent.destroy();

        setTimeout(() => process.exit(0), 3000);

    } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
    }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
