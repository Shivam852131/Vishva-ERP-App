module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@env$': '<rootDir>/tests/__mocks__/env.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-.*|@gorhom|socket\\.io-client|engine\\.io-client)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/dist/'],
};
