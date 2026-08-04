const express = require('express');
const { getDB, oid } = require('../db');
const { hashPassword, requireRole, collegeFilter, requireCollegeAccess } = require('../auth');
const { sendError, serializeUser, parseCsv } = require('../utils');

const router = express.Router();

const PRIVILEGED_ROLES = new Set(['college_admin', 'super_admin']);

router.use(requireRole('college_admin', 'super_admin'));

router.get('/', requireCollegeAccess, async (req, res) => {
  const db = getDB();
  const filter = { ...collegeFilter(req) };
  if (req.query.role) filter.role = req.query.role;
  const users = await db.collection('users').find(filter).toArray();
  res.json(users.map(serializeUser));
});

router.get('/emails', requireCollegeAccess, async (req, res) => {
  const db = getDB();
  const filter = { ...collegeFilter(req), email: { $exists: true } };
  if (req.query.role) filter.role = req.query.role;
  const users = await db.collection('users').find(filter, { projection: { email: 1, name: 1, role: 1 } }).toArray();
  res.json(users.map(u => ({ email: u.email, name: u.name, role: u.role })));
});

router.post('/', requireCollegeAccess, async (req, res) => {
  if (!req.body.name || !req.body.email) return sendError(res, 'Name and email are required.');
  const db = getDB();
  const role = req.body.role || 'student';
  if (PRIVILEGED_ROLES.has(role) && req.user.role !== 'super_admin') {
    return sendError(res, 'Only a super admin can create admin accounts.', 403);
  }
  const existing = await db.collection('users').findOne({ email: String(req.body.email).toLowerCase() });
  if (existing) return sendError(res, 'Email already exists.');
  const now = new Date().toISOString();

  const assignedCollegeId = req.isSuperAdmin && req.body.collegeId
    ? oid(req.body.collegeId)
    : oid(req.userCollegeId);

  const doc = {
    name: req.body.name,
    email: String(req.body.email).toLowerCase(),
    passwordHash: await hashPassword(req.body.password || 'password123'),
    role,
    phone: req.body.phone || null,
    department: req.body.department || null,
    college: req.body.college || 'Vishva Institute of Technology',
    collegeId: assignedCollegeId,
    studentCode: req.body.student_id || null,
    year: req.body.year || null,
    cgpa: null,
    status: 'active',
    parentId: null,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection('users').insertOne(doc);
  doc._id = result.insertedId;

  if (doc.role === 'student' && req.body.parent_email) {
    const parentDoc = {
      name: req.body.parent_name || `${doc.name} Parent`,
      email: String(req.body.parent_email).toLowerCase(),
      passwordHash: await hashPassword(req.body.parent_password || 'parent123'),
      role: 'parent',
      phone: req.body.parent_phone || null,
      college: doc.college,
      collegeId: assignedCollegeId,
      department: null,
      studentCode: null,
      year: null,
      cgpa: null,
      status: 'active',
      parentId: doc._id,
      createdAt: now,
      updatedAt: now,
    };
    const parentResult = await db.collection('users').insertOne(parentDoc);
    parentDoc._id = parentResult.insertedId;
  }

  res.json(serializeUser(doc));
});

router.put('/:id', requireCollegeAccess, async (req, res) => {
  const db = getDB();
  const user = await db.collection('users').findOne({ _id: oid(req.params.id) });
  if (!user) return sendError(res, 'User not found.', 404);

  if (!req.isSuperAdmin) {
    const userCollegeId = user.collegeId ? String(user.collegeId) : null;
    if (!userCollegeId || userCollegeId !== req.userCollegeId) {
      return sendError(res, 'You can only edit users in your own college.', 403);
    }
  }

  const update = {};
  if (req.body.name) update.name = req.body.name;
  if (req.body.email) update.email = String(req.body.email).toLowerCase();
  if (req.body.role) update.role = req.body.role;
  if (req.body.phone !== undefined) update.phone = req.body.phone || null;
  if (req.body.status) update.status = req.body.status;
  if (req.body.college) update.college = req.body.college;
  if (req.body.department !== undefined) update.department = req.body.department || null;
  if (req.body.student_id !== undefined) update.studentCode = req.body.student_id || null;
  if (req.body.year !== undefined) update.year = req.body.year;
  if (req.body.cgpa !== undefined) update.cgpa = req.body.cgpa;
  update.updatedAt = new Date().toISOString();

  if (update.role && PRIVILEGED_ROLES.has(update.role) && req.user.role !== 'super_admin') {
    return sendError(res, 'Only a super admin can modify admin accounts.', 403);
  }

  await db.collection('users').updateOne({ _id: user._id }, { $set: update });
  const updated = await db.collection('users').findOne({ _id: user._id });
  res.json(serializeUser(updated));
});

router.post('/:id/toggle-status', requireCollegeAccess, async (req, res) => {
  const db = getDB();
  const user = await db.collection('users').findOne({ _id: oid(req.params.id) });
  if (!user) return sendError(res, 'User not found.', 404);

  if (!req.isSuperAdmin) {
    const userCollegeId = user.collegeId ? String(user.collegeId) : null;
    if (!userCollegeId || userCollegeId !== req.userCollegeId) {
      return sendError(res, 'You can only modify users in your own college.', 403);
    }
  }

  if (PRIVILEGED_ROLES.has(user.role) && req.user.role !== 'super_admin') {
    return sendError(res, 'Only a super admin can modify admin accounts.', 403);
  }
  const newStatus = user.status === 'suspended' ? 'active' : 'suspended';
  await db.collection('users').updateOne({ _id: user._id }, { $set: { status: newStatus, updatedAt: new Date().toISOString() } });
  res.json({ ok: true, status: newStatus });
});

router.delete('/:id', requireCollegeAccess, async (req, res) => {
  const db = getDB();
  const user = await db.collection('users').findOne({ _id: oid(req.params.id) });
  if (!user) return sendError(res, 'User not found.', 404);

  if (!req.isSuperAdmin) {
    const userCollegeId = user.collegeId ? String(user.collegeId) : null;
    if (!userCollegeId || userCollegeId !== req.userCollegeId) {
      return sendError(res, 'You can only delete users in your own college.', 403);
    }
  }

  if (PRIVILEGED_ROLES.has(user.role) && req.user.role !== 'super_admin') {
    return sendError(res, 'Only a super admin can delete admin accounts.', 403);
  }
  await db.collection('users').deleteOne({ _id: user._id });
  res.json({ ok: true });
});

router.post('/bulk-import', requireCollegeAccess, async (req, res) => {
  const db = getDB();
  const rows = parseCsv(req.body.csv_text);
  if (rows.length < 2) return sendError(res, 'CSV must contain a header and at least one row.');
  const headers = rows[0].split(',').map(item => item.trim());
  let created = 0;
  let parentsCreated = 0;
  const skipped = [];
  const existingEmailFilter = { ...collegeFilter(req) };
  const existingEmails = new Set(
    (await db.collection('users').find(existingEmailFilter, { projection: { email: 1 } }).toArray()).map(u => u.email.toLowerCase())
  );

  const assignedCollegeId = req.isSuperAdmin && req.body.collegeId
    ? oid(req.body.collegeId)
    : oid(req.userCollegeId);

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
    if (PRIVILEGED_ROLES.has(row.role) && req.user.role !== 'super_admin') {
      skipped.push({ line: index + 2, email: row.email, reason: 'Only a super admin can bulk-create admin accounts' });
      continue;
    }
    const now = new Date().toISOString();
    const doc = {
      name: row.name,
      email: row.email.toLowerCase(),
      passwordHash: await hashPassword(row.password || 'password123'),
      role: row.role,
      phone: row.phone || null,
      department: row.department || null,
      studentCode: row.student_id || null,
      year: row.year ? Number(row.year) : null,
      cgpa: null,
      college: 'Vishva Institute of Technology',
      collegeId: assignedCollegeId,
      status: 'active',
      parentId: null,
      createdAt: now,
      updatedAt: now,
    };
    const result = await db.collection('users').insertOne(doc);
    doc._id = result.insertedId;
    existingEmails.add(doc.email);
    created += 1;

    if (row.parent_email) {
      const parentDoc = {
        name: row.parent_name || `${row.name} Parent`,
        email: row.parent_email.toLowerCase(),
        passwordHash: await hashPassword('parent123'),
        role: 'parent',
        phone: row.parent_phone || null,
        college: 'Vishva Institute of Technology',
        collegeId: assignedCollegeId,
        department: null,
        studentCode: null,
        year: null,
        cgpa: null,
        status: 'active',
        parentId: doc._id,
        createdAt: now,
        updatedAt: now,
      };
      const parentResult = await db.collection('users').insertOne(parentDoc);
      parentDoc._id = parentResult.insertedId;
      existingEmails.add(parentDoc.email);
      parentsCreated += 1;
    }
  }
  res.json({ created, parents_created: parentsCreated, skipped });
});

module.exports = router;
