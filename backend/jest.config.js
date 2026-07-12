module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  globalSetup: '<rootDir>/tests/globalSetup.js',
  setupFiles: ['<rootDir>/tests/loadTestEnv.js'],
  testTimeout: 15000,
  testMatch: ['<rootDir>/tests/**/*.test.js'],
};
