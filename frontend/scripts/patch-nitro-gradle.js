const fs = require('fs');
const path = require('path');

const packages = ['react-native-nitro-image', 'react-native-nitro-modules'];

for (const packageName of packages) {
  const buildFile = path.join(__dirname, '..', 'node_modules', packageName, 'android', 'build.gradle');
  if (!fs.existsSync(buildFile)) continue;

  const source = fs.readFileSync(buildFile, 'utf8');
  const patched = source.replace(
    '  // externalNativeBuild { cmake { path "CMakeLists.txt" } }',
    '  externalNativeBuild {\n    cmake {\n      path "CMakeLists.txt"\n    }\n  }',
  );

  if (patched !== source) {
    fs.writeFileSync(buildFile, patched);
    console.log(`Patched Android CMake configuration for ${packageName}.`);
  }
}
