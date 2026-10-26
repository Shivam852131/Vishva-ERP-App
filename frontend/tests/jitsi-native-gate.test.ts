/**
 * Guards the "Open meeting" tap-to-crash.
 *
 * `@jitsi/react-native-sdk` is not an inert JS package: importing it evaluates
 * its whole static graph, which ends in
 * `react-native-worklets-core/src/NativeWorklets.ts` calling
 * `TurboModuleRegistry.getEnforcing('Worklets')` at module scope. That native
 * module is deliberately not autolinked in this app (react-native.config.js —
 * its `WorkletsPackage` collides with Reanimated's `react-native-worklets`),
 * and the shipped APK carries only `com.swmansion.worklets.WorkletsModule`
 * (TurboModule name "WorkletsModule"). Importing the SDK there dies inside
 * native module evaluation, which the JS try/catch in `getNativeSdk()` cannot
 * catch — the process just exits.
 *
 * So the SDK must not be imported until the capability probe says the native
 * module exists. These tests fail if that ordering is ever removed.
 */

// Set by the mock factory below when (and only when) the SDK is imported.
let mockSdkEvaluated = false;

jest.mock('@jitsi/react-native-sdk', () => {
  mockSdkEvaluated = true;
  const JitsiMeeting = () => null;
  return { __esModule: true, default: { JitsiMeeting }, JitsiMeeting };
});

/**
 * Spies on `TurboModuleRegistry.get` so `'Worklets'` reads as present or
 * absent, passing every other module name through to the real implementation.
 */
function stubWorkletsModule(present: boolean) {
  const { TurboModuleRegistry } = require('react-native');
  const original: any = TurboModuleRegistry.get.bind(TurboModuleRegistry);
  const fakeWorklets = { install: () => true };
  return jest
    .spyOn(TurboModuleRegistry, 'get')
    .mockImplementation(
      ((name: unknown) =>
        name === 'Worklets' ? (present ? fakeWorklets : null) : original(name)) as any,
    );
}

describe('native meeting capability gate', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('never imports the Jitsi SDK when the Worklets native module is absent', () => {
    jest.resetModules();
    mockSdkEvaluated = false;
    const getSpy = stubWorkletsModule(false);

    const meeting = require('@/src/jitsi/meeting');

    // The gate asks the runtime about the native module it actually needs…
    expect(meeting.isNativeMeetingAvailable()).toBe(false);
    expect(meeting.getNativeSdk()).toBeNull();
    expect(getSpy).toHaveBeenCalledWith('Worklets');
    // …and refuses the SDK import outright rather than finding out the hard way.
    expect(mockSdkEvaluated).toBe(false);

    getSpy.mockRestore();
  });

  it('imports the SDK only when the native prerequisite is present', () => {
    jest.resetModules();
    mockSdkEvaluated = false;
    stubWorkletsModule(true);

    const meeting = require('@/src/jitsi/meeting');

    expect(meeting.isNativeMeetingAvailable()).toBe(true);
    expect(mockSdkEvaluated).toBe(true);
  });

  it('keeps the answer cached so a tap cannot re-run the probe indefinitely', () => {
    jest.resetModules();
    mockSdkEvaluated = false;
    const getSpy = stubWorkletsModule(false);

    const meeting = require('@/src/jitsi/meeting');
    meeting.isNativeMeetingAvailable();
    meeting.isNativeMeetingAvailable();
    meeting.getNativeSdk();

    expect(getSpy.mock.calls.filter((c: unknown[]) => c[0] === 'Worklets')).toHaveLength(1);

    getSpy.mockRestore();
  });
});
