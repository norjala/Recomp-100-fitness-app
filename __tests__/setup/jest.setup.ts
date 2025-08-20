// Jest setup for backend tests
import { jest } from '@jest/globals';

// Mock console methods in tests to reduce noise
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
});

// Mock console methods to avoid noise in tests unless explicitly testing logging
jest.spyOn(console, 'error').mockImplementation((...args) => {
  // Only show console.error in tests if it contains 'ERROR' or 'FAIL'
  if (args.some(arg => typeof arg === 'string' && (arg.includes('ERROR') || arg.includes('FAIL')))) {
    originalConsoleError(...args);
  }
});

jest.spyOn(console, 'warn').mockImplementation((...args) => {
  // Suppress warnings in tests unless they contain 'WARN'
  if (args.some(arg => typeof arg === 'string' && arg.includes('WARN'))) {
    originalConsoleWarn(...args);
  }
});

jest.spyOn(console, 'log').mockImplementation((...args) => {
  // Suppress logs in tests unless they contain 'TEST'
  if (args.some(arg => typeof arg === 'string' && arg.includes('TEST'))) {
    originalConsoleLog(...args);
  }
});

// Global test timeout
jest.setTimeout(10000);