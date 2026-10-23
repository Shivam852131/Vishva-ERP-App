const fs = require('fs');
const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = path.resolve(__dirname);
let realRoot = projectRoot;
try {
  realRoot = fs.realpathSync(projectRoot);
} catch (e) {}

const watchFolders = Array.from(
  new Set([projectRoot, realRoot, 'Z:/', 'Z:\\', 'C:/Users/shiva/OneDrive/Desktop/vishva erp app/frontend'])
).filter(dir => {
  try {
    return fs.existsSync(dir);
  } catch (e) {
    return false;
  }
});

const config = {
  projectRoot,
  watchFolders,
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName.startsWith('@/')) {
        const relativePath = moduleName.slice(2);
        const resolvedPath = path.resolve(projectRoot, relativePath);
        return context.resolveRequest(context, resolvedPath, platform);
      }
      if (moduleName === '@jitsi/react-native-sdk') {
        // Optional native module: bundle the real SDK when it is installed, and
        // fall back to a stub otherwise so Metro never fails on the missing
        // package (the meeting host then reads null and takes its fallback path).
        try {
          const resolution = context.resolveRequest(context, moduleName, platform);
          if (resolution) return resolution;
        } catch {
          // Not installed — resolve to the stub below.
        }
        return { type: 'sourceFile', filePath: path.resolve(projectRoot, 'src/jitsi/sdk-stub.js') };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
