const fs = require('fs');
const path = require('path');

// @jitsi/react-native-sdk pins @amplitude/analytics-react-native@1.4.13, whose
// Android code still calls the Kotlin 1.5-deprecated String.toUpperCase(locale).
// On this project's toolchain (Kotlin 2.1 via RN 0.81) that deprecation fails
// the :amplitude_analytics-react-native compile. The replacement is semantically
// identical; once a pinned amplitude release ships the fix, delete this script.
const file = path.join(
  __dirname,
  '..',
  'node_modules',
  '@amplitude',
  'analytics-react-native',
  'android',
  'src',
  'main',
  'java',
  'com',
  'amplitude',
  'reactnative',
  'AndroidContextProvider.kt',
);

if (!fs.existsSync(file)) process.exit(0);

const source = fs.readFileSync(file, 'utf8');
const patched = source.replace(
  'country.toUpperCase(Locale.US)',
  'country.uppercase(Locale.US)',
);

if (patched !== source) {
  fs.writeFileSync(file, patched);
  console.log('Patched deprecated String.toUpperCase(locale) in @amplitude/analytics-react-native.');
}
