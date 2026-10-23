// React Native CLI / autolinking configuration.
//
// This project previously had no react-native.config.js, so every native
// module was autolinked by default. Installing the Jitsi Meet React Native
// SDK requires overriding that for one module:
//
//   react-native-worklets-core (the Jitsi-forked package)
//
// Jitsi pulls a forked `react-native-worklets-core` (Android package
// `com.worklets`), which registers a native class `WorkletsPackage`. This app
// already links `react-native-worklets` (via react-native-reanimated@4, Android
// package `com.swmansion.worklets`), which registers its own
// `WorkletsPackage`. React Native's autolinking imports both by their stripped
// simple name, so linking both fails the Android build with:
//
//   error: reference to WorkletsPackage is ambiguous
//     both class com.swmansion.worklets.WorkletsPackage and
//           class com.worklets.WorkletsPackage match
//
// We keep Reanimated's `react-native-worklets` (the app depends on it
// directly) and stop autolinking Jitsi's `react-native-worklets-core` native
// code. The worklets API surface Jitsi imports at the JS level stays resolved;
// only the duplicate native registration is dropped. Live-class video/audio
// (react-native-webrtc and the Jitsi SDK itself) is unaffected.
module.exports = {
  dependencies: {
    'react-native-worklets-core': {
      platforms: {
        android: null,
        ios: null,
      },
    },
  },
};
