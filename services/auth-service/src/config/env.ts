import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  CLIENT_ORIGIN: z.string().url().default('http://localhost'),

  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('1d'),

  COOKIE_NAME: z.string().default('flux_auth_token'),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z.string().default('false'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  CLIENT_SUCCESS_REDIRECT: z
    .string()
    .url()
    .default('http://localhost/auth/success'),

  CLIENT_FAILURE_REDIRECT: z
    .string()
    .url()
    .default('http://localhost/auth/failure'),

  MONGODB_URI: z.string().optional().default(''),
  MONGODB_DB_NAME: z.string().default('flux_auth'),

  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_CALLBACK_URL: z
    .string()
    .url()
    .default('http://localhost/auth/google/callback'),

  GITHUB_CLIENT_ID: z.string().optional().default(''),
  GITHUB_CLIENT_SECRET: z.string().optional().default(''),
  GITHUB_CALLBACK_URL: z
    .string()
    .url()
    .default('http://localhost/auth/github/callback')
});

const parsedEnv = envSchema.parse(process.env);

const isProd = parsedEnv.NODE_ENV === 'production';

export const env = {
  ...parsedEnv,
  COOKIE_SECURE: isProd,
  COOKIE_SAME_SITE: isProd ? 'none' : 'lax'
} as const;