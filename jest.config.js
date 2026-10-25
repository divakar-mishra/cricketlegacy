module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  testMatch: ['**/src/**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/output/', '<rootDir>/test-artifacts/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^expo/virtual/env$': '<rootDir>/src/test/expoVirtualEnv.js',
    '^expo-modules-core$': '<rootDir>/src/test/expoModulesCore.js',
    '^expo-application$': '<rootDir>/src/test/expoApplication.js',
    '\\.(png|jpe?g|webp|wav|mp3)$': '<rootDir>/src/test/assetMock.js',
  },
  // Pure engine tests and real navigation-router regressions use these ESM-only dependencies.
  transformIgnorePatterns: ['/node_modules/(?!(zod|@react-navigation/routers|nanoid)/)'],
};
