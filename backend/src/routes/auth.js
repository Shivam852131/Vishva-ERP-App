const express = require('express');
const { z } = require('zod');
const { getDB, oid } = require('../db');
const { hashPassword, comparePassword, issueToken, authUser } = require('../auth');
const { serializeUser, sendError } = require('../utils');

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
  res.json({ token, user: serializeUser(user) });
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
  const doc = {
    name,
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password),
    role: resolvedRole,
    phone: phone || null,
    college: 'Vishva Institute of Technology',
    department: resolvedRole === 'student' ? 'Computer Science' : null,
    studentCode: resolvedRole === 'student' ? `VIT-${String(Math.floor(1000 + Math.random() * 9000))}` : null,
    year: resolvedRole === 'student' ? 1 : null,
    cgpa: resolvedRole === 'student' ? 8.1 : null,
    status: 'active',
    isActive: true,
    parentId: null,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection('users').insertOne(doc);
  doc._id = result.insertedId;
  const token = issueToken(doc);
  res.json({ token, user: serializeUser(doc) });
});

router.get('/auth/me', async (req, res) => {
  const user = await authUser(req);
  res.json(serializeUser(user));
});

router.put('/auth/profile', async (req, res) => {
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
  res.json(serializeUser(updated));
});

module.exports = router;
