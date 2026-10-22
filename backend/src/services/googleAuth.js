/**
 * Google Auth core — sign-in (OAuth 2.0 / ID token verification) plus
 * service-account access tokens used by the Google Meet and Sheets services.
 *
 * Implemented with Node's built-in `crypto` and the existing `jsonwebtoken`
 * dependency, so no extra npm packages are required.
 *
 * Configuration (.env):
 *   GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com        # Sign-in (OAuth web client)
 *   GOOGLE_CLIENT_SECRET=GOCSPX-...                        # Sign-in (OAuth web client)
 *   GOOGLE_REDIRECT_URI=https://api.example.com/api/auth/google/callback
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL=...@...iam.gserviceaccount.com   # Meet + Sheets + Drive
 *   GOOGLE_SERVICE_ACCOUNT_KEY="-----BEGIN PRIVATE KEY-----\n..." # \n-escaped private key
 *   GOOGLE_CALENDAR_ID=primary                              # Calendar used to mint Meet links
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || '';
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
const GOOGLE_SERVICE_ACCOUNT_KEY = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').replace(/\\n/g, '\n');
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const JWKS_CACHE_MS = 6 * 60 * 60 * 1000; // Google rotates certs a few times a day

// ─── Feature flags (routes read these to decide what to expose) ───
function isSignInConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);
}

function isServiceAccountConfigured() {
  return Boolean(GOOGLE_SERVICE_ACCOUNT_EMAIL && GOOGLE_SERVICE_ACCOUNT_KEY);
}

// ─── ID token verification (RS256 against Google's JWKS) ─────────
let jwksCache = { keys: [], fetchedAt: 0 };

async function fetchJwks(force = false) {
  const fresh = jwksCache.keys.length && Date.now() - jwksCache.fetchedAt < JWKS_CACHE_MS;
  if (fresh && !force) return jwksCache.keys;
  const res = await fetch(GOOGLE_JWKS_URL, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Failed to fetch Google signing keys (${res.status}).`);
  const data = await res.json();
  jwksCache = { keys: Array.isArray(data.keys) ? data.keys : [], fetchedAt: Date.now() };
  return jwksCache.keys;
}

async function publicKeyForKid(kid) {
  let keys = await fetchJwks();
  let jwk = keys.find(k => k.kid === kid);
  if (!jwk) {
    // Key rotated since our cache was written — refetch once before failing.
    keys = await fetchJwks(true);
    jwk = keys.find(k => k.kid === kid);
  }
  if (!jwk) throw new Error('Unknown Google signing key.');
  return crypto.createPublicKey({ key: jwk, format: 'jwk' });
}

/**
 * Verify a Google ID token (the `id_token` a client gets from Google Sign-In).
 * Validates signature, audience, issuer and expiry.
 *
 * @returns {Promise<{sub:string, email:string, email_verified:boolean, name?:string, picture?:string}>}
 */
async function verifyGoogleIdToken(idToken) {
  if (!GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID is not configured.');
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error('Invalid Google ID token.');
  }
  const publicKey = await publicKeyForKid(decoded.header.kid);
  const payload = jwt.verify(idToken, publicKey, {
    algorithms: ['RS256'],
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: GOOGLE_CLIENT_ID,
    clockTolerance: 30,
  });
  if (!payload.email) throw new Error('Google account has no email address.');
  return {
    sub: String(payload.sub),
    email: String(payload.email).toLowerCase(),
    email_verified: payload.email_verified !== false,
    name: payload.name || null,
    picture: payload.picture || null,
  };
}

// ─── Authorization-code exchange (used by the app's WebView flow) ─
async function exchangeAuthCode({ code, redirectUri }) {
  if (!isSignInConfigured()) throw new Error('Google Sign-In is not configured.');
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri || GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id_token) {
    throw new Error(data.error_description || data.error || `Google token exchange failed (${res.status}).`);
  }
  return verifyGoogleIdToken(data.id_token);
}

/** Build the Google authorization URL the app's WebView should open. */
function buildAuthorizationUrl({ redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri || GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ─── Service-account access tokens (Meet / Sheets / Drive) ───────
const saTokenCache = new Map(); // scope string -> { token, expiresAt }

async function getGoogleApiAccessToken(scopes) {
  if (!isServiceAccountConfigured()) {
    throw new Error('Google service account is not configured.');
  }
  const scopeKey = Array.isArray(scopes) ? scopes.join(' ') : String(scopes);
  const cached = saTokenCache.get(scopeKey);
  if (cached && Date.now() < cached.expiresAt - 60000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      scope: scopeKey,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    },
    GOOGLE_SERVICE_ACCOUNT_KEY,
    { algorithm: 'RS256' },
  );

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Google token request failed (${res.status}).`);
  }
  saTokenCache.set(scopeKey, {
    token: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  });
  return data.access_token;
}

function calendarId() {
  return GOOGLE_CALENDAR_ID || 'primary';
}

module.exports = {
  isSignInConfigured,
  isServiceAccountConfigured,
  verifyGoogleIdToken,
  exchangeAuthCode,
  buildAuthorizationUrl,
  getGoogleApiAccessToken,
  calendarId,
  GOOGLE_REDIRECT_URI,
  SERVICE_ACCOUNT_EMAIL: GOOGLE_SERVICE_ACCOUNT_EMAIL,
};
