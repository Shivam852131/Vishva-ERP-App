const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const { getDB, oid } = require('../db');
const { hashPassword, comparePassword, issueToken, authUser, collegeFilter, requireCollegeAccess } = require('../auth');
const { serializeUserWithCollege, sendError } = require('../utils');
const {
  isSignInConfigured, verifyGoogleIdToken, exchangeAuthCode, buildAuthorizationUrl, GOOGLE_REDIRECT_URI,
} = require('../services/googleAuth');

const router = express.Router();

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8),
  phone: z.string().trim().optional(),
  role: z.enum(['student', 'parent', 'faculty']).optional(),
});

// Normalize Atlas role names to our standard names
function normalizeRole(role) {
  const map = {
    collegeAdmin: 'college_admin',
    superadmin: 'super_admin',
    super_admin: 'super_admin',
    college_admin: 'college_admin',
  };
  return map[role] || role || 'student';
}

router.post('/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 'A valid email and password are required.');
  const { email, password } = parsed.data;
  const db = getDB();
  const user = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (!user) return sendError(res, 'Invalid email or password.', 401);
  // Atlas uses isActive, we use status
  if (user.isActive === false || user.status === 'suspended') return sendError(res, 'This account is suspended.', 403);
  // Atlas stores as 'password', we store as 'passwordHash'
  const storedHash = user.passwordHash || user.password;
  if (!storedHash) return sendError(res, 'Invalid email or password.', 401);
  const valid = await comparePassword(password, storedHash);
  if (!valid) return sendError(res, 'Invalid email or password.', 401);
  // Update lastLogin
  await db.collection('users').updateOne({ _id: user._id }, { $set: { lastLogin: new Date().toISOString(), updatedAt: new Date().toISOString() } });
  const token = issueToken(user);
  res.json({ token, user: await serializeUserWithCollege(db, user) });
});

router.post('/auth/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 'Name, a valid email, and a password (min 8 characters) are required.');
  const { name, email, password, phone, role } = parsed.data;
  const db = getDB();
  const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (existing) return sendError(res, 'Email already exists.');
  const resolvedRole = role || 'student';
  const now = new Date().toISOString();
  let col = req.body.collegeId
    ? await db.collection('colleges').findOne({ $or: [{ _id: oid(req.body.collegeId) }, { _id: String(req.body.collegeId) }] })
    : await db.collection('colleges').findOne({});
  if (!col) {
    const newCol = await db.collection('colleges').insertOne({
      name: 'Vishva Institute of Technology',
      code: 'VIT',
      createdAt: now,
    });
    col = { _id: newCol.insertedId, name: 'Vishva Institute of Technology', code: 'VIT' };
  }
  const collegeId = col._id;

  const doc = {
    name,
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password),
    role: resolvedRole,
    phone: phone || null,
    college: col?.name || 'Vishva Institute of Technology',
    collegeId: collegeId ? oid(collegeId) : null,
    department: req.body.department || (resolvedRole === 'student' ? 'General' : null),
    studentCode: req.body.studentCode || (resolvedRole === 'student' ? `VIT-${String(Math.floor(1000 + Math.random() * 9000))}` : null),
    year: req.body.year ? Number(req.body.year) : (resolvedRole === 'student' ? 1 : null),
    cgpa: null,
    status: 'active',
    isActive: true,
    parentId: null,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection('users').insertOne(doc);
  doc._id = result.insertedId;
  const token = issueToken(doc);
  res.json({ token, user: await serializeUserWithCollege(db, doc) });
});

// ─── Google Sign-In ───────────────────────────────────────────────
// Pending OAuth states for the app's WebView sign-in flow (10-minute TTL).
const pendingStates = new Map();

function pruneStates() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [state, createdAt] of pendingStates) {
    if (createdAt < cutoff) pendingStates.delete(state);
  }
}

const APP_REDIRECT_URI = process.env.GOOGLE_APP_REDIRECT_URI || 'vishvaerp://auth';

/**
 * Find the user for a verified Google account, creating one on first sign-in
 * (same self-service rules as /auth/register: new Google users start as
 * students). A verified Google email that already has an account simply logs
 * that account in and links the Google identity.
 */
