const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
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
  role: z.enum(['student', 'parent']).optional(),
});

router.post('/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 'A valid email and password are required.');
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return sendError(res, 'Invalid email or password.', 401);
  if (user.status === 'suspended') return sendError(res, 'This account is suspended.', 403);
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) return sendError(res, 'Invalid email or password.', 401);
  const token = issueToken(user);
  res.json({ token, user: serializeUser(user) });
});

// Public self-registration is limited to student/parent accounts. Staff accounts
// (faculty/college_admin/super_admin) can only be created by an authenticated
// admin via POST /admin/users.
router.post('/auth/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 'Name, a valid email, and a password (min 8 characters) are required.');
  const { name, email, password, phone, role } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return sendError(res, 'Email already exists.');
  const resolvedRole = role || 'student';
  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
      role: resolvedRole,
      phone: phone || null,
      college: 'Vishva Institute of Technology',
      department: resolvedRole === 'student' ? 'Computer Science' : undefined,
      studentCode: resolvedRole === 'student' ? `VIT-${Math.floor(Math.random() * 9999)}` : undefined,
      year: resolvedRole === 'student' ? 1 : undefined,
      cgpa: resolvedRole === 'student' ? 8.1 : undefined,
    },
  });
  const token = issueToken(user);
  res.json({ token, user: serializeUser(user) });
});

router.get('/auth/me', async (req, res) => {
  const user = await authUser(req);
  res.json(serializeUser(user));
});

module.exports = router;
