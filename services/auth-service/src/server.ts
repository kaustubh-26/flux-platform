import app from './app';
import { connectDatabase } from './config/db';
import { env } from './config/env';
import { logger } from './logger';

async function startServer(): Promise<void> {
  try {
    await connectDatabase(env.MONGODB_URI);

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