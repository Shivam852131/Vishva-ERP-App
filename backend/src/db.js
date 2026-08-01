const { MongoClient, ObjectId } = require('mongodb');

const DB_NAME = process.env.MONGODB_DB || 'test';
const LOCAL_URI = process.env.MONGODB_LOCAL_URI || 'mongodb://127.0.0.1:27017';

// Production: use MONGODB_URI env var (Render sets this to Atlas SRV string)
// Fallback: hardcoded direct connection for local development
function resolveUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  const ATLAS_HOSTS = 'ac-xzethlm-shard-00-00.uevx1zw.mongodb.net:27017,ac-xzethlm-shard-00-01.uevx1zw.mongodb.net:27017,ac-xzethlm-shard-00-02.uevx1zw.mongodb.net:27017';
  const ATLAS_USER = 'shivam32880_db_user';
  const ATLAS_PASS = 'pT1L0nBwvGLaNRcV';
  return `mongodb://${ATLAS_USER}:${ATLAS_PASS}@${ATLAS_HOSTS}/${DB_NAME}?authSource=admin&replicaSet=atlas-gbwt42-shard-0&ssl=true&compressors=zlib`;
}

const PRIMARY_URI = resolveUri();

let client = null;
let db = null;
let connectedVia = null;

async function connectDB(retries = 3, delay = 2000) {
  if (db) return db;

  const attempts = [
    { label: 'Primary', uri: PRIMARY_URI },
    { label: 'Local', uri: LOCAL_URI },
  ];

  for (const { label, uri } of attempts) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[MongoDB] Connecting to ${label} (attempt ${attempt})...`);
        client = new MongoClient(uri, {
          serverSelectionTimeoutMS: 10000,
          connectTimeoutMS: 10000,
        });
        await client.connect();
        await client.db('admin').command({ ping: 1 });
        db = client.db(DB_NAME);
        connectedVia = label;

        await Promise.all([
          db.collection('users').createIndex({ email: 1 }, { unique: true }),
          db.collection('users').createIndex({ phone: 1 }, { sparse: true }),
          db.collection('users').createIndex({ role: 1 }),
          db.collection('notifications').createIndex({ createdAt: -1 }),
          db.collection('attendance_sessions').createIndex({ courseId: 1, date: 1 }),
          db.collection('attendance_roll_entries').createIndex({ sessionId: 1, studentId: 1 }),
          db.collection('fees').createIndex({ userId: 1 }),
          db.collection('chat_messages').createIndex({ senderId: 1, receiverId: 1, createdAt: -1 }),
          db.collection('assignments').createIndex({ courseId: 1 }),
          db.collection('submissions').createIndex({ assignmentId: 1, studentId: 1 }),
          db.collection('live_sessions').createIndex({ status: 1, scheduledAt: 1 }),
          db.collection('live_participants').createIndex({ sessionId: 1, studentId: 1 }),
          db.collection('live_messages').createIndex({ sessionId: 1, createdAt: -1 }),
          db.collection('live_questions').createIndex({ sessionId: 1 }),
          db.collection('live_polls').createIndex({ sessionId: 1 }),
          db.collection('placement_drives').createIndex({ status: 1, deadline: 1 }),
          db.collection('placement_applications').createIndex({ studentId: 1, driveId: 1 }, { unique: true }),
          db.collection('assessments').createIndex({ key: 1 }, { unique: true }),
          db.collection('assessment_attempts').createIndex({ studentId: 1, assessmentId: 1, status: 1 }),
          db.collection('student_skills').createIndex({ studentId: 1, skillKey: 1 }, { unique: true }),
          db.collection('skill_endorsements').createIndex({ studentId: 1, skillKey: 1, endorserId: 1 }, { unique: true }),
          db.collection('student_certifications').createIndex({ studentId: 1 }),
          db.collection('student_projects').createIndex({ studentId: 1 }),
          db.collection('mentors').createIndex({ expertise: 1 }),
          db.collection('mentorship_connections').createIndex({ studentId: 1, mentorId: 1 }),
          db.collection('mentorship_sessions').createIndex({ studentId: 1, scheduledAt: 1 }),
          db.collection('mentorship_goals').createIndex({ studentId: 1 }),
          db.collection('payment_configs').createIndex({ collegeId: 1 }, { unique: true }),
          db.collection('payment_configs').createIndex({ collegeId: 1, status: 1 }),
          db.collection('fee_payments').createIndex({ collegeId: 1, studentId: 1 }),
          db.collection('fee_payments').createIndex({ collegeId: 1, status: 1 }),
          db.collection('fee_payments').createIndex({ razorpayOrderId: 1 }),
          db.collection('fee_payments').createIndex({ razorpayPaymentId: 1 }),
          db.collection('fee_payments').createIndex({ orderId: 1 }),
          db.collection('webhook_logs').createIndex({ collegeId: 1, createdAt: -1 }),
          db.collection('colleges').createIndex({ code: 1 }, { sparse: true }),
        ]);

        console.log(`[MongoDB] Connected to "${DB_NAME}" via ${label}`);
        return db;
      } catch (err) {
        console.error(`[MongoDB] ${label} attempt ${attempt}/${retries}: ${err.message}`);
        if (attempt < retries) await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw new Error('[MongoDB] Could not connect to any database.');
}

function getDB() {
  if (!db) throw new Error('Database not connected. Call connectDB() first.');
  return db;
}

function oid(id) {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  try { return new ObjectId(String(id)); } catch { return null; }
}

module.exports = { connectDB, getDB, ObjectId, oid };
