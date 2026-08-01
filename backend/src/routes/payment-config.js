const express = require('express');
const { getDB, oid } = require('../db');
const { requireRole } = require('../auth');
const { encrypt, decrypt } = require('../encryption');
const { sendError, nowIso } = require('../utils');

const router = express.Router();

router.use(requireRole('college_admin', 'super_admin'));

async function getCollegeId(user) {
  const db = getDB();
  if (user.role === 'super_admin' && user.collegeId) {
    return oid(user.collegeId);
  }
  const college = await db.collection('colleges').findOne({ name: user.college });
  return college ? college._id : null;
}

function maskKey(key) {
  if (!key || key.length < 8) return '****';
  return key.slice(0, 6) + '****' + key.slice(-4);
}

router.get('/payment-config', async (req, res) => {
  try {
    const db = getDB();
    const collegeId = await getCollegeId(req.user);
    if (!collegeId) return sendError(res, 'College not found.', 404);

    const config = await db.collection('payment_configs').findOne({ collegeId });
    if (!config) {
      return res.json({
        configured: false,
        mode: 'test',
        keyId: '',
        status: 'inactive',
      });
    }

    res.json({
      configured: true,
      configId: String(config._id),
      mode: config.mode || 'test',
      keyId: config.keyId,
      keySecretMasked: maskKey(decrypt(config.keySecret)),
      webhookConfigured: !!config.webhookSecret,
      status: config.status || 'inactive',
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    });
  } catch (e) {
    sendError(res, e);
  }
});

router.post('/payment-config', async (req, res) => {
  try {
    const db = getDB();
    const collegeId = await getCollegeId(req.user);
    if (!collegeId) return sendError(res, 'College not found.', 404);

    const { keyId, keySecret, mode, webhookSecret } = req.body;
    if (!keyId || !keySecret) {
      return sendError(res, 'Razorpay Key ID and Key Secret are required.');
    }

    if (!keyId.startsWith('rzp_')) {
      return sendError(res, 'Invalid Razorpay Key ID format.');
    }

    const now = nowIso();
    const encryptedSecret = encrypt(keySecret);
    const encryptedWebhook = webhookSecret ? encrypt(webhookSecret) : null;

    const existing = await db.collection('payment_configs').findOne({ collegeId });

    if (existing) {
      await db.collection('payment_configs').updateOne(
        { _id: existing._id },
        {
          $set: {
            keyId,
            keySecret: encryptedSecret,
            mode: mode || 'test',
            webhookSecret: encryptedWebhook || existing.webhookSecret,
            status: 'active',
            updatedAt: now,
          },
        }
      );
    } else {
      await db.collection('payment_configs').insertOne({
        collegeId,
        provider: 'razorpay',
        mode: mode || 'test',
        keyId,
        keySecret: encryptedSecret,
        webhookSecret: encryptedWebhook,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
    }

    res.json({ ok: true, message: 'Payment configuration saved successfully.' });
  } catch (e) {
    sendError(res, e);
  }
});

router.post('/payment-config/verify', async (req, res) => {
  try {
    const db = getDB();
    const collegeId = await getCollegeId(req.user);
    if (!collegeId) return sendError(res, 'College not found.', 404);

    const config = await db.collection('payment_configs').findOne({ collegeId });
    if (!config) return sendError(res, 'No payment configuration found. Please save your Razorpay keys first.');

    const keyId = config.keyId;
    const keySecret = decrypt(config.keySecret);

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const baseUrl = config.mode === 'live' ? 'https://api.razorpay.com' : 'https://api.razorpay.com';

    const response = await fetch(`${baseUrl}/v1/payments`, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (response.ok) {
      await db.collection('payment_configs').updateOne(
        { _id: config._id },
        { $set: { status: 'active', updatedAt: nowIso() } }
      );
      res.json({ ok: true, message: 'Razorpay connection successful.', mode: config.mode });
    } else {
      const err = await response.json();
      await db.collection('payment_configs').updateOne(
        { _id: config._id },
        { $set: { status: 'error', updatedAt: nowIso() } }
      );
      sendError(res, `Razorpay API error: ${err.error?.description || response.statusText}`);
    }
  } catch (e) {
    sendError(res, e);
  }
});

router.delete('/payment-config', async (req, res) => {
  try {
    const db = getDB();
    const collegeId = await getCollegeId(req.user);
    if (!collegeId) return sendError(res, 'College not found.', 404);

    await db.collection('payment_configs').deleteOne({ collegeId });
    res.json({ ok: true, message: 'Payment configuration removed.' });
  } catch (e) {
    sendError(res, e);
  }
});

async function getCollegePaymentConfig(collegeId) {
  const db = getDB();
  const config = await db.collection('payment_configs').findOne({ collegeId });
  if (!config || config.status !== 'active') return null;
  return {
    keyId: config.keyId,
    keySecret: decrypt(config.keySecret),
    webhookSecret: config.webhookSecret ? decrypt(config.webhookSecret) : null,
    mode: config.mode,
  };
}

module.exports = { router, getCollegePaymentConfig, getCollegeId };
