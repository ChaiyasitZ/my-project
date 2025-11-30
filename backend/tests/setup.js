// Test setup file
import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3099';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/network_automation_test';
process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'test-api-key';

// Global test timeout
jest.setTimeout(30000);

// Suppress console logs during tests (optional)
// Uncomment to silence console output
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn()
// };

// Cleanup after all tests
afterAll(async () => {
  // Close any open connections
  jest.clearAllMocks();
});
