/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Only run files in __tests__ directories or *.test.ts(x) files
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  // ts-jest needs to know about the project's tsconfig
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react', strict: false } }],
  },
  // Don't try to transform node_modules
  transformIgnorePatterns: ['/node_modules/'],
  // Map native modules that can't be parsed in a Node environment to stubs
  moduleNameMapper: {
    // react-native uses Flow types and ESM syntax — stub the whole package
    '^react-native$': '<rootDir>/jest.mocks/react-native.js',
    // expo-constants is used by adminAuthService for env var fallback
    '^expo-constants$': '<rootDir>/jest.mocks/expo-constants.js',
  },
  // Suppress console.error/log/warn from service code during tests.
  setupFiles: ['<rootDir>/jest.setup.js'],
};
