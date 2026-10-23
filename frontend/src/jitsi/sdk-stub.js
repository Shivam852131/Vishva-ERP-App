// Metro resolves the optional `@jitsi/react-native-sdk` to this file when the
// native SDK is not installed (see the resolveRequest hook in metro.config.js),
// so bundling always succeeds. The meeting host reads `null` here as "native
// SDK unavailable" and takes the documented, user-consented fallback path.
//
// Installing the SDK later requires NO JavaScript change: Metro then resolves
// the real package instead of this stub.
module.exports = null;
