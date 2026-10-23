module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@env$': '<rootDir>/tests/__mocks__/env.js',
    // Jest runs without autolinking or Metro, so the real Jitsi SDK cannot
    // load there (its import-time `new NativeEventEmitter(...)` needs native
    // modules, and its `.svg` imports need Metro). Map the SDK to the same
    // null stub Metro falls back to when the package is absent: tests then
    // exercise the documented no-SDK fallback path quickly and deterministically
    // instead of transforming the SDK's whole source tree (which timed out
    // suites when it ran in parallel). Metro in the real app resolves the REAL
    // package — see metro.config.js and tests/jitsi-sdk-resolution.test.ts.
    '^@jitsi/react-native-sdk$': '<rootDir>/src/jitsi/sdk-stub.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-.*|@gorhom|socket\\.io-client|engine\\.io-client)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/dist/'],
};