async function upsertGoogleUser(profile, req) {
  const db = getDB();
  const email = profile.email.toLowerCase();
  const now = new Date().toISOString();
  const google = { sub: profile.sub, email, picture: profile.picture || null, linkedAt: now };

  let user = await db.collection('users').findOne({ email });
  if (user) {
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { google, lastLogin: now, updatedAt: now, ...(user.avatar ? {} : { avatar: profile.picture || null }) } },
    );
    return db.collection('users').findOne({ _id: user._id });
  }

  let col = req.body?.collegeId
    ? await db.collection('colleges').findOne({ $or: [{ _id: oid(req.body.collegeId) }, { _id: String(req.body.collegeId) }] })
    : await db.collection('colleges').findOne({});
  if (!col) {
    const newCol = await db.collection('colleges').insertOne({
      name: 'Vishva Institute of Technology',
      code: 'VIT',
      createdAt: now,
    });
    col = { _id: newCol.insertedId, name: 'Vishva Institute of Technology', code: 'VIT' };
  }

  const doc = {
    name: profile.name || email.split('@')[0],
    email,
    passwordHash: null, // signed up via Google — no local password
    role: 'student',
    phone: null,
    college: col.name,
    collegeId: oid(col._id),
    department: 'General',
    studentCode: `VIT-${String(Math.floor(1000 + Math.random() * 9000))}`,
    year: 1,
    cgpa: null,
    status: 'active',
    isActive: true,
    parentId: null,
    avatar: profile.picture || null,
    google,
    createdAt: now,
    updatedAt: now,
    lastLogin: now,
  };
  const result = await db.collection('users').insertOne(doc);
  doc._id = result.insertedId;
  return doc;
}

async function respondWithGoogleUser(res, profile, req) {
  const user = await upsertGoogleUser(profile, req);
  if (user.isActive === false || user.status === 'suspended') {
    return sendError(res, 'This account is suspended.', 403);
  }
  const token = issueToken(user);
  return res.json({ token, user: await serializeUserWithCollege(getDB(), user) });
}

// Direct ID-token flow (web clients / tests): POST /auth/google { idToken }
router.post('/auth/google', async (req, res) => {
  const parsed = z.object({ idToken: z.string().trim().min(10) }).safeParse(req.body || {});
  if (!parsed.success) return sendError(res, 'A Google ID token is required.');
  if (!isSignInConfigured()) return sendError(res, 'Google Sign-In is not configured on this server.', 503);
  try {
    const profile = await verifyGoogleIdToken(parsed.data.idToken);
    if (!profile.email_verified) return sendError(res, 'Your Google email address is not verified.', 403);
    await respondWithGoogleUser(res, profile, req);
  } catch (err) {
    sendError(res, err.message || 'Google sign-in failed.', 401);
  }
});

// App WebView flow, step 1: redirect the user to Google's consent screen.
router.get('/auth/google/start', (req, res) => {
  if (!isSignInConfigured()) return sendError(res, 'Google Sign-In is not configured on this server.', 503);
  pruneStates();
  const state = crypto.randomBytes(24).toString('hex');
  pendingStates.set(state, Date.now());
  res.redirect(buildAuthorizationUrl({ redirectUri: GOOGLE_REDIRECT_URI, state }));
});

// App WebView flow, step 2: Google redirects here, we exchange the code and
// hand the app a session via its deep-link scheme (vishvaerp://auth?token=…).
router.get('/auth/google/callback', async (req, res) => {
  const fail = message => {
    res.redirect(`${APP_REDIRECT_URI}?error=${encodeURIComponent(message)}`);
  };
  try {
    const { code, state, error } = req.query || {};
    if (error) return fail(String(error));
    if (!code) return sendError(res, 'Missing authorization code.');
    if (!state || !pendingStates.has(state)) return fail('Sign-in session expired. Please try again.');
    pendingStates.delete(state);

    const profile = await exchangeAuthCode({ code, redirectUri: GOOGLE_REDIRECT_URI });
    if (!profile.email_verified) return fail('Your Google email address is not verified.');

    const user = await upsertGoogleUser(profile, req);
    if (user.isActive === false || user.status === 'suspended') return fail('This account is suspended.');

    const token = issueToken(user);
    res.redirect(`${APP_REDIRECT_URI}?token=${encodeURIComponent(token)}&ok=1`);
  } catch (err) {
    fail(err.message || 'Google sign-in failed.');
  }
});

router.get('/auth/me', async (req, res) => {
  const user = await authUser(req);
  const db = getDB();
  res.json(await serializeUserWithCollege(db, user));
});

router.put('/auth/profile', requireCollegeAccess, async (req, res) => {
  const user = await authUser(req);
  if (!user) return sendError(res, 'Authentication required.', 401);

  const db = getDB();
  const update = {};
  if (req.body.name !== undefined) update.name = req.body.name;
  if (req.body.phone !== undefined) update.phone = req.body.phone || null;
  if (req.body.avatar !== undefined) update.avatar = req.body.avatar || null;
  if (req.body.department !== undefined) update.department = req.body.department || null;
  if (req.body.year !== undefined) update.year = req.body.year;
  update.updatedAt = new Date().toISOString();

  await db.collection('users').updateOne({ _id: user._id }, { $set: update });
  const updated = await db.collection('users').findOne({ _id: user._id });
  res.json(await serializeUserWithCollege(db, updated));
});

module.exports = router;
