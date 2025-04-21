import dotenv from 'dotenv';
import { logger } from './logger';
import { z } from 'zod';
import { getNews } from "./modules/getNews";

// -------------------------------------------------
// Load & validate environment variables
// -------------------------------------------------
dotenv.config();

const envSchema = z.object({
    KAFKA_BROKER_ADDRESS: z.string().min(1),
    NEWSDATA_API_KEY: z.string().min(1),
    NODE_ENV: z.enum(['development', 'production']).default('production')
});

type Env = z.infer<typeof envSchema>;

const env = envSchema.parse(process.env);


async function run() {
    const news = await getNews({
        country: "in",
        apiKey: env.NEWSDATA_API_KEY
    });

    logger.debug(news);
}

run();
