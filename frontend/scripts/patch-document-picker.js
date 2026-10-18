const fs = require('fs');
const path = require('path');

// react-native-document-picker@9.3.1 — the latest published release — extends
// com.facebook.react.bridge.GuardedResultAsyncTask, which React Native removed
// before 0.81. Its peerDependencies declare `react-native: '*'` with no upper
// bound, so npm installs it without complaint and Android then fails with
// "cannot find symbol: class GuardedResultAsyncTask".
//
// GuardedResultAsyncTask was only a thin AsyncTask subclass that routed
// doInBackground/onPostExecute through React's exception handler, so rebase
// the task onto AsyncTask directly. Behaviour is unchanged: the task is still
// constructed on a looper-less thread, so onPostExecute still lands on the
// main thread, exactly as the original did.
//
// Re-runs on every postinstall because node_modules is rebuilt from the
// lockfile and the change must not be lost.

const file = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-document-picker',
  'android',
  'src',
  'main',
  'java',
  'com',
  'reactnativedocumentpicker',
  'RNDocumentPickerModule.java',
);

if (!fs.existsSync(file)) {
  console.log('react-native-document-picker not installed; skipping patch.');
  process.exit(0);
}

const source = fs.readFileSync(file, 'utf8');
let patched = source;

const swaps = [
  // The import: AsyncTask is the class GuardedResultAsyncTask used to extend.
  ['import com.facebook.react.bridge.GuardedResultAsyncTask;', 'import android.os.AsyncTask;'],
  // The superclass, parameterised the way AsyncTask expects.
  [
    'private static class ProcessDataTask extends GuardedResultAsyncTask<ReadableArray>',
    'private static class ProcessDataTask extends AsyncTask<Void, Void, ReadableArray>',
  ],
  // GuardedResultAsyncTask's only constructor argument no longer exists; the
  // ReactContext is still needed on the line below for its application context.
  ['      super(reactContext.getExceptionHandler());\n', ''],
  // The two guarded callback names revert to the AsyncTask names they wrapped.
  [
    'protected ReadableArray doInBackgroundGuarded() {',
    'protected ReadableArray doInBackground(Void... params) {',
  ],
  [
    'protected void onPostExecuteGuarded(ReadableArray readableArray) {',
    'protected void onPostExecute(ReadableArray readableArray) {',
  ],
];

for (const [before, after] of swaps) {
  if (!patched.includes(before)) continue;
  patched = patched.replace(before, after);
}

if (patched === source) {
  // Either already patched, or the upstream file changed shape — leave it be
  // rather than write a half-applied edit.
  console.log(
    source.includes('GuardedResultAsyncTask')
      ? 'react-native-document-picker: no patterns matched; NOT patched.'
      : 'react-native-document-picker already patched.',
  );
  process.exit(0);
}

if (patched.includes('GuardedResultAsyncTask')) {
  console.log('react-native-document-picker: patch incomplete; NOT writing.');
  process.exit(1);
}

fs.writeFileSync(file, patched);
console.log('Patched react-native-document-picker for React Native 0.81.');
