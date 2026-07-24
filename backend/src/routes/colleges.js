const express = require('express');
const { getDB, oid } = require('../db');
const { requireRole } = require('../auth');
const { sendError } = require('../utils');

const router = express.Router();

function serializeCollege(college) {
  return {
    id: String(college._id),
    name: college.name,
    code: college.code,
    address: college.address || '',
    phone: college.phone || '',
    email: college.email || '',
    logo: college.logo || '',
    created_at: college.createdAt,
  };
}

router.get('/colleges', async (_req, res) => {
  const db = getDB();
  const colleges = await db.collection('colleges').find().toArray();
  res.json(colleges.map(serializeCollege));
});

router.post('/colleges', requireRole('super_admin'), async (req, res) => {
  const db = getDB();
  const now = new Date().toISOString();
  const doc = {
    name: req.body.name,
    code: req.body.code,
    address: req.body.address || '',
    phone: req.body.phone || '',
    email: req.body.email || '',
    logo: req.body.logo || '',
    createdAt: now,
  };
  const result = await db.collection('colleges').insertOne(doc);
  doc._id = result.insertedId;
  res.json(serializeCollege(doc));
});

router.put('/colleges/:id', requireRole('super_admin'), async (req, res) => {
  const db = getDB();
  const college = await db.collection('colleges').findOne({ _id: oid(req.params.id) });
  if (!college) return sendError(res, 'College not found.', 404);
  const update = {};
  if (req.body.name) update.name = req.body.name;
  if (req.body.code) update.code = req.body.code;
  if (req.body.address !== undefined) update.address = req.body.address;
  if (req.body.phone !== undefined) update.phone = req.body.phone;
  if (req.body.email !== undefined) update.email = req.body.email;
  if (req.body.logo !== undefined) update.logo = req.body.logo;
  await db.collection('colleges').updateOne({ _id: college._id }, { $set: update });
  const updated = await db.collection('colleges').findOne({ _id: college._id });
  res.json(serializeCollege(updated));
});

router.delete('/colleges/:id', requireRole('super_admin'), async (req, res) => {
  const db = getDB();
  const college = await db.collection('colleges').findOne({ _id: oid(req.params.id) });
  if (!college) return sendError(res, 'College not found.', 404);
  await db.collection('colleges').deleteOne({ _id: college._id });
  res.json({ ok: true });
});

module.exports = router;
