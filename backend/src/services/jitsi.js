/**
 * Jitsi helpers shared by the Google Meet fallback (googleMeet.js) and the
 * in-app meeting endpoint (routes/live-classes.js).
 *
 * Keeping room derivation + token signing in one place guarantees every
 * surface (class creation, in-app join) resolves the *same* room for a given
 * session, and that any Jitsi signing secret is used only here — it is never
 * returned to the React Native client.
 */

const jwt = require('jsonwebtoken');

// Free, account-less Jitsi deployment used by default.
const JITSI_BASE = 'https://meet.jit.si';

/**
 * Stable, URL-safe Jitsi room. The same `seed` (e.g. "live_class-6534…")
 * always yields the same room, so participants can rejoin a session.
 */
function jitsiRoomUrl(seed) {
  const slug = String(seed || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return `${JITSI_BASE}/vishva-erp-${slug || Math.random().toString(36).slice(2, 12)}`;
}

/** Which provider a stored meeting URL belongs to. */
function detectMeetingProvider(url) {
  if (!url) return null;
  const u = String(url);
  if (/meet\.jit\.si|\bvishva-erp-/.test(u)) return 'jitsi';
  if (/meet\.google\.com|hangouts?\.google|meet\.google/.test(u)) return 'google';
  return 'other';
}

/**
 * The embeddable in-app room for a session.
 *
 * - If the session already points at a Jitsi room we reuse that URL verbatim
 *   so everyone (in-app and link-sharers) lands in one conference.
 * - Otherwise we derive one deterministically from the session id, so the
 *   room is identical for the teacher and every student without storing a
 *   second record.
 */
function inAppRoomForSession(session) {
  const existing = session && session.meetingUrl;
  if (existing && detectMeetingProvider(existing) === 'jitsi') return existing;
  return jitsiRoomUrl(`live_class-${session && session._id}`);
}

/**
 * Mint a short-lived JWT for a SECURE self-hosted Jitsi deployment.
 *
 * The signing secret (JITSI_JWT_SECRET) lives only on the server; the client
 * receives the encoded token and nothing else. On the public meet.jit.si no
 * auth is required, so this returns null and the SDK joins without a token.
 *
 * NOTE: token shape targets the jitsi-meet JWT plugin. It is only exercised
 * when JITSI_JWT_SECRET is configured and has not been verified against a live
 * secured deployment.
 */
function signJitsiToken({ room, name, email, moderator = false }) {
  const secret = process.env.JITSI_JWT_SECRET;
  const issuer = process.env.JITSI_JWT_ISSUER || 'vishva-erp';
  const audience = process.env.JITSI_JWT_AUDIENCE || 'jitsi';
  const domain = process.env.JITSI_JWT_DOMAIN || undefined;
  if (!secret) return null;

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    aud: audience,
    iss: issuer,
    sub: domain || JITSI_BASE,
    iat: now,
    exp: now + 2 * 60 * 60, // 2 hours
    // '*' authorises every room on the deployment; the room is re-checked
    // by the endpoint's RBAC before the token is even minted.
    room: '*',
    context: {
      user: {
        name: name || 'Guest',
        email: email || undefined,
        moderator: moderator ? 'true' : 'false',
      },
      features: {
        livestreaming: false,
        recording: false,
        transcription: false,
        'breakout-rooms': false,
      },
    },
  };
  if (room) claims.room = String(room);

  return jwt.sign(claims, secret, { algorithm: 'HS256' });
}

module.exports = {
  JITSI_BASE,
  jitsiRoomUrl,
  detectMeetingProvider,
  inAppRoomForSession,
  signJitsiToken,
};
