/**
 * Guards the root cause of the "live class opens in Chrome" bug: the in-app
 * Jitsi surface only activates when `@jitsi/react-native-sdk` is installed —
 * before that, Metro resolved `src/jitsi/sdk-stub.js` (exports null),
 * `isNativeMeetingAvailable()` read false, and meetings fell back to the
 * consented browser path.
 *
 * Environment notes:
 * - Metro (the real app) resolves the installed package to its `index.tsx`,
 *   so the meeting host renders the in-app JitsiMeeting surface.
 * - Jest has no autolinking/Metro, so jest.config.js maps the SDK to the null
 *   stub; `getNativeSdk()` then degrades to null and the gate reads false.
 *   That is correct for tests (no native modules exist there) — this file
 *   therefore asserts the ON-DISK install (what Metro will bundle) and that
 *   the gate degrades gracefully, and deliberately does not force the SDK to
 *   load under Jest.
 */
const fs = require('fs');
const path = require('path');

describe('Jitsi native SDK resolution (post-install)', () => {
  it('is installed on disk with an entry point Metro can bundle', () => {
    const pkgPath = path.join(
      __dirname,
      '..',
      'node_modules',
      '@jitsi',
      'react-native-sdk',
      'package.json',
    );
    expect(fs.existsSync(pkgPath)).toBe(true);

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const entry = path.join(
      __dirname,
      '..',
      'node_modules',
      '@jitsi',
      'react-native-sdk',
      pkg.main || 'index.js',
    );
    console.log('[diagnostic] @jitsi/react-native-sdk', pkg.version, '-> main:', pkg.main);
    expect(fs.existsSync(entry)).toBe(true);
    expect(fs.readFileSync(entry, 'utf8').length).toBeGreaterThan(0);
  });

  it('degrades gracefully to the fallback when the SDK cannot load (Jest)', () => {
    const { isNativeMeetingAvailable, getNativeSdk } = require('@/src/jitsi/meeting');

    let sdk: any = null;
    let threw = false;
    try {
      sdk = getNativeSdk();
    } catch {
      threw = true;
    }
    // The gate must never throw at the call site (live-class.tsx calls it on
    // every "Open meeting" tap); a failed load must resolve to null/false so
    // the consented fallback path takes over instead of crashing.
    expect(threw).toBe(false);
    expect(sdk === null || typeof sdk === 'object').toBe(true);
    expect(typeof isNativeMeetingAvailable()).toBe('boolean');
  });
});
