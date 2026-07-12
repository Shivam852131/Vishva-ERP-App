const express = require('express');
const { prisma } = require('../db');
const { authUser, requireRole } = require('../auth');
const { sendError, daysFromNow } = require('../utils');

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
const planPrices = { basic: 99900, pro: 299900, enterprise: 499900 };

function serializeFee(fee) {
  return {
    id: fee.id,
    student_id: fee.studentId,
    type: fee.type,
    amount: fee.amount,
    currency: fee.currency,
    due_date: fee.dueDate.toISOString(),
    status: fee.status,
    paid_at: fee.paidAt ? fee.paidAt.toISOString() : undefined,
    semester: fee.semester,
  };
}

function createFeesRouter(io) {
  const router = express.Router();

  async function emitFeesUpdate(payload = {}) {
    io.emit('fees:update', payload);
  }

  async function pushNotification({ audience = 'all', title, body, recipientIds = [] }) {
    const notification = await prisma.notification.create({ data: { audience, title, body, recipientIds, readBy: [] } });
    io.emit('notifications:update', { audience, recipientIds });
    return notification;
  }

  router.get('/fees/me', async (req, res) => {
    const user = await authUser(req);
    const fees = await prisma.fee.findMany({ where: { studentId: user.id } });
    res.json(fees.map(serializeFee));
  });

  router.get('/fees/my', async (req, res) => {
    const user = await authUser(req);
    const fees = await prisma.fee.findMany({ where: { studentId: user.id } });
    res.json(fees.map(serializeFee));
  });

  router.get('/fees/all', requireRole('college_admin', 'super_admin'), async (_req, res) => {
    const fees = await prisma.fee.findMany();
    res.json(fees.map(serializeFee));
  });

  router.post('/fees/pay', async (req, res) => {
    const user = await authUser(req);
    const isAdmin = ['college_admin', 'super_admin'].includes(user.role);
    const fee = req.body.fee_id
      ? await prisma.fee.findUnique({ where: { id: req.body.fee_id } })
      : await prisma.fee.findFirst({ where: { status: 'pending', ...(isAdmin ? {} : { studentId: user.id }) } });
    if (!fee) return sendError(res, 'Fee not found.', 404);
    if (!isAdmin && fee.studentId !== user.id) return sendError(res, 'This fee does not belong to you.', 403);
    res.json({
      demo: true,
      key_id: RAZORPAY_KEY_ID,
      order_id: `order_fee_${Date.now()}`,
      amount: fee.amount,
      currency: fee.currency,
      receipt: `fee_${fee.id}_${Date.now()}`,
      fee_id: fee.id,
    });
  });

  router.post('/payments/verify', async (req, res) => {
    const user = await authUser(req);
    const isAdmin = ['college_admin', 'super_admin'].includes(user.role);
    if (req.body.purpose === 'subscription') {
      if (!isAdmin) return sendError(res, 'Only an admin can manage the college subscription.', 403);
      const plan = req.body.plan_id || 'pro';
      const renews = daysFromNow(plan === 'enterprise' ? 365 : plan === 'pro' ? 180 : 30);
      let subscription = await prisma.subscription.findFirst();
      subscription = subscription
        ? await prisma.subscription.update({
            where: { id: subscription.id },
            data: { active: true, plan, status: 'active', renewsAt: new Date(renews), expiresAt: new Date(renews) },
          })
        : await prisma.subscription.create({
            data: { active: true, plan, status: 'active', renewsAt: new Date(renews), expiresAt: new Date(renews), seatsUsed: 0, seatsLimit: 5000 },
          });
      const receipt = await prisma.paymentReceipt.create({
        data: {
          type: 'subscription',
          amount: planPrices[plan] || planPrices.pro,
          currency: 'INR',
          paymentId: req.body.razorpay_payment_id || `pay_demo_${Date.now()}`,
          orderId: req.body.razorpay_order_id || req.body.order_id,
          planId: plan,
          status: 'paid',
        },
      });
      const subscriptionState = {
        active: subscription.active,
        plan: subscription.plan,
        status: subscription.status,
        renews_at: subscription.renewsAt.toISOString(),
        expires_at: subscription.expiresAt.toISOString(),
        seats_used: subscription.seatsUsed,
        seats_limit: subscription.seatsLimit,
      };
      io.emit('subscription:update', subscriptionState);
      return res.json({ verified: true, receipt_id: receipt.id, subscription: subscriptionState });
    }
    const fee = await prisma.fee.findUnique({ where: { id: req.body.fee_id } });
    if (!fee) return sendError(res, 'Fee not found.', 404);
    if (!isAdmin && fee.studentId !== user.id) return sendError(res, 'This fee does not belong to you.', 403);
    const updatedFee = await prisma.fee.update({ where: { id: fee.id }, data: { status: 'paid', paidAt: new Date() } });
    const receipt = await prisma.paymentReceipt.create({
      data: {
        type: 'fee',
        feeId: fee.id,
        amount: fee.amount,
        currency: fee.currency,
        paymentId: req.body.razorpay_payment_id || `pay_demo_${Date.now()}`,
        orderId: req.body.razorpay_order_id || req.body.order_id,
        status: 'paid',
      },
    });
    await pushNotification({ audience: 'students', title: 'Payment received', body: `${fee.type} has been marked as paid.` });
    io.emit('payments:update', { feeId: fee.id, receiptId: receipt.id });
    await emitFeesUpdate({ feeId: fee.id, studentId: updatedFee.studentId, status: updatedFee.status });
    res.json({ verified: true, receipt_id: receipt.id });
  });

  router.get('/payments/receipts', requireRole('college_admin', 'super_admin'), async (_req, res) => {
    const receipts = await prisma.paymentReceipt.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(receipts.map(receipt => ({
      id: receipt.id,
      type: receipt.type,
      fee_id: receipt.feeId || undefined,
      amount: receipt.amount,
      currency: receipt.currency,
      payment_id: receipt.paymentId,
      order_id: receipt.orderId,
      paid_at: receipt.paidAt ? receipt.paidAt.toISOString() : receipt.createdAt.toISOString(),
      created_at: receipt.createdAt.toISOString(),
      status: receipt.status,
      method: 'Razorpay',
    })));
  });

  router.post('/fees/create', requireRole('college_admin', 'super_admin'), async (req, res) => {
    const fee = await prisma.fee.create({
      data: {
        studentId: req.body.student_id,
        type: req.body.type || 'Fee',
        amount: Number(req.body.amount || 0),
        currency: 'INR',
        dueDate: new Date(req.body.due_date || daysFromNow(15)),
        status: 'pending',
        semester: req.body.semester || 'Semester',
      },
    });
    await pushNotification({ audience: 'students', title: 'New fee posted', body: `${fee.type} is due on ${fee.dueDate.toISOString().slice(0, 10)}.`, recipientIds: [fee.studentId] });
    await emitFeesUpdate({ feeId: fee.id, studentId: fee.studentId, status: fee.status });
    res.json(serializeFee(fee));
  });

  router.post('/fees/:feeId/remind', requireRole('college_admin', 'super_admin'), async (req, res) => {
    const fee = await prisma.fee.findUnique({ where: { id: req.params.feeId } });
    if (!fee) return sendError(res, 'Fee not found.', 404);
    await pushNotification({ audience: 'students', title: 'Fee reminder', body: `${fee.type} is still pending.`, recipientIds: [fee.studentId] });
    res.json({ ok: true });
  });

  router.get('/subscription/current', async (_req, res) => {
    const subscription = await prisma.subscription.findFirst();
    if (!subscription) return res.json(null);
    res.json({
      active: subscription.active,
      plan: subscription.plan,
      status: subscription.status,
      renews_at: subscription.renewsAt.toISOString(),
      expires_at: subscription.expiresAt.toISOString(),
      seats_used: subscription.seatsUsed,
      seats_limit: subscription.seatsLimit,
    });
  });

  router.post('/subscription/create-order', requireRole('college_admin', 'super_admin'), async (req, res) => {
    const planId = req.body.plan_id || 'pro';
    res.json({
      demo: true,
      key_id: RAZORPAY_KEY_ID,
      order_id: `order_sub_${Date.now()}`,
      amount: planPrices[planId] || planPrices.pro,
      currency: 'INR',
      receipt: `subscription_${planId}_${Date.now()}`,
      plan_id: planId,
    });
  });

  return router;
}

module.exports = { createFeesRouter };
