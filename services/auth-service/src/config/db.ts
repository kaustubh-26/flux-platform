import mongoose from 'mongoose';
import { logger } from '../logger';

export async function connectDatabase(mongoUri: string): Promise<void> {
  await mongoose.connect(mongoUri);
  logger.info('connected to MongoDB');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('disconnected from MongoDB');
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}