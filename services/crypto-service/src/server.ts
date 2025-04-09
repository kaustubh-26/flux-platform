import dotenv from 'dotenv';
import { logger } from './logger';
import { z } from 'zod';
import axios from 'axios';
import https from 'https';
import { getTopGainers } from "./modules/topGainers";
import { getTopLosers } from "./modules/topLosers";
import { shutdownCache } from './cache';

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
    NODE_ENV: z.enum(['development', 'production']).default('production')
});

type Env = z.infer<typeof envSchema>;

const env = envSchema.parse(process.env);

// -------------------------------------------------
// Crypto Service
// -------------------------------------------------
(async () => {

    const gainers = await getTopGainers(axiosClient);
    console.log(gainers);

    setTimeout(() => {
        (async () => {

            const losers = await getTopLosers(axiosClient);
            console.log(losers);


        })();
    }, 2000);

    setTimeout(() => {
        (async () => {

            const gainers = await getTopGainers(axiosClient);
            console.log(gainers);

            const losers = await getTopLosers(axiosClient);
            console.log(losers);


        })();
    }, 4000);

})();



// -------------------------------------------------
// Shutdown handling
// -------------------------------------------------
async function shutdown(signal: string) {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    try {

        logger.info('Destroying HTTP agent...');
        httpsAgent.destroy();

        logger.info('Closing Valkey connection...');
        shutdownCache();
        logger.info('Valkey disconnected');

        setTimeout(() => process.exit(0), 3000);

    } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
    }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
