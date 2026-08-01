const crypto = require('crypto');
const express = require('express');
const { getDB, oid } = require('../db');
const { decrypt } = require('../encryption');
const { nowIso, roomForUser } = require('../utils');

const router = express.Router();

function verifyWebhookSignature(body, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expected === signature;
}

function createWebhookRouter(io) {
  router.post('/webhooks/razorpay', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const signature = req.headers['x-razorpay-signature'];
      if (!signature) {
        console.warn('[Webhook] Missing Razorpay signature header');
        return res.status(400).json({ error: 'Missing signature' });
      }

      const rawBody = req.body;
      const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : JSON.stringify(rawBody);

      let payload;
      try {
        payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
      } catch {
        payload = JSON.parse(bodyStr);
      }

      const db = getDB();
      const collegeIdNote = payload.payload?.payment?.entity?.notes?.collegeId;

      let webhookSecret = process.env.PLATFORM_RAZORPAY_WEBHOOK_SECRET;

      if (collegeIdNote) {
        const collegeIdOid = oid(collegeIdNote);
        const query = collegeIdOid ? { $or: [{ collegeId: collegeIdOid }, { collegeId: collegeIdNote }] } : { collegeId: collegeIdNote };
        const config = await db.collection('payment_configs').findOne(query);
        if (config && config.webhookSecret) {
          try {
            webhookSecret = decrypt(config.webhookSecret);
          } catch {
            console.warn('[Webhook] Failed to decrypt webhook secret for college:', collegeIdNote);
          }
        }
      }

      if (!webhookSecret) {
        console.warn('[Webhook] No webhook secret configured');
        return res.status(400).json({ error: 'No webhook secret' });
      }

      const isValid = verifyWebhookSignature(bodyStr, signature, webhookSecret);
      if (!isValid) {
        console.error('[Webhook] Invalid signature');
        return res.status(403).json({ error: 'Invalid signature' });
      }

      const event = payload.event;
      const payment = payload.payload?.payment?.entity;

      console.log(`[Webhook] Received event: ${event}, payment: ${payment?.id}`);

      if (event === 'payment.captured') {
        await handlePaymentCaptured(db, payment, io);
      } else if (event === 'payment.failed') {
        await handlePaymentFailed(db, payment, io);
      } else if (event === 'payment.authorized') {
        console.log(`[Webhook] Payment authorized: ${payment?.id}`);
      }

      res.json({ ok: true });
    } catch (e) {
      console.error('[Webhook] Error processing webhook:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

async function handlePaymentCaptured(db, payment, io) {
  if (!payment || !payment.id) return;

  const existing = await db.collection('fee_payments').findOne({ razorpayPaymentId: payment.id });
  if (existing) {
    console.log(`[Webhook] Payment ${payment.id} already processed`);
    return;
  }

  const notes = payment.notes || {};
  const feeId = notes.feeId;

  if (feeId) {
    const fee = await db.collection('fees').findOne({ _id: oid(feeId) });
    if (fee && fee.status !== 'paid') {
      await db.collection('fees').updateOne(
        { _id: fee._id },
        { $set: { status: 'paid', updatedAt: nowIso() } }
      );

      const paymentRecord = {
        collegeId: fee.collegeId || null,
        studentId: fee.userId,
        feeId: fee._id,
        amount: payment.amount,
        currency: payment.currency || 'INR',
        feeType: fee.type,
        razorpayOrderId: payment.order_id,
        razorpayPaymentId: payment.id,
        razorpaySignature: null,
        status: 'captured',
        receipt: `fee_${String(fee._id).slice(-8)}_${Date.now()}`,
        paidAt: nowIso(),
        createdAt: nowIso(),
      };
      await db.collection('fee_payments').insertOne(paymentRecord);

      const receipt = {
        feeId: fee._id,
        userId: fee.userId,
        collegeId: fee.collegeId || null,
        amount: payment.amount,
        razorpayPaymentId: payment.id,
        date: nowIso(),
        createdAt: nowIso(),
      };
      const receiptResult = await db.collection('payment_receipts').insertOne(receipt);

      const notification = {
        audience: 'individual',
        title: 'Payment Confirmed',
        body: `Your payment of ₹${payment.amount / 100} for ${fee.type} has been confirmed.`,
        recipientIds: [fee.userId],
        readBy: [],
        createdAt: nowIso(),
      };
      const notifResult = await db.collection('notifications').insertOne(notification);

      if (io) {
        io.to(roomForUser(fee.userId)).emit('notifications:update', notification);
        io.to(roomForUser(fee.userId)).emit('fees:update', { feeId: String(fee._id), status: 'paid' });
        io.to(roomForUser(fee.userId)).emit('payments:update', { receiptId: String(receiptResult.insertedId) });
      }

      console.log(`[Webhook] Fee ${feeId} marked as paid via webhook`);
    }
  }
}

async function handlePaymentFailed(db, payment, io) {
  if (!payment || !payment.id) return;

  console.log(`[Webhook] Payment failed: ${payment.id}, error: ${payment.error_description}`);

  const notes = payment.notes || {};
  const feeId = notes.feeId;

  if (feeId) {
    const notification = {
      audience: 'individual',
      title: 'Payment Failed',
      body: `Your payment for fee failed: ${payment.error_description || 'Unknown error'}. Please try again.`,
      recipientIds: [notes.userId ? oid(notes.userId) : null].filter(Boolean),
      readBy: [],
      createdAt: nowIso(),
    };
    const notifResult = await db.collection('notifications').insertOne(notification);

    if (io && notes.userId) {
      io.to(roomForUser(notes.userId)).emit('notifications:update', notification);
    }
  }
}

module.exports = { createWebhookRouter };
