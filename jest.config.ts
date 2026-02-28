import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Only for integration tests
  globalSetup: process.env.RUN_INTEGRATION_TESTS === 'true' 
    ? '<rootDir>/tests/setupKafka.ts'
    : undefined,
  globalTeardown: process.env.RUN_INTEGRATION_TESTS === 'true' 
    ? '<rootDir>/tests/teardownKafka.ts'
    : undefined,
  
  projects: [
    '<rootDir>/server',
    '<rootDir>/frontend',
    '<rootDir>/services/weather-service',
    '<rootDir>/services/stock-service',
    '<rootDir>/services/crypto-service',
    '<rootDir>/services/news-service',
  ]
};

export default config;
