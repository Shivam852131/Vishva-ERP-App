module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  globalSetup: '<rootDir>/tests/globalSetup.js',
  setupFiles: ['<rootDir>/tests/loadTestEnv.js'],
  testTimeout: 15000,
  maxWorkers: 1,
  forceExit: true,
  testMatch: ['<rootDir>/tests/**/*.test.js'],
};
