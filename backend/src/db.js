const { MongoClient, ObjectId } = require('mongodb');

const DB_NAME = process.env.MONGODB_DB || 'test';

const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb://shivam32880_db_user:pT1L0nBwvGLaNRcV@ac-xzethlm-shard-00-00.uevx1zw.mongodb.net:27017,ac-xzethlm-shard-00-01.uevx1zw.mongodb.net:27017,ac-xzethlm-shard-00-02.uevx1zw.mongodb.net:27017/test?authSource=admin&replicaSet=atlas-gbwt42-shard-0&ssl=true';

const POOL_OPTIONS = {
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
};

let client = null;
let db = null;

async function connectDB(retries = 3, delay = 2000) {
  if (db) return db;

  console.log('[MongoDB] Connecting to Atlas cluster...');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[MongoDB] Connecting (attempt ${attempt}/${retries})...`);
      client = new MongoClient(MONGODB_URI, POOL_OPTIONS);
      await client.connect();
      await client.db('admin').command({ ping: 1 });
      db = client.db(DB_NAME);

      await createIndexes(db);

      console.log(`[MongoDB] Connected to "${DB_NAME}"`);
      return db;
    } catch (err) {
      console.error(`[MongoDB] Attempt ${attempt}/${retries} failed: ${err.message}`);
      if (client) { client.close().catch(() => {}); client = null; }
      if (attempt < retries) await new Promise(r => setTimeout(r, delay));
    }
  }

  throw new Error('[MongoDB] Could not connect to any database.');
}

async function ensureConnection() {
  if (!db || !client) {
    db = null;
    client = null;
    await connectDB();
    return;
  }
  try {
    await client.db('admin').command({ ping: 1 });
  } catch {
    console.warn('[MongoDB] Connection lost, reconnecting...');
    try { await client.close(); } catch {}
    client = null;
    db = null;
    await connectDB();
  }
}

async function closeDB() {
  if (client) {
    try { await client.close(); } catch {}
    client = null;
    db = null;
    console.log('[MongoDB] Connection closed.');
  }
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

async function createIndexes(database) {
  await Promise.all([
    database.collection('users').createIndex({ email: 1 }, { unique: true }),
    database.collection('users').createIndex({ phone: 1 }, { sparse: true }),
    database.collection('users').createIndex({ role: 1 }),
    database.collection('notifications').createIndex({ createdAt: -1 }),
    database.collection('attendance_sessions').createIndex({ courseId: 1, date: 1 }),
    database.collection('attendance_roll_entries').createIndex({ sessionId: 1, studentId: 1 }),
    database.collection('fees').createIndex({ userId: 1 }),
    database.collection('chat_messages').createIndex({ senderId: 1, receiverId: 1, createdAt: -1 }),
    database.collection('assignments').createIndex({ courseId: 1 }),
    database.collection('submissions').createIndex({ assignmentId: 1, studentId: 1 }),
    database.collection('live_sessions').createIndex({ status: 1, scheduledAt: 1 }),
    database.collection('live_participants').createIndex({ sessionId: 1, studentId: 1 }),
    database.collection('live_messages').createIndex({ sessionId: 1, createdAt: -1 }),
    database.collection('live_questions').createIndex({ sessionId: 1 }),
    database.collection('live_polls').createIndex({ sessionId: 1 }),
    database.collection('placement_drives').createIndex({ status: 1, deadline: 1 }),
    database.collection('placement_applications').createIndex({ studentId: 1, driveId: 1 }, { unique: true }),
    database.collection('assessments').createIndex({ key: 1 }, { unique: true }),
    database.collection('assessment_attempts').createIndex({ studentId: 1, assessmentId: 1, status: 1 }),
    database.collection('student_skills').createIndex({ studentId: 1, skillKey: 1 }, { unique: true }),
    database.collection('skill_endorsements').createIndex({ studentId: 1, skillKey: 1, endorserId: 1 }, { unique: true }),
    database.collection('student_certifications').createIndex({ studentId: 1 }),
    database.collection('student_projects').createIndex({ studentId: 1 }),
    database.collection('mentors').createIndex({ expertise: 1 }),
    database.collection('mentorship_connections').createIndex({ studentId: 1, mentorId: 1 }),
    database.collection('mentorship_sessions').createIndex({ studentId: 1, scheduledAt: 1 }),
    database.collection('mentorship_goals').createIndex({ studentId: 1 }),
    database.collection('payment_configs').createIndex({ collegeId: 1 }, { unique: true }),
    database.collection('payment_configs').createIndex({ collegeId: 1, status: 1 }),
    database.collection('fee_payments').createIndex({ collegeId: 1, studentId: 1 }),
    database.collection('fee_payments').createIndex({ collegeId: 1, status: 1 }),
    database.collection('fee_payments').createIndex({ razorpayOrderId: 1 }),
    database.collection('fee_payments').createIndex({ razorpayPaymentId: 1 }),
    database.collection('fee_payments').createIndex({ orderId: 1 }),
    database.collection('webhook_logs').createIndex({ collegeId: 1, createdAt: -1 }),
    database.collection('colleges').createIndex({ code: 1 }, { unique: true }),
    database.collection('courses').createIndex({ facultyId: 1 }),
    database.collection('timetable_slots').createIndex({ courseId: 1, dayOfWeek: 1 }),
    database.collection('timetable_slots').createIndex({ facultyId: 1 }),
    database.collection('notes').createIndex({ courseId: 1 }),
    database.collection('notes').createIndex({ createdAt: -1 }),
    database.collection('exams').createIndex({ courseId: 1 }),
    database.collection('generated_exams').createIndex({ createdById: 1 }),
    database.collection('exam_results').createIndex({ studentId: 1, courseId: 1 }),
    database.collection('course_enrollments').createIndex({ studentId: 1, courseId: 1 }, { unique: true }),
  ]);
}

module.exports = { connectDB, getDB, closeDB, ensureConnection, ObjectId, oid };
