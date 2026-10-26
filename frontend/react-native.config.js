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
// code.
//
// IMPORTANT — this is NOT free at runtime, and it is what made "Open meeting"
// kill the app. `@jitsi/react-native-sdk` statically imports
// `react/features/base/lib-jitsi-meet/functions.native.ts`, which imports
// `react-native-worklets-core`, whose `src/NativeWorklets.ts` calls
// `TurboModuleRegistry.getEnforcing('Worklets')` *at module scope* — and that
// file then calls `Worklets.createContext('ConfigParser')` at module scope.
// Reanimated's `react-native-worklets` registers a different module
// ("WorkletsModule"), so it cannot satisfy that lookup. With this override the
// 'Worklets' module simply does not exist in the binary, so importing the SDK
// dies inside native module evaluation — uncatchable by JS try/catch.
//
// `src/jitsi/meeting.ts` therefore gates the SDK import behind a runtime probe
// for `TurboModuleRegistry.get('Worklets')`; while this override is in place
// that probe fails, `getNativeSdk()` returns null and `JitsiMeetingModal`
// renders the in-app WebView surface instead — meetings stay inside the app
// either way, and the browser is only reached behind an explicit button press.
// Reverting to the native SDK means removing this override AND resolving the
// `WorkletsPackage` ambiguity (e.g. by upgrading/deduping the two worklets
// packages) — then the probe flips on by itself and the WebView is bypassed.
// Check scripts/check-jitsi-import-graph.js to re-verify the import graph.
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
