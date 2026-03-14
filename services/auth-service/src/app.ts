import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Request, Response } from 'express';
import { env } from './config/env';
import { isDatabaseConnected } from './config/db';

const app = express();

app.disable('x-powered-by');

app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'auth-service',
    environment: env.NODE_ENV,
    database: isDatabaseConnected() ? 'connected' : 'disconnected'
  });
});

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    message: 'Auth service is running'
  });
});

export default app;