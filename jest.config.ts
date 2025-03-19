import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
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
