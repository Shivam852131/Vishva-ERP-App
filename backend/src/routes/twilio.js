const express = require('express');
const { z } = require('zod');
const { sendError } = require('../utils');
const { getDB, oid } = require('../db');
const { issueToken, collegeFilter } = require('../auth');

const router = express.Router();

let twilioClient = null;
function getClient() {
  if (twilioClient) return twilioClient;
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return null;
  try {
    const twilio = require('twilio');
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    return twilioClient;
  } catch {
    return null;
  }
}

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_LENGTH = 6;

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const otpStore = new Map();

// ──────────────────────────── SEND OTP ────────────────────────────
const sendSchema = z.object({ phone: z.string().regex(/^\d{10}$/, 'Must be 10 digits') });

router.post('/auth/send-otp', async (req, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 'A valid 10-digit phone number is required.');

  const { phone } = parsed.data;
  const otp = generateOTP();
  const expiresAt = Date.now() + OTP_TTL_MS;

  otpStore.set(phone, { otp, expiresAt, attempts: 0 });

  const client = getClient();
  if (client) {
    try {
      const fullPhone = `+91${phone}`;
      await client.messages.create({
        body: `Your Vishva ERP verification code is: ${otp}. It expires in 5 minutes. Do not share this code.`,
        from: process.env.TWILIO_WHATSAPP_FROM || `whatsapp:+14155238886`,
        to: `whatsapp:${fullPhone}`,
      });
    } catch (err) {
      try {
        const fullPhone = `+91${phone}`;
        await client.messages.create({
          body: `Your Vishva ERP verification code is: ${otp}. It expires in 5 minutes.`,
          from: process.env.TWILIO_SMS_FROM || '+14155238886',
          to: fullPhone,
        });
      } catch (smsErr) {
        console.error('[Twilio] Failed to send OTP:', err.message, smsErr?.message);
      }
    }
  } else {
    console.warn('[Twilio] No client configured. OTP stored in-memory only.');
  }

  const isProduction = process.env.NODE_ENV === 'production';
  res.json({
    ok: true,
    message: 'OTP sent successfully.',
    ...(!isProduction && { otp, expiresIn: OTP_TTL_MS / 1000 }),
  });
});

// ──────────────────────────── VERIFY OTP ────────────────────────────
const verifySchema = z.object({
  phone: z.string().regex(/^\d{10}$/),
  otp: z.string().length(OTP_LENGTH),
});

router.post('/auth/verify-otp', async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 'Phone and a 6-digit OTP are required.');

  const { phone, otp } = parsed.data;
  const record = otpStore.get(phone);

  if (!record) return sendError(res, 'No OTP found for this number. Please request a new code.', 404);
  if (Date.now() > record.expiresAt) { otpStore.delete(phone); return sendError(res, 'OTP has expired. Please request a new code.', 410); }
  if (record.attempts >= 5) { otpStore.delete(phone); return sendError(res, 'Too many failed attempts. Please request a new code.', 429); }

  record.attempts += 1;

  if (record.otp !== otp) {
    return sendError(res, `Invalid OTP. ${5 - record.attempts} attempts remaining.`, 401);
  }

  otpStore.delete(phone);

  const db = getDB();
  let user = await db.collection('users').findOne({ phone: `+91${phone}` });
  if (!user) {
    const bcrypt = require('bcrypt');
    const crypto = require('crypto');
    const result = await db.collection('users').insertOne({
      name: `User ${phone.slice(-4)}`,
      email: `phone_${phone}@campus.edu`,
      passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10),
      role: 'student',
      phone: `+91${phone}`,
      collegeId: null, // Assigned later by college_admin; requireCollegeAccess middleware blocks access until then
      college: null,
      department: 'Computer Science',
      studentCode: `VIT-P${phone.slice(-4)}`,
      year: 1,
      cgpa: 8.0,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    user = { _id: result.insertedId, name: `User ${phone.slice(-4)}`, email: `phone_${phone}@campus.edu`, role: 'student', phone: `+91${phone}`, college: null, department: 'Computer Science', studentCode: `VIT-P${phone.slice(-4)}` };
  }

  const token = issueToken(user);
  res.json({
    ok: true,
    token,
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      college: user.college,
      department: user.department,
      studentCode: user.studentCode,
    },
  });
});

// ──────────────────────────── WHATSAPP SEND ────────────────────────────
const whatsappSchema = z.object({
  to: z.string().regex(/^\+?\d{10,15}$/),
  message: z.string().min(1).max(1600),
});

router.post('/twilio/whatsapp/send', async (req, res) => {
  const parsed = whatsappSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 'Valid recipient phone and message body are required.');

  const { to, message } = parsed.data;
  const client = getClient();
  if (!client) return sendError(res, 'WhatsApp service not configured.', 503);

  try {
    const recipient = to.startsWith('whatsapp:') ? to : `whatsapp:${to.startsWith('+') ? to : '+91' + to}`;
    const msg = await client.messages.create({
      body: message,
      from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
      to: recipient,
    });
    res.json({ ok: true, sid: msg.sid, status: msg.status });
  } catch (err) {
    console.error('[Twilio WhatsApp] Send failed:', err.message);
    sendError(res, `Failed to send WhatsApp message: ${err.message}`, 502);
  }
});

// ──────────────────────────── WHATSAPP BROADCAST ────────────────────────────
const broadcastSchema = z.object({
  audience: z.enum(['students', 'faculty', 'parents', 'all']),
  message: z.string().min(1).max(1600),
  title: z.string().optional(),
});

router.post('/twilio/whatsapp/broadcast', async (req, res) => {
  const parsed = broadcastSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 'Audience and message are required.');

  const { audience, message, title } = parsed.data;
  const client = getClient();
  if (!client) return sendError(res, 'WhatsApp service not configured.', 503);

  const roleMap = {
    students: ['student'],
    faculty: ['faculty'],
    parents: ['parent'],
    all: ['student', 'faculty', 'parent'],
  };
  const roles = roleMap[audience] || ['student'];
  const db = getDB();
  const users = await db.collection('users').find({
    ...collegeFilter(req),
    role: { $in: roles }, phone: { $ne: null }
  }).project({ phone: 1, name: 1 }).toArray();

  if (users.length === 0) return sendError(res, 'No users with phone numbers found for this audience.', 404);

  const fullMessage = title ? `*${title}*\n\n${message}` : message;
  let sent = 0, failed = 0;

  for (const user of users) {
    try {
      await client.messages.create({
        body: fullMessage,
        from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
        to: `whatsapp:${user.phone}`,
      });
      sent++;
    } catch {
      failed++;
    }
  }

  res.json({ ok: true, sent, failed, total: users.length });
});

module.exports = router;
