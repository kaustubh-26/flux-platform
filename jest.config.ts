import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  globalSetup: '<rootDir>/tests/setupKafka.ts',
  globalTeardown: '<rootDir>/tests/teardownKafka.ts',
  
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
