module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tool-protocol'],
  testMatch: ['**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 120000, // 2 minutes for integration tests
  maxWorkers: 1, // Run tests serially to avoid port conflicts
  collectCoverageFrom: [
    'shared/tools/**/*.ts',
    '!shared/tools/**/*.d.ts',
    '!shared/tools/**/*.test.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../../$1',
  },
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },
};