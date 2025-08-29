// Test setup and configuration
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'ERROR'; // Reduce log noise during tests

// Mock console methods to reduce test output noise
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
    console.log = jest.fn();
    console.error = jest.fn();
});

afterAll(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
});

// Global test timeout
jest.setTimeout(10000);
