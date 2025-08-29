module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/backend/tests/**/*.test.js'],
  collectCoverageFrom: [
    'backend/**/*.js',
    '!backend/tests/**',
    '!backend/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/backend/tests/setup.js'],
  testTimeout: 10000,
  verbose: true
};
