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
  // react-native's preset only matches .js/.ts/.tsx, so app/*.jsx (the six
  // localshare screens) reached Node untransformed and died with "Cannot use
  // import statement outside a module". The whole map is spelled out rather
  // than adding a single key: that keeps the preset's asset rule alive no
  // matter how Jest resolves preset-vs-config precedence.
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$': require.resolve(
      'react-native/jest/assetFileTransformer.js',
    ),
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-.*|@gorhom|socket\\.io-client|engine\\.io-client)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/dist/'],
  // The first `require()` of `lucide-react-native` (~8s) plus `src/ui` (~6s)
  // costs ~14s in a cold worker, and the screen itself then mounts in ~60ms.
  // Jest's 5s default killed the test that happened to pay that one-time cost
  // (landing, student/dashboard), so give the graph room to load.
  testTimeout: 30000,
};
