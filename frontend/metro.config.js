const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
  resolver: {
    alias: {
      '@': __dirname,
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
