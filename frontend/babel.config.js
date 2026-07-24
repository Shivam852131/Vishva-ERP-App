module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    ['module:react-native-dotenv', {
      moduleName: '@env',
      path: '.env',
      safe: false,
      allowUndefined: true,
    }],
    // Must be listed last: it needs to run after all other transforms.
    'react-native-reanimated/plugin',
  ],
};
