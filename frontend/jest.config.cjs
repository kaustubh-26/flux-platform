module.exports = {
  testEnvironment: "jsdom",

  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
        useESM: false
      }
    ],
    "^.+\\.(js|jsx)$": "babel-jest"
  },

  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|less|scss)$": "identity-obj-proxy"
  },

  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"]
};
