const express = require('express');
const { getDB, oid } = require('../db');
const { requireCollegeAccess } = require('../auth');
const { sendError, nowIso, makeCode } = require('../utils');

const router = express.Router();

// POST /api/admission/apply
router.post('/apply', async (req, res) => {
  try {
    const db = getDB();
    const { applicantName, email, phone, course, previousMarks, address } = req.body;

    if (!applicantName || !email || !phone || !course) {
      return sendError(res, 400, 'Name, email, phone, and course are required');
    }

    const applicationNo = `ADM-${makeCode(6)}`;
    const application = {
      _id: oid(),
      applicationNo,
      applicantName,
      email,
      phone,
      course,
      previousMarks: previousMarks || '85%',
      address: address || '',
      status: 'submitted',
      createdAt: nowIso(),
    };

    await db.collection('admission_applications').insertOne(application);
    res.status(201).json({ success: true, applicationNo, application });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

// GET /api/admission/status
router.get('/status', async (req, res) => {
  try {
    const db = getDB();
    const { applicationNo, email } = req.query;

    if (!applicationNo && !email) {
      return sendError(res, 400, 'Application number or email required');
    }

    const query = {};
    if (applicationNo) query.applicationNo = String(applicationNo);
    if (email) query.email = String(email);

    const application = await db.collection('admission_applications').findOne(query);
    if (!application) {
      return sendError(res, 404, 'Application not found');
    }

    res.json({ success: true, application });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

// GET /api/admission/admin/list
router.get('/admin/list', requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const applications = await db.collection('admission_applications')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, applications });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

// POST /api/admission/admin/update-status
router.post('/admin/update-status', requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const { applicationId, status } = req.body;

    if (!applicationId || !status) {
      return sendError(res, 400, 'applicationId and status are required');
    }

    const result = await db.collection('admission_applications').updateOne(
      { _id: oid(applicationId) },
      { $set: { status, updatedAt: nowIso() } }
    );

    res.json({ success: true, updated: result.modifiedCount > 0 });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

module.exports = router;
