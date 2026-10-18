const express = require('express');
const { getDB, oid } = require('../db');
const { requireCollegeAccess } = require('../auth');
const { sendError, nowIso } = require('../utils');

const router = express.Router();

const DEFAULT_MENU = [
  { id: '1', name: 'Veg Sandwich', category: 'Snacks', price: 50, available: true, imageUrl: '' },
  { id: '2', name: 'Masala Dosa', category: 'Breakfast', price: 70, available: true, imageUrl: '' },
  { id: '3', name: 'North Indian Thali', category: 'Meals', price: 120, available: true, imageUrl: '' },
  { id: '4', name: 'Cold Coffee', category: 'Beverages', price: 40, available: true, imageUrl: '' },
  { id: '5', name: 'Samosa (2 pcs)', category: 'Snacks', price: 30, available: true, imageUrl: '' },
  { id: '6', name: 'Fruit Salad', category: 'Healthy', price: 60, available: true, imageUrl: '' },
];

// GET /api/canteen/menu
router.get('/menu', requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    let items = await db.collection('canteen_items').find({}).toArray();

    if (!items || items.length === 0) {
      items = DEFAULT_MENU;
    }

    res.json({ success: true, items });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

// GET /api/canteen/wallet
router.get('/wallet', requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const userId = String(req.user.id || req.user._id);

    const txs = await db.collection('wallet_transactions')
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    const balance = txs.reduce((sum, tx) => {
      return tx.type === 'credit' ? sum + tx.amount : sum - tx.amount;
    }, 500);

    res.json({ success: true, balance, transactions: txs });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

// POST /api/canteen/wallet/topup
router.post('/wallet/topup', requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const userId = String(req.user.id || req.user._id);
    const { amount } = req.body;

    if (!amount || Number(amount) <= 0) {
      return sendError(res, 400, 'Valid top-up amount is required');
    }

    const tx = {
      _id: oid(),
      userId,
      amount: Number(amount),
      type: 'credit',
      description: 'Wallet Top-up via Razorpay',
      createdAt: nowIso(),
    };

    await db.collection('wallet_transactions').insertOne(tx);
    res.json({ success: true, transaction: tx });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

// POST /api/canteen/order
router.post('/order', requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const userId = String(req.user.id || req.user._id);
    const { items, totalAmount } = req.body;

    if (!items || !items.length || !totalAmount) {
      return sendError(res, 400, 'Items and total amount are required');
    }

    const walletTx = {
      _id: oid(),
      userId,
      amount: Number(totalAmount),
      type: 'debit',
      description: `Canteen Food Order (${items.length} items)`,
      createdAt: nowIso(),
    };
    await db.collection('wallet_transactions').insertOne(walletTx);

    const order = {
      _id: oid(),
      studentId: userId,
      studentName: req.user.name || 'Student',
      items,
      totalAmount: Number(totalAmount),
      status: 'placed',
      tokenNumber: Math.floor(100 + Math.random() * 900),
      createdAt: nowIso(),
    };
    await db.collection('canteen_orders').insertOne(order);

    res.status(201).json({ success: true, order });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

// GET /api/canteen/orders
router.get('/orders', requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const userId = String(req.user.id || req.user._id);

    const orders = await db.collection('canteen_orders')
      .find({ studentId: userId })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, orders });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

module.exports = router;
