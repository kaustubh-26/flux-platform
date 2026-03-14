import app from './app';
import { env } from './config/env';
import { logger } from './logger';

async function startServer(): Promise<void> {
  try {
    app.listen(env.PORT, () => {
      logger.info(
        {
          port: env.PORT,
          env: env.NODE_ENV
        },
        'auth-service started'
      );
    });
  } catch (error) {
    logger.error({ err: error }, 'failed to start auth-service');
    process.exit(1);
  }
}

void startServer();