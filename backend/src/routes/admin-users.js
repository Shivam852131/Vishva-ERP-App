const express = require('express');
const { prisma } = require('../db');
const { hashPassword } = require('../auth');
const { sendError, serializeUser, parseCsv } = require('../utils');

const router = express.Router();

router.get('/admin/users', async (req, res) => {
  const role = req.query.role;
  const users = await prisma.user.findMany({ where: role ? { role } : {} });
  res.json(users.map(serializeUser));
});

router.post('/admin/users', async (req, res) => {
  if (!req.body.name || !req.body.email) return sendError(res, 'Name and email are required.');
  const existing = await prisma.user.findUnique({ where: { email: String(req.body.email).toLowerCase() } });
  if (existing) return sendError(res, 'Email already exists.');
  const user = await prisma.user.create({
    data: {
      name: req.body.name,
      email: String(req.body.email).toLowerCase(),
      passwordHash: await hashPassword(req.body.password || 'password123'),
      role: req.body.role || 'student',
      phone: req.body.phone || null,
      department: req.body.department || null,
      college: req.body.college || 'Vishva Institute of Technology',
      studentCode: req.body.student_id || null,
      year: req.body.year || null,
    },
  });
  if (user.role === 'student' && req.body.parent_email) {
    await prisma.user.create({
      data: {
        name: req.body.parent_name || `${user.name} Parent`,
        email: String(req.body.parent_email).toLowerCase(),
        passwordHash: await hashPassword(req.body.parent_password || 'parent123'),
        role: 'parent',
        phone: req.body.parent_phone || null,
        college: user.college,
        parentUserId: user.id,
      },
    });
  }
  res.json(serializeUser(user));
});

router.put('/admin/users/:id', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return sendError(res, 'User not found.', 404);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: req.body.name || user.name,
      phone: req.body.phone || user.phone,
      department: req.body.department || user.department,
      studentCode: req.body.student_id || user.studentCode,
      year: req.body.year !== null && req.body.year !== undefined ? req.body.year : user.year,
      college: req.body.college || user.college,
    },
  });
  res.json(serializeUser(updated));
});

router.post('/admin/users/:id/status', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return sendError(res, 'User not found.', 404);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { status: req.body.status === 'suspended' ? 'suspended' : 'active' },
  });
  res.json({ ok: true, status: updated.status });
});

router.delete('/admin/users/:id', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return sendError(res, 'User not found.', 404);
  await prisma.user.delete({ where: { id: user.id } });
  res.json({ ok: true });
});

router.post('/admin/users/bulk-import', async (req, res) => {
  const rows = parseCsv(req.body.csv_text);
  if (rows.length < 2) return sendError(res, 'CSV must contain a header and at least one row.');
  const headers = rows[0].split(',').map(item => item.trim());
  let created = 0;
  let parentsCreated = 0;
  const skipped = [];
  const existingEmails = new Set((await prisma.user.findMany({ select: { email: true } })).map(u => u.email.toLowerCase()));

  for (let index = 0; index < rows.length - 1; index += 1) {
    const line = rows[index + 1];
    const values = line.split(',').map(item => item.trim());
    const row = headers.reduce((acc, header, headerIndex) => ({ ...acc, [header]: values[headerIndex] || '' }), {});
    if (!row.name || !row.email || !row.role) {
      skipped.push({ line: index + 2, email: row.email || 'unknown', reason: 'Missing required columns' });
      continue;
    }
    if (existingEmails.has(row.email.toLowerCase())) {
      skipped.push({ line: index + 2, email: row.email, reason: 'Email already exists' });
      continue;
    }
    const user = await prisma.user.create({
      data: {
        name: row.name,
        email: row.email,
        passwordHash: await hashPassword(row.password || 'password123'),
        role: row.role,
        phone: row.phone || null,
        department: row.department || null,
        studentCode: row.student_id || null,
        year: row.year ? Number(row.year) : null,
        college: 'Vishva Institute of Technology',
      },
    });
    existingEmails.add(user.email.toLowerCase());
    created += 1;
    if (row.parent_email) {
      const parent = await prisma.user.create({
        data: {
          name: row.parent_name || `${row.name} Parent`,
          email: row.parent_email,
          passwordHash: await hashPassword('parent123'),
          role: 'parent',
          phone: row.parent_phone || null,
          college: 'Vishva Institute of Technology',
          parentUserId: user.id,
        },
      });
      existingEmails.add(parent.email.toLowerCase());
      parentsCreated += 1;
    }
  }
  res.json({ created, parents_created: parentsCreated, skipped });
});

module.exports = router;
