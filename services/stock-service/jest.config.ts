import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  forceExit: true,
  detectOpenHandles: false,

  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.test.json',
      },
    ],
  },

  rootDir: '.',

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.int.test.ts'
  ],
  // Faster & predictable paths
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Coverage (optional but recommended)
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',   
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  coverageDirectory: 'coverage',

  // Module resolution (important for tsconfig paths)
  moduleFileExtensions: ['ts', 'js', 'json'],
};

export default config;