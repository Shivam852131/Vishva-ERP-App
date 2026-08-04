const crypto = require('crypto');
const { getDB, oid } = require('../db');
const { requireRole, collegeFilter, collegeIdOrThrow, requireCollegeAccess } = require('../auth');
const { encrypt, decrypt } = require('../encryption');
const { serializeUser, sendError, makeCode, nowIso, isoDate, paginationParams, sendPaginated, roomForUser } = require('../utils');
const { getCollegePaymentConfig, getCollegeId } = require('./payment-config');

const PLATFORM_KEY_ID = process.env.PLATFORM_RAZORPAY_KEY_ID;
const PLATFORM_KEY_SECRET = process.env.PLATFORM_RAZORPAY_KEY_SECRET;

function verifyRazorpaySignature(orderId, paymentId, signature, secret) {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expected === signature;
}

async function resolveCollegeId(user) {
  const db = getDB();
  if (user.collegeId) return oid(user.collegeId);
  if (user.college) {
    const college = await db.collection('colleges').findOne({ name: user.college });
    if (college) return college._id;
  }
  return null;
}

function createFeesRouter(io) {
  const { Router } = require('express');
  const router = Router();

  router.get('/fees/me', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const uid = oid(req.user._id);
      const userId = String(req.user._id);
      const fees = await db.collection('fees')
        .find({ $or: [{ userId: uid }, { userId }], ...collegeFilter(req) })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(fees);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.get('/fees/my', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const uid = oid(req.user._id);
      const userId = String(req.user._id);
      const fees = await db.collection('fees')
        .find({ $or: [{ userId: uid }, { userId }], ...collegeFilter(req) })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(fees);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.get('/fees', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const filter = { ...collegeFilter(req) };
      if (req.query.status) filter.status = req.query.status;

      const fees = await db.collection('fees')
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray();
      res.json(fees);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/fees', requireRole('college_admin', 'super_admin'), requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const { userId, type, amount, dueDate, semester } = req.body;

      const collegeId = collegeIdOrThrow(req) || await resolveCollegeId(req.user);
      if (!collegeId) return sendError(res, 'College not found.', 404);

      const fee = {
        userId: oid(userId),
        collegeId,
        type,
        amount,
        dueDate,
        status: 'pending',
        semester,
        receiptId: null,
        createdAt: nowIso(),
      };
      const result = await db.collection('fees').insertOne(fee);
      fee._id = result.insertedId;
      if (io) io.to(roomForUser(userId)).emit('fees:update', { feeId: String(result.insertedId), status: 'created' });
      res.json(fee);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/fees/pay', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const { feeId } = req.body;

      const fee = await db.collection('fees').findOne({ _id: oid(feeId), ...collegeFilter(req) });
      if (!fee) return sendError(res, 'Fee not found', 404);

      const studentCollegeId = fee.collegeId || await resolveCollegeId(req.user);
      if (!studentCollegeId) return sendError(res, 'College not configured for payments.', 400);

      const config = await getCollegePaymentConfig(studentCollegeId);
      if (!config) {
        return sendError(res, 'College payment not configured. Please contact your administrator.', 400);
      }

      const auth = Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64');
      const baseUrl = config.mode === 'live' ? 'https://api.razorpay.com' : 'https://api.razorpay.com';

      const receipt = `fee_${String(fee._id).slice(-8)}_${Date.now()}`;
      const orderBody = {
        amount: fee.amount,
        currency: 'INR',
        receipt,
        notes: {
          feeId: String(fee._id),
          collegeId: String(studentCollegeId),
          feeType: fee.type || 'fee',
        },
      };

      const response = await fetch(`${baseUrl}/v1/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderBody),
      });

      if (!response.ok) {
        const err = await response.json();
        console.error('[Razorpay] Order creation failed:', err);
        return sendError(res, `Payment gateway error: ${err.error?.description || 'Failed to create order'}`);
      }

      const order = await response.json();

      await db.collection('fees').updateOne(
        { _id: fee._id },
        { $set: { razorpayOrderId: order.id, updatedAt: nowIso() } }
      );

      res.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: config.keyId,
      });
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/fees/verify', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const { feeId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

      if (!feeId || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
        return sendError(res, 'Missing required payment verification fields.');
      }

      const fee = await db.collection('fees').findOne({ _id: oid(feeId), ...collegeFilter(req) });
      if (!fee) return sendError(res, 'Fee not found', 404);

      const studentCollegeId = fee.collegeId || await resolveCollegeId(req.user);
      if (!studentCollegeId) return sendError(res, 'College not found.', 404);

      const config = await getCollegePaymentConfig(studentCollegeId);
      if (!config) {
        return sendError(res, 'College payment configuration not found.', 400);
      }

      const isValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature, config.keySecret);
      if (!isValid) {
        return sendError(res, 'Payment signature verification failed. Payment may be tampered with.', 403);
      }

      const paymentRecord = {
        collegeId: studentCollegeId,
        studentId: fee.userId,
        feeId: fee._id,
        amount: fee.amount,
        currency: 'INR',
        feeType: fee.type,
        academicYear: fee.semester || null,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        status: 'captured',
        receipt: `fee_${String(fee._id).slice(-8)}_${Date.now()}`,
        paidAt: nowIso(),
        createdAt: nowIso(),
      };
      await db.collection('fee_payments').insertOne(paymentRecord);

      await db.collection('fees').updateOne(
        { _id: oid(feeId) },
        { $set: { status: 'paid' } }
      );

      const receipt = {
        feeId: oid(feeId),
        userId: fee.userId,
        collegeId: studentCollegeId,
        amount: fee.amount,
        razorpayPaymentId,
        date: nowIso(),
        createdAt: nowIso(),
      };
      const receiptResult = await db.collection('payment_receipts').insertOne(receipt);
      receipt._id = receiptResult.insertedId;

      await db.collection('fees').updateOne(
        { _id: oid(feeId) },
        { $set: { receiptId: receipt._id } }
      );

      const notification = {
        audience: 'individual',
        title: 'Payment Received',
        body: `Payment of ₹${fee.amount} received for ${fee.type}.`,
        recipientIds: [fee.userId],
        readBy: [],
        createdAt: nowIso(),
      };
      const notifResult = await db.collection('notifications').insertOne(notification);
      notification._id = notifResult.insertedId;

      if (io) {
        io.to(roomForUser(fee.userId)).emit('notifications:update', notification);
        io.to(roomForUser(fee.userId)).emit('fees:update', { feeId, status: 'paid' });
        io.to(roomForUser(fee.userId)).emit('payments:update', { receiptId: String(receipt._id) });
      }

      res.json(receipt);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.get('/fees/all', requireRole('college_admin', 'super_admin'), requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const filter = { ...collegeFilter(req) };

      const fees = await db.collection('fees')
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray();
      res.json(fees);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/fees/create', requireRole('college_admin', 'super_admin'), requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const { student_id, type, amount, due_date, semester } = req.body;

      const collegeId = collegeIdOrThrow(req) || await resolveCollegeId(req.user);
      if (!collegeId) return sendError(res, 'College not found.', 404);

      const fee = {
        userId: oid(student_id),
        collegeId,
        type,
        amount,
        dueDate: due_date,
        status: 'pending',
        semester,
        receiptId: null,
        createdAt: nowIso(),
      };
      const result = await db.collection('fees').insertOne(fee);
      fee._id = result.insertedId;
      if (io) io.to(roomForUser(student_id)).emit('fees:update', { feeId: String(result.insertedId), status: 'created' });
      res.json(fee);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/fees/:id/remind', requireRole('college_admin', 'super_admin'), requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const fee = await db.collection('fees').findOne({ _id: oid(req.params.id), ...collegeFilter(req) });
      if (!fee) return sendError(res, 'Fee not found', 404);

      const notification = {
        audience: 'individual',
        title: 'Fee Payment Reminder',
        body: `Reminder: Your ${fee.type} fee of ₹${fee.amount} is pending. Please pay before the due date.`,
        recipientIds: [fee.userId],
        readBy: [],
        createdAt: nowIso(),
      };
      const notifResult = await db.collection('notifications').insertOne(notification);
      notification._id = notifResult.insertedId;

      if (io) {
        io.to(roomForUser(fee.userId)).emit('notifications:update', notification);
        io.to(roomForUser(fee.userId)).emit('fees:update', { feeId: req.params.id, status: 'reminded' });
      }

      res.json({ ok: true });
    } catch (e) {
      sendError(res, e);
    }
  });

  router.get('/fees/receipts', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const receipts = await db.collection('payment_receipts')
        .find({ userId: oid(req.user._id), ...collegeFilter(req) })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(receipts);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.get('/fees/reminders', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const now = new Date();
      const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const fees = await db.collection('fees')
        .find({
          userId: oid(req.user._id),
          status: 'pending',
          dueDate: { $gte: now.toISOString(), $lte: in7.toISOString() },
          ...collegeFilter(req),
        })
        .sort({ dueDate: 1 })
        .toArray();
      res.json(fees);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.get('/fees/payments/all', requireRole('college_admin', 'super_admin'), requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const filter = { ...collegeFilter(req) };

      const payments = await db.collection('fee_payments')
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray();
      res.json(payments);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.get('/subscription/current', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const sub = await db.collection('subscriptions')
        .findOne(
          { userId: oid(req.user._id), status: 'active', ...collegeFilter(req) },
          { sort: { endDate: -1 } }
        );
      res.json(sub || null);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/subscription/create-order', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const { plan } = req.body;
      const amounts = { basic: 99900, pro: 299900, enterprise: 999900 };
      const amount = amounts[plan];
      if (!amount) return sendError(res, 'Invalid plan', 400);

      if (!PLATFORM_KEY_ID || !PLATFORM_KEY_SECRET) {
        return sendError(res, 'Platform payment not configured.', 500);
      }

      const auth = Buffer.from(`${PLATFORM_KEY_ID}:${PLATFORM_KEY_SECRET}`).toString('base64');
      const receipt = `sub_${String(req.user._id).slice(-8)}_${Date.now()}`;

      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency: 'INR',
          receipt,
          notes: {
            plan,
            userId: String(req.user._id),
            purpose: 'erp_subscription',
          },
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        return sendError(res, `Payment gateway error: ${err.error?.description || 'Failed to create order'}`);
      }

      const order = await response.json();

      res.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: PLATFORM_KEY_ID,
      });
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/subscription/verify', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const { plan, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;
      const amounts = { basic: 99900, pro: 299900, enterprise: 999900 };
      const amount = amounts[plan];
      if (!amount) return sendError(res, 'Invalid plan', 400);

      if (!PLATFORM_KEY_SECRET) {
        return sendError(res, 'Platform payment not configured.', 500);
      }

      const isValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature, PLATFORM_KEY_SECRET);
      if (!isValid) {
        return sendError(res, 'Payment signature verification failed.', 403);
      }

      const now = new Date();
      const end = new Date(now);
      end.setMonth(end.getMonth() + 1);

      const subscription = {
        userId: oid(req.user._id),
        collegeId: oid(req.userCollegeId),
        plan,
        status: 'active',
        startDate: now.toISOString(),
        endDate: end.toISOString(),
        amount,
        razorpayOrderId,
        razorpayPaymentId,
        createdAt: nowIso(),
      };

      await db.collection('subscriptions').updateMany(
        { userId: oid(req.user._id), status: 'active', ...collegeFilter(req) },
        { $set: { status: 'expired' } }
      );

      const result = await db.collection('subscriptions').insertOne(subscription);
      subscription._id = result.insertedId;

      const notification = {
        audience: 'individual',
        title: 'Subscription Activated',
        body: `Your ${plan} plan is now active.`,
        recipientIds: [oid(req.user._id)],
        readBy: [],
        createdAt: nowIso(),
      };
      const notifResult = await db.collection('notifications').insertOne(notification);
      notification._id = notifResult.insertedId;

      if (io) io.to(roomForUser(req.user._id)).emit('notifications:update', notification);

      res.json(subscription);
    } catch (e) {
      sendError(res, e);
    }
  });

  return router;
}

module.exports = { createFeesRouter };
