const express = require('express');
const { getDB, oid } = require('../db');
const { requireCollegeAccess } = require('../auth');
const { sendError, nowIso, makeCode } = require('../utils');

const router = express.Router();

// POST /api/gatepass/request
router.post('/request', requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const { reason, outTime, inTime } = req.body;

    if (!reason || !outTime || !inTime) {
      return sendError(res, 400, 'Reason, outTime, and inTime are required');
    }

    const gatePass = {
      _id: oid(),
      studentId: String(req.user.id || req.user._id),
      studentName: req.user.name || 'Student',
      collegeId: req.user.collegeId || '',
      reason,
      outTime: new Date(outTime).toISOString(),
      inTime: new Date(inTime).toISOString(),
      status: 'pending',
      approvedBy: null,
      qrCode: `GP-${makeCode(8)}`,
      createdAt: nowIso(),
    };

    await db.collection('gate_passes').insertOne(gatePass);
    res.status(201).json({ success: true, gatePass });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

// GET /api/gatepass/my-passes
router.get('/my-passes', requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const studentId = String(req.user.id || req.user._id);
    const passes = await db.collection('gate_passes')
      .find({ studentId })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, passes });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

// GET /api/gatepass/all (Admin/Warden)
router.get('/all', requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const passes = await db.collection('gate_passes')
      .find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    res.json({ success: true, passes });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

// POST /api/gatepass/approve
router.post('/approve', requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const { passId, status } = req.body;

    if (!passId || !['approved', 'rejected'].includes(status)) {
      return sendError(res, 400, 'passId and valid status (approved/rejected) are required');
    }

    const result = await db.collection('gate_passes').updateOne(
      { _id: oid(passId) },
      {
        $set: {
          status,
          approvedBy: req.user.name || req.user.email,
          updatedAt: nowIso(),
        },
      }
    );

    res.json({ success: true, updated: result.modifiedCount > 0 });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

// POST /api/gatepass/verify
router.post('/verify', requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const { qrCode } = req.body;

    const pass = await db.collection('gate_passes').findOne({ qrCode });
    if (!pass) {
      return sendError(res, 404, 'Invalid Gate Pass QR Code');
    }

    if (pass.status !== 'approved' && pass.status !== 'active') {
      return res.json({ success: false, valid: false, message: `Gate Pass is ${pass.status}` });
    }

    const newStatus = pass.status === 'approved' ? 'active' : 'completed';
    await db.collection('gate_passes').updateOne(
      { _id: pass._id },
      { $set: { status: newStatus, scannedAt: nowIso() } }
    );

    res.json({ success: true, valid: true, pass, newStatus });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

module.exports = router;
