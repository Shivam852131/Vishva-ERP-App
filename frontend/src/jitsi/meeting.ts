import { Alert, Linking } from 'react-native';
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

/**
 * Lazily load the official `@jitsi/react-native-sdk`.
 *
 * The SDK is optional. Metro resolves it to `sdk-stub.js` (which exports null)
 * when it is not installed — see metro.config.js — so this `require` always
 * resolves at runtime and bundling never fails on the missing package. When the
 * SDK IS installed we get the real module (which exposes `JitsiMeeting`).
 *
 * Kept lazy and cached so importing this file never triggers native module
 * loading, and so Jest (which has no Metro stub) simply fails the require and
 * falls through to `null`.
 */
export function getNativeSdk(): any | null {
  if (sdkLoaded) return sdkCache;
  sdkLoaded = true;
  sdkCache = null;
  try {
    const mod: any = require('@jitsi/react-native-sdk');
    if (mod) sdkCache = mod.default ?? mod;
  } catch {
    sdkCache = null;
  }
  return sdkCache;
}

/** True when a real native in-app Jitsi surface exists in this build. */
export function isNativeMeetingAvailable(): boolean {
  const sdk = getNativeSdk();
  return !!sdk && typeof sdk.JitsiMeeting === 'function';
}

// ── Meeting descriptor (server-side, RBAC + tenant checked) ─────────────────
export function fetchMeetingInfo(sessionId: string): Promise<MeetingInfo> {
  return api<MeetingInfo>(`/live-classes/${sessionId}/meeting`);
}

export function isGoogleMeetUrl(url: string | null | undefined): boolean {
  return !!url && /meet\.google\.com|hangouts?\.google|meet\.google/.test(String(url));
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
