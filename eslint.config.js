// Flat ESLint config (ESLint 9) using Expo's shared config.
const expoConfig = require('eslint-config-expo/flat');

const base = Array.isArray(expoConfig) ? expoConfig : [expoConfig];

const ignores = [
  'dist/*',
  'output/**',
  '.expo/*',
  'node_modules/*',
  'babel.config.js',
  'jest.config.js',
  'eslint.config.js',
  'supabase/functions/**',
];

module.exports = [
  { ignores },
  ...base,
  {
    rules: {
      // Expo SDK 57 enables React Compiler lint rules through the hooks plugin.
      // This app is not compiled with React Compiler yet, and current
      // React Native Reanimated/ref patterns intentionally mutate shared values
      // and read refs in event-driven UI. Keep the true hook-order rules from
      // Expo's config, but do not fail CI on compiler-only adoption checks.
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
      'react/no-unescaped-entities': 'off',
    },
  },
];
