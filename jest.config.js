module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  testMatch: ['**/src/**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^expo/virtual/env$': '<rootDir>/src/test/expoVirtualEnv.js',
  },
  // Engine/content tests are pure TS; allow transforming ESM-only deps if needed.
  transformIgnorePatterns: ['/node_modules/(?!(zod)/)'],
};
