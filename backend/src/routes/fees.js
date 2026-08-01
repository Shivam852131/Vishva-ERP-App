const { getDB, oid } = require('../db');
const { serializeUser, sendError, makeCode, nowIso, isoDate, paginationParams, sendPaginated, roomForUser } = require('../utils');

function createFeesRouter(io) {
  const { Router } = require('express');
  const router = Router();

  router.get('/fees/me', async (req, res) => {
    try {
      const db = getDB();
      const uid = oid(req.user._id);
      const userId = String(req.user._id);
      const fees = await db.collection('fees')
        .find({ $or: [{ userId: uid }, { userId }] })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(fees);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.get('/fees/my', async (req, res) => {
    try {
      const db = getDB();
      const uid = oid(req.user._id);
      const userId = String(req.user._id);
      const fees = await db.collection('fees')
        .find({ $or: [{ userId: uid }, { userId }] })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(fees);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.get('/fees', async (req, res) => {
    try {
      const db = getDB();
      const filter = {};
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

  router.post('/fees', async (req, res) => {
    try {
      const db = getDB();
      const { userId, type, amount, dueDate, semester } = req.body;
      const fee = {
        userId: oid(userId),
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

  router.post('/fees/pay', async (req, res) => {
    try {
      const db = getDB();
      const { feeId } = req.body;
      const fee = await db.collection('fees').findOne({ _id: oid(feeId) });
      if (!fee) return sendError(res, 'Fee not found', 404);
      const orderId = makeCode('order');
      res.json({
        orderId,
        amount: fee.amount,
        currency: 'INR',
        key: process.env.RAZORPAY_KEY_ID,
      });
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/fees/verify', async (req, res) => {
    try {
      const db = getDB();
      const { feeId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;
      const fee = await db.collection('fees').findOne({ _id: oid(feeId) });
      if (!fee) return sendError(res, 'Fee not found', 404);

      await db.collection('fees').updateOne(
        { _id: oid(feeId) },
        { $set: { status: 'paid' } }
      );

      const receipt = {
        feeId: oid(feeId),
        userId: fee.userId,
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

  router.get('/fees/all', async (req, res) => {
    try {
      const db = getDB();
      const fees = await db.collection('fees')
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
      res.json(fees);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/fees/create', async (req, res) => {
    try {
      const db = getDB();
      const { student_id, type, amount, due_date, semester } = req.body;
      const fee = {
        userId: oid(student_id),
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

  router.post('/fees/:id/remind', async (req, res) => {
    try {
      const db = getDB();
      const fee = await db.collection('fees').findOne({ _id: oid(req.params.id) });
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

  router.get('/fees/receipts', async (req, res) => {
    try {
      const db = getDB();
      const receipts = await db.collection('payment_receipts')
        .find({ userId: oid(req.user._id) })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(receipts);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.get('/fees/reminders', async (req, res) => {
    try {
      const db = getDB();
      const now = new Date();
      const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const fees = await db.collection('fees')
        .find({
          userId: oid(req.user._id),
          status: 'pending',
          dueDate: { $gte: now.toISOString(), $lte: in7.toISOString() },
        })
        .sort({ dueDate: 1 })
        .toArray();
      res.json(fees);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.get('/subscription/current', async (req, res) => {
    try {
      const db = getDB();
      const sub = await db.collection('subscriptions')
        .findOne(
          { userId: oid(req.user._id), status: 'active' },
          { sort: { endDate: -1 } }
        );
      res.json(sub || null);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/subscription/create-order', async (req, res) => {
    try {
      const db = getDB();
      const { plan } = req.body;
      const amounts = { basic: 999, pro: 2999, enterprise: 9999 };
      const amount = amounts[plan];
      if (!amount) return sendError(res, 'Invalid plan', 400);
      const orderId = makeCode('sub_order');
      res.json({
        orderId,
        amount,
        currency: 'INR',
        key: process.env.RAZORPAY_KEY_ID,
      });
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/subscription/verify', async (req, res) => {
    try {
      const db = getDB();
      const { plan, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;
      const amounts = { basic: 999, pro: 2999, enterprise: 9999 };
      const amount = amounts[plan];
      if (!amount) return sendError(res, 'Invalid plan', 400);

      const now = new Date();
      const end = new Date(now);
      end.setMonth(end.getMonth() + 1);

      const subscription = {
        userId: oid(req.user._id),
        plan,
        status: 'active',
        startDate: now.toISOString(),
        endDate: end.toISOString(),
        amount,
        razorpayOrderId,
        createdAt: nowIso(),
      };

      await db.collection('subscriptions').updateMany(
        { userId: oid(req.user._id), status: 'active' },
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
