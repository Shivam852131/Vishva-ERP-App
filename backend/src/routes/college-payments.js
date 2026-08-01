const express = require('express');
const crypto = require('crypto');
const { getDB, oid } = require('../db');
const { requireRole } = require('../auth');
const { decrypt } = require('../encryption');
const { sendError, nowIso, makeCode } = require('../utils');

const router = express.Router();

async function getCollegeConfig(collegeId) {
  const db = getDB();
  const oidCollegeId = oid(collegeId) || collegeId;
  const config = await db.collection('payment_configs').findOne({
    collegeId: oidCollegeId,
    status: 'active',
    provider: 'razorpay',
  });
  if (!config) return null;
  try {
    return {
      keyId: config.keyId,
      keySecret: decrypt(config.keySecret),
      mode: config.mode,
    };
  } catch {
    return null;
  }
}

async function resolveAndValidateCollegeId(user) {
  const db = getDB();
  if (user.collegeId) return oid(user.collegeId);
  if (user.college) {
    const college = await db.collection('colleges').findOne({ name: user.college });
    if (college) return college._id;
  }
  return null;
}

router.post('/college-payments/create-order', requireRole('student', 'college_admin'), async (req, res) => {
  try {
    const db = getDB();
    const collegeId = await resolveAndValidateCollegeId(req.user);
    if (!collegeId) return sendError(res, 'No college associated with your account.', 400);

    const config = await getCollegeConfig(collegeId);
    if (!config) return sendError(res, 'Payment gateway not configured for your college. Contact your administrator.', 400);

    const { feeId, amount, currency, feeType, academicYear, semester } = req.body;
    if (!amount || amount <= 0) return sendError(res, 'Valid amount is required.', 400);

    let resolvedAmount = amount;
    let receiptFeeId = feeId;

    if (feeId) {
      const fee = await db.collection('fees').findOne({ _id: oid(feeId) });
      if (!fee) return sendError(res, 'Fee record not found.', 404);
      resolvedAmount = fee.amount;
      receiptFeeId = String(fee._id);
    }

    const auth = Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64');
    const receipt = `rcpt_${String(collegeId)}_${Date.now()}`;

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: resolvedAmount,
        currency: currency || 'INR',
        receipt,
        notes: {
          collegeId: String(collegeId),
          feeId: receiptFeeId || '',
          feeType: feeType || '',
          academicYear: academicYear || '',
          semester: semester || '',
          studentId: String(req.user._id),
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
      keyId: config.keyId,
      receipt: order.receipt,
    });
  } catch (e) {
    sendError(res, e);
  }
});

router.post('/college-payments/verify', requireRole('student', 'college_admin'), async (req, res) => {
  try {
    const db = getDB();
    const collegeId = await resolveAndValidateCollegeId(req.user);
    if (!collegeId) return sendError(res, 'No college associated with your account.', 400);

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, feeId } = req.body;
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return sendError(res, 'Missing payment verification parameters.', 400);
    }

    const config = await getCollegeConfig(collegeId);
    if (!config) return sendError(res, 'Payment gateway not configured.', 400);

    const expectedSignature = crypto
      .createHmac('sha256', config.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      return sendError(res, 'Payment verification failed. Invalid signature.', 400);
    }

    const now = nowIso();
    const paymentId = `fp_${Date.now()}_${makeCode()}`;

    const feePayment = {
      feePaymentId: paymentId,
      collegeId,
      studentId: String(req.user._id),
      amount: req.body.amount || 0,
      currency: req.body.currency || 'INR',
      feeType: req.body.feeType || 'general',
      academicYear: req.body.academicYear || '',
      semester: req.body.semester || '',
      orderId: razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      status: 'completed',
      receipt: `rcpt_${String(collegeId)}_${Date.now()}`,
      paidAt: now,
      createdAt: now,
    };

    await db.collection('fee_payments').insertOne(feePayment);

    if (feeId) {
      await db.collection('fees').updateOne(
        { _id: oid(feeId) },
        { $set: { status: 'paid', paidAt: now, receiptId: paymentId } }
      );
    }

    const existingReceipt = await db.collection('payment_receipts').findOne({
      razorpayPaymentId,
    });
    if (!existingReceipt) {
      const receipt = {
        feeId: feeId ? oid(feeId) : null,
        userId: oid(req.user._id),
        collegeId,
        amount: feePayment.amount,
        razorpayPaymentId,
        razorpayOrderId,
        type: 'fee',
        date: now,
        createdAt: now,
      };
      await db.collection('payment_receipts').insertOne(receipt);
    }

    const notification = {
      audience: 'individual',
      title: 'Fee Payment Received',
      body: `Payment of ₹${(feePayment.amount / 100).toFixed(2)} received for ${feePayment.feeType}.`,
      recipientIds: [oid(req.user._id)],
      readBy: [],
      createdAt: now,
    };
    const notifResult = await db.collection('notifications').insertOne(notification);

    res.json({
      verified: true,
      feePaymentId: paymentId,
      razorpayPaymentId,
      amount: feePayment.amount,
      status: 'completed',
    });
  } catch (e) {
    sendError(res, e);
  }
});

router.get('/college-payments/history', requireRole('student', 'college_admin', 'super_admin'), async (req, res) => {
  try {
    const db = getDB();
    const collegeId = await resolveAndValidateCollegeId(req.user);
    if (!collegeId) return sendError(res, 'No college associated with your account.', 400);

    const filter = { collegeId };
    if (req.user.role === 'student') {
      filter.studentId = String(req.user._id);
    }

    const payments = await db.collection('fee_payments')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    res.json(payments.map(p => ({
      id: p.feePaymentId,
      collegeId: p.collegeId,
      studentId: p.studentId,
      amount: p.amount,
      currency: p.currency,
      feeType: p.feeType,
      academicYear: p.academicYear,
      semester: p.semester,
      orderId: p.orderId,
      razorpayPaymentId: p.razorpayPaymentId,
      status: p.status,
      receipt: p.receipt,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
    })));
  } catch (e) {
    sendError(res, e);
  }
});

router.get('/college-payments/stats', requireRole('college_admin'), async (req, res) => {
  try {
    const db = getDB();
    const collegeId = await resolveAndValidateCollegeId(req.user);
    if (!collegeId) return sendError(res, 'No college associated with your account.', 400);

    const totalPayments = await db.collection('fee_payments').countDocuments({ collegeId });
    const totalAmount = await db.collection('fee_payments')
      .aggregate([
        { $match: { collegeId, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ])
      .toArray();

    const pendingFees = await db.collection('fees')
      .countDocuments({ status: 'pending' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPayments = await db.collection('fee_payments')
      .countDocuments({
        collegeId,
        createdAt: { $gte: today.toISOString() },
      });

    res.json({
      totalPayments,
      totalAmount: totalAmount[0]?.total || 0,
      pendingFees,
      todayPayments,
    });
  } catch (e) {
    sendError(res, e);
  }
});

module.exports = router;
