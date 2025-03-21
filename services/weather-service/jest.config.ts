import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Test file patterns
  testMatch: ['**/?(*.)+(spec|test).ts'],

  // Faster & predictable paths
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Coverage (optional but recommended)
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],

  coverageDirectory: 'coverage',

  // Module resolution (important for tsconfig paths)
  moduleFileExtensions: ['ts', 'js', 'json'],
};

export default config;