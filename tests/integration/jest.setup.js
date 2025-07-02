// Jest setup for integration tests

// Increase timeout for integration tests
jest.setTimeout(120000);

// Global test utilities
global.testUtils = {
  // Wait for a condition to be true
  waitFor: async (condition, timeout = 5000, interval = 100) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error('Timeout waiting for condition');
  },
  
  // Retry a function until it succeeds
  retry: async (fn, retries = 3, delay = 1000) => {
    let lastError;
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  },
};

// Clean up any stale test files before running tests
const fs = require('fs').promises;
const path = require('path');

beforeAll(async () => {
  const tmpDir = path.join(process.cwd(), 'tmp', 'tests');
  try {
    await fs.rm(tmpDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore errors if directory doesn't exist
  }
  await fs.mkdir(tmpDir, { recursive: true });
});

// Log test environment
console.log('Test Environment:', {
  node: process.version,
  platform: process.platform,
  cwd: process.cwd(),
});