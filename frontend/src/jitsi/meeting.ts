import { Alert, Linking, PermissionsAndroid, Platform, TurboModuleRegistry } from 'react-native';
import { api } from '@/src/api';

/** Server-provided descriptor for opening a live class's video meeting. */
export interface MeetingInfo {
  session_id: string;
  title: string;
  status: string;
  /** Always an in-app-embeddable Jitsi room (Google Meet never is). */
  room_url: string;
  /** The session's stored meeting link, if any (may be Google Meet). */
  meeting_url: string | null;
  meeting_provider: 'jitsi' | 'google' | 'other' | null;
  display_name: string;
  email: string | null;
  role: string;
  is_host: boolean;
  allow_chat: boolean;
  allow_questions: boolean;
  /** Short-lived JWT for a secured Jitsi deployment; null on public meet.jit.si. */
  token: string | null;
}

// ── Native Jitsi SDK (optional) ──────────────────────────────────────────────
let sdkLoaded = false;
let sdkCache: any = null;
let nativeRuntime: boolean | null = null;

/**
 * Cheap, side-effect-free probe for the native module the Jitsi SDK cannot
 * even be *imported* without. Cached after the first call.
 *
 * Why this runs before `require('@jitsi/react-native-sdk')`: the SDK is not an
 * inert JS package. Requiring it evaluates its whole static import graph, and
 * `react/features/base/lib-jitsi-meet/functions.native.ts` statically imports
 * `react-native-worklets-core`, whose `src/NativeWorklets.ts` calls
 * `TurboModuleRegistry.getEnforcing('Worklets')` at module scope (the Jitsi
 * file then calls `Worklets.createContext(...)` at module scope).
 *
 * In this build that native module is provably absent:
 *   - `react-native.config.js` deliberately stops autolinking
 *     `react-native-worklets-core` (its `WorkletsPackage` collides with
 *     Reanimated's `react-native-worklets` at compile time);
 *   - the shipped APK only contains `com.swmansion.worklets.WorkletsModule`
 *     (TurboModule name "WorkletsModule") — never
 *     `com.worklets.WorkletsModule` (TurboModule name "Worklets").
 *
 * Importing the SDK there dies *inside native module evaluation*, which the
 * JS `try/catch` in `getNativeSdk()` cannot catch — that is the tap-to-crash.
 * `react-native-worklets` cannot satisfy this lookup: it registers a different
 * module name, so `get('Worklets')` is a real capability test, not a formality.
 *
 * (`react-native-webrtc` needs no extra check here: its own entry throws a
 * plain JS error when `WebRTCModule` is missing, which `getNativeSdk` catches.)
 */
function hasNativeMeetingRuntime(): boolean {
  if (nativeRuntime !== null) return nativeRuntime;
  let ok = false;
  try {
    // Never instantiates anything when the module is missing — returns null.
    ok = TurboModuleRegistry.get('Worklets') != null;
  } catch {
    ok = false;
  }
  nativeRuntime = ok;
  if (!ok && typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(
      "[jitsi] native meeting disabled: this build ships no 'Worklets' native module " +
        '(react-native-worklets-core is not autolinked) — meetings use the in-app ' +
        'WebView surface instead of importing the SDK.',
    );
  }
  return ok;
}

/**
 * Lazily load the official `@jitsi/react-native-sdk`.
 *
 * The SDK is optional. Metro resolves it to `sdk-stub.js` (which exports null)
 * when it is not installed — see metro.config.js — so this `require` always
 * resolves at runtime and bundling never fails on the missing package. When the
 * SDK IS installed we get the real module (which exposes `JitsiMeeting`).
 *
 * Kept lazy and cached so importing this file never triggers native module
 * loading until a meeting is opened, and so environments without the native
 * modules (Jest has no autolinking and no Metro svg resolution) simply fail
 * the require and fall through to `null` instead of crashing.
 *
 * The import graph itself is only evaluated once `hasNativeMeetingRuntime()`
 * says the native modules behind it are linked: a missing module there aborts
 * the process rather than throwing a catchable JS error, so probing *after*
 * the require would be too late.
 *
 * If the gate ever reads false in a real build where the SDK *is* installed,
 * the require threw — the dev-only warning below surfaces the exact error
 * (missing native link, Metro resolution, or a runtime import failure).
 */
export function getNativeSdk(): any | null {
  if (sdkLoaded) return sdkCache;
  sdkLoaded = true;
  sdkCache = null;
  if (!hasNativeMeetingRuntime()) return null;
  try {
    const mod: any = require('@jitsi/react-native-sdk');
    if (mod) sdkCache = mod.default ?? mod;
  } catch (e) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(
        '[jitsi] native SDK failed to load — meetings will use the browser fallback',
        e,
      );
    }
    sdkCache = null;
  }
  return sdkCache;
}

/**
 * True when a real native in-app Jitsi surface exists in this build.
 *
 * Reads false — with no SDK import attempted — whenever the native
 * prerequisites are missing, so callers can safely render the in-app WebView
 * surface instead of mounting one that would take the process down.
 */
export function isNativeMeetingAvailable(): boolean {
  const sdk = getNativeSdk();
  return !!sdk && typeof sdk.JitsiMeeting === 'function';
}

/**
 * Requests required runtime permissions (Camera, Microphone, Bluetooth Connect) on Android
 * before launching the native Jitsi meeting surface.
 */
export async function requestMeetingPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const permissions: Array<any> = [
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ];
    if (Number(Platform.Version) >= 31) {
      permissions.push('android.permission.BLUETOOTH_CONNECT' as any);
    }
    const granted = await PermissionsAndroid.requestMultiple(permissions);
    const cameraOk =
      granted[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
    const audioOk =
      granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
    return cameraOk || audioOk;
  } catch (e) {
    return true;
  }
}

// ── Meeting descriptor (server-side, RBAC + tenant checked) ─────────────────
export function fetchMeetingInfo(sessionId: string): Promise<MeetingInfo> {
  return api<MeetingInfo>(`/live-classes/${sessionId}/meeting`);
}

export function isGoogleMeetUrl(url: string | null | undefined): boolean {
  return !!url && /meet\.google\.com|hangouts?\.google|meet\.google/.test(String(url));
}

/**
 * URL for rendering a meeting *inside a page* — the in-app WebView, or a
 * browser when the user explicitly consents to one.
 *
 * `room_url` arrives bare: the native SDK takes the session JWT as a separate
 * `token` prop, so a WebView has to carry it itself. Jitsi reads it from a
 * `jwt` query param, which is appended exactly once — a stored link that
 * already carries one is left alone, and Google Meet URLs are never touched
 * (callers only use this for the embeddable Jitsi room).
 */
export function meetingWebUrl(info: Pick<MeetingInfo, 'room_url' | 'token'>): string {
  const base = info.room_url;
  const token = (info.token || '').trim();
  if (!token || /[?&]jwt=/.test(base)) return base;
  return `${base}${base.includes('?') ? '&' : '?'}jwt=${encodeURIComponent(token)}`;
}

// ── Honest browser fallback ─────────────────────────────────────────────────
/**
 * Explicit, user-consented browser open.
 *
 * Callers must only reach this from a visible confirmation dialog — the app
 * never silently redirects a meeting to an external browser.
 */
export function confirmOpenInBrowser(
  url: string,
  { title, message }: { title?: string; message?: string } = {},
) {
  Alert.alert(title || 'Open in browser', message || 'This link opens outside the app.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Open',
      onPress: () =>
        Linking.openURL(url).catch(() =>
          Alert.alert('Could not open', 'No app on this device can open that link.'),
        ),
    },
  ]);
}
