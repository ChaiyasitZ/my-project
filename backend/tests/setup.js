// Test setup file
import { jest, afterAll, beforeAll } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3099';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/network_automation_test';
process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'test-api-key';

// Global test timeout
jest.setTimeout(30000);

// Track services for cleanup
let sshService, llmService, netconfService;

// Lazy load services only when needed
beforeAll(async () => {
  // Services will be imported by tests if needed
});

// Cleanup after all tests
afterAll(async () => {
  // Dynamically import and shutdown services
  try {
    const sshModule = await import('../services/sshService.js');
    if (sshModule.default && typeof sshModule.default.shutdown === 'function') {
      sshModule.default.shutdown();
    }
  } catch (e) {
    // Service not used in tests
  }
  
  try {
    const llmModule = await import('../services/llmService.js');
    if (llmModule.default && typeof llmModule.default.shutdown === 'function') {
      llmModule.default.shutdown();
    }
  } catch (e) {
    // Service not used in tests
  }
  
  try {
    const netconfModule = await import('../services/netconfService.js');
    if (netconfModule.default && typeof netconfModule.default.shutdown === 'function') {
      netconfModule.default.shutdown();
    }
  } catch (e) {
    // Service not used in tests
  }
  
  // Clear all mocks and timers
  jest.clearAllMocks();
  jest.clearAllTimers();
});
