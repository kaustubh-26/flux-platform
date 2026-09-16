import cookieParser from 'cookie-parser';
import express, { Request, Response } from 'express';
import apiRoutes from './routes/api.routes';
import { env } from './config/env';

export function createApp(): express.Express {
  const app = express();
  app.set('trust proxy', true);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Health endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'flux-platform-bff',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API routes
  app.use('/api', apiRoutes);

  return app;
}

export const app = createApp();
export default app;
