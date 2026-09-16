import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  KAFKA_BROKER_ADDRESS: z.string().min(1).default('kafka:9092'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  SERVER_PORT: z.string().regex(/^\d+$/).default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required').default('replace_with_a_long_random_secret'),
  COOKIE_NAME: z.string().default('flux_auth_token'),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
