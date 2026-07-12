const express = require('express');
const { prisma } = require('../db');
const { hashPassword, comparePassword, issueToken, authUser } = require('../auth');
const { inferRole, serializeUser, sendError } = require('../utils');

const router = express.Router();

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  let user = await prisma.user.findUnique({ where: { email: String(email || '').toLowerCase() } });
  if (!user) {
    const role = inferRole(email);
    user = await prisma.user.create({
      data: {
        name: role === 'faculty' ? 'New Faculty' : role === 'parent' ? 'New Parent' : role === 'college_admin' ? 'New Admin' : 'New Student',
        email: String(email || '').toLowerCase(),
        role,
        college: 'Vishva Institute of Technology',
        department: role === 'student' || role === 'faculty' ? 'Computer Science' : undefined,
        studentCode: role === 'student' ? `VIT-AUTO-${Math.floor(Math.random() * 1000)}` : undefined,
        year: role === 'student' ? 1 : undefined,
        passwordHash: await hashPassword(password || 'password123'),
      },
    });
  }
  if (user.status === 'suspended') return sendError(res, 'This account is suspended.', 403);
  if (password) {
    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) return sendError(res, 'Invalid email or password.', 401);
  }
  const token = await issueToken(user.id);
  res.json({ token, user: serializeUser(user) });
});

router.post('/auth/register', async (req, res) => {
  const { name, email, password, role, phone } = req.body || {};
  if (!email || !name) return sendError(res, 'Name and email are required.');
  const existing = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (existing) return sendError(res, 'Email already exists.');
  const user = await prisma.user.create({
    data: {
      name,
      email: String(email).toLowerCase(),
      passwordHash: await hashPassword(password || 'password123'),
      role: role || 'student',
      phone: phone || null,
      college: 'Vishva Institute of Technology',
      department: role === 'faculty' || role === 'student' || !role ? 'Computer Science' : undefined,
      studentCode: (role || 'student') === 'student' ? `VIT-${Math.floor(Math.random() * 9999)}` : undefined,
      year: (role || 'student') === 'student' ? 1 : undefined,
      cgpa: (role || 'student') === 'student' ? 8.1 : undefined,
    },
  });
  const token = await issueToken(user.id);
  res.json({ token, user: serializeUser(user) });
});

router.get('/auth/me', async (req, res) => {
  const user = await authUser(req);
  res.json(serializeUser(user));
});

module.exports = router;
