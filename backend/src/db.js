const { MongoClient, ObjectId } = require('mongodb');

const DB_NAME = process.env.MONGODB_DB || 'test';
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required. See .env.example for reference.');
}

const POOL_OPTIONS = {
  maxPoolSize: 100,
  minPoolSize: 10,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  retryWrites: true,
  w: 'majority',
};

let client = null;
let db = null;

async function connectDB(retries = 3, delay = 2000) {
  if (db) return db;

  console.log('[MongoDB] Connecting to cluster...');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[MongoDB] Connecting (attempt ${attempt}/${retries})...`);
      client = new MongoClient(MONGODB_URI, POOL_OPTIONS);
      await client.connect();
      await client.db('admin').command({ ping: 1 });
      db = client.db(DB_NAME);

      createIndexes(db).catch(err => {
        console.error('[MongoDB] Background index creation error:', err.message);
      });

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
  if (db && client) return;
  db = null;
  client = null;
  await connectDB();
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

const INDEX_DEFS = [
  ['users', { email: 1 }, { unique: true }],
  ['users', { phone: 1 }, { sparse: true }],
  ['users', { role: 1 }],
  ['users', { collegeId: 1 }],
  ['users', { collegeId: 1, role: 1 }],
  ['notifications', { createdAt: -1 }],
  ['notifications', { collegeId: 1 }],
  ['attendance_sessions', { courseId: 1, date: 1 }],
  ['attendance_sessions', { collegeId: 1 }],
  ['attendance_sessions', { collegeId: 1, courseId: 1 }],
  ['attendance_roll_entries', { sessionId: 1, studentId: 1 }],
  ['attendance_roll_entries', { collegeId: 1 }],
  ['attendance_records', { collegeId: 1 }],
  ['attendance_records', { collegeId: 1, studentId: 1 }],
  ['fees', { userId: 1 }],
  ['fees', { collegeId: 1 }],
  ['fees', { collegeId: 1, userId: 1 }],
  ['chat_messages', { senderId: 1, receiverId: 1, createdAt: -1 }],
  ['chat_messages', { collegeId: 1 }],
  ['assignments', { courseId: 1 }],
  ['assignments', { collegeId: 1 }],
  ['submissions', { assignmentId: 1, studentId: 1 }],
  ['submissions', { collegeId: 1 }],
  ['live_sessions', { status: 1, scheduledAt: 1 }],
  ['live_sessions', { collegeId: 1 }],
  ['live_participants', { sessionId: 1, studentId: 1 }],
  ['live_participants', { collegeId: 1 }],
  ['live_messages', { sessionId: 1, createdAt: -1 }],
  ['live_messages', { collegeId: 1 }],
  ['live_questions', { sessionId: 1 }],
  ['live_questions', { collegeId: 1 }],
  ['live_polls', { sessionId: 1 }],
  ['live_polls', { collegeId: 1 }],
  ['placement_drives', { status: 1, deadline: 1 }],
  ['placement_drives', { collegeId: 1 }],
  ['placement_applications', { studentId: 1, driveId: 1 }, { unique: true }],
  ['placement_applications', { collegeId: 1 }],
  ['assessments', { key: 1 }, { unique: true }],
  ['assessments', { collegeId: 1 }],
  ['assessment_attempts', { studentId: 1, assessmentId: 1, status: 1 }],
  ['assessment_attempts', { collegeId: 1 }],
  ['student_skills', { studentId: 1, skillKey: 1 }, { unique: true }],
  ['student_skills', { collegeId: 1 }],
  ['skill_endorsements', { studentId: 1, skillKey: 1, endorserId: 1 }, { unique: true }],
  ['skill_endorsements', { collegeId: 1 }],
  ['student_certifications', { studentId: 1 }],
  ['student_certifications', { collegeId: 1 }],
  ['student_projects', { studentId: 1 }],
  ['student_projects', { collegeId: 1 }],
  ['mentors', { expertise: 1 }],
  ['mentors', { collegeId: 1 }],
  ['mentorship_connections', { studentId: 1, mentorId: 1 }],
  ['mentorship_connections', { collegeId: 1 }],
  ['mentorship_sessions', { studentId: 1, scheduledAt: 1 }],
  ['mentorship_sessions', { collegeId: 1 }],
  ['mentorship_goals', { studentId: 1 }],
  ['mentorship_goals', { collegeId: 1 }],
  ['payment_configs', { collegeId: 1 }, { unique: true }],
  ['payment_configs', { collegeId: 1, status: 1 }],
  ['fee_payments', { collegeId: 1, studentId: 1 }],
  ['fee_payments', { collegeId: 1, status: 1 }],
  ['fee_payments', { razorpayOrderId: 1 }],
  ['fee_payments', { razorpayPaymentId: 1 }],
  ['fee_payments', { orderId: 1 }],
  ['webhook_logs', { collegeId: 1, createdAt: -1 }],
  ['colleges', { code: 1 }, { unique: true }],
  ['courses', { facultyId: 1 }],
  ['courses', { collegeId: 1 }],
  ['courses', { collegeId: 1, department: 1 }],
  ['timetable_slots', { courseId: 1, dayOfWeek: 1 }],
  ['timetable_slots', { facultyId: 1 }],
  ['timetable_slots', { collegeId: 1 }],
  ['notes', { courseId: 1 }],
  ['notes', { createdAt: -1 }],
  ['notes', { collegeId: 1 }],
  ['exams', { courseId: 1 }],
  ['exams', { collegeId: 1 }],
  ['generated_exams', { createdById: 1 }],
  ['generated_exams', { collegeId: 1 }],
  ['exam_results', { studentId: 1, courseId: 1 }],
  ['exam_results', { collegeId: 1 }],
  ['course_enrollments', { studentId: 1, courseId: 1 }, { unique: true }],
  ['course_enrollments', { collegeId: 1 }],
  // ── Academic structure: College → Session → Program → Branch → Year → Semester → Subject ──
  ['academic_sessions', { collegeId: 1 }],
  ['academic_sessions', { collegeId: 1, name: 1 }],
  ['programs', { collegeId: 1 }],
  ['programs', { collegeId: 1, code: 1 }],
  ['branches', { collegeId: 1, programId: 1 }],
  ['branches', { collegeId: 1, programId: 1, code: 1 }],
  ['sections', { collegeId: 1, programId: 1, branchId: 1 }],
  ['courses', { collegeId: 1, code: 1 }],
  ['courses', { collegeId: 1, programId: 1, branchId: 1, semester: 1 }],
  ['faculty_assignments', { collegeId: 1, facultyId: 1, active: 1 }],
  ['faculty_assignments', { collegeId: 1, courseId: 1 }],
  ['faculty_assignments', { collegeId: 1, sessionId: 1 }],
  ['faculty_assignments', { collegeId: 1, sessionId: 1, courseId: 1, sectionId: 1 }],
  ['student_enrollments', { collegeId: 1, studentId: 1, sessionId: 1 }],
  ['student_enrollments', { collegeId: 1, sessionId: 1, programId: 1, branchId: 1, year: 1, semester: 1, sectionId: 1 }],
  ['student_enrollments', { collegeId: 1, status: 1 }],
  // ── Attendance history (date-wise / course-wise reporting) ──
  ['attendance_records', { collegeId: 1, courseId: 1, date: 1 }],
  ['attendance_records', { collegeId: 1, date: 1 }],
  ['attendance_records', { collegeId: 1, studentId: 1, date: -1 }],
  ['leave_requests', { collegeId: 1 }],
  ['announcements', { collegeId: 1 }],
  ['books', { collegeId: 1 }],
  ['book_issues', { collegeId: 1 }],
  ['hostels', { collegeId: 1 }],
  ['hostel_allocations', { collegeId: 1 }],
  ['transport_routes', { collegeId: 1 }],
  ['transport_enrollments', { collegeId: 1 }],
  ['grievances', { collegeId: 1 }],
  ['assets', { collegeId: 1 }],
  ['asset_maintenance', { collegeId: 1 }],
  ['visitors', { collegeId: 1 }],
  ['gate_passes', { collegeId: 1 }],
  ['ai_sessions', { collegeId: 1 }],
  ['ai_sessions', { userId: 1, collegeId: 1, createdAt: -1 }],
  ['ai_messages', { collegeId: 1 }],
  ['ai_messages', { sessionId: 1, collegeId: 1, createdAt: 1 }],
  ['ai_assignment_checks', { collegeId: 1 }],
  ['ai_assignment_checks', { userId: 1 }],
  ['interview_questions', { collegeId: 1 }],
  ['generated_question_papers', { collegeId: 1 }],
  ['study_plans', { collegeId: 1 }],
  ['study_plans', { userId: 1, collegeId: 1, createdAt: -1 }],
  ['classrooms', { collegeId: 1 }],
  ['schedules', { collegeId: 1 }],
  ['face_profiles', { collegeId: 1 }],
  ['localshare_sessions', { sessionId: 1 }, { unique: true }],
  ['localshare_sessions', { shareCode: 1 }, { unique: true }],
  ['localshare_sessions', { collegeId: 1, status: 1 }],
  ['localshare_sessions', { collegeId: 1, teacherId: 1 }],
  ['localshare_sessions', { expiresAt: 1 }, { expireAfterSeconds: 0 }],
  ['localshare_participants', { sessionId: 1, studentId: 1 }, { unique: true }],
  ['localshare_participants', { sessionId: 1, connectionStatus: 1 }],
  ['localshare_participants', { collegeId: 1 }],
  ['localshare_downloads', { sessionId: 1, studentId: 1 }],
  ['localshare_downloads', { completedAt: 1 }, { expireAfterSeconds: 2592000 }],
  ['localshare_downloads', { collegeId: 1 }],
  ['localshare_audit_logs', { sessionId: 1, timestamp: 1 }],
  ['localshare_audit_logs', { timestamp: 1 }, { expireAfterSeconds: 7776000 }],
  ['localshare_feedback', { sessionId: 1, studentId: 1 }, { unique: true }],
  ['localshare_feedback', { sessionId: 1 }],
  ['localshare_feedback', { collegeId: 1 }],
  // ── Exam Prep System ──
  ['exam_prep_questions', { collegeId: 1 }],
  ['exam_prep_questions', { collegeId: 1, subject: 1 }],
  ['exam_prep_questions', { collegeId: 1, topic: 1 }],
  ['exam_prep_questions', { collegeId: 1, difficulty: 1 }],
  ['exam_prep_questions', { collegeId: 1, educationLevel: 1 }],
  ['exam_prep_questions', { createdById: 1 }],
  ['exam_prep_quizzes', { collegeId: 1 }],
  ['exam_prep_quizzes', { collegeId: 1, status: 1 }],
  ['exam_prep_quizzes', { createdById: 1 }],
  ['exam_prep_attempts', { quizId: 1, studentId: 1 }],
  ['exam_prep_attempts', { collegeId: 1 }],
  ['exam_prep_attempts', { studentId: 1, status: 1 }],
  ['exam_prep_practice_sessions', { studentId: 1, status: 1 }],
  ['exam_prep_practice_sessions', { collegeId: 1 }],
  ['exam_prep_bookmarks', { studentId: 1, questionId: 1 }, { unique: true }],
  ['exam_prep_bookmarks', { collegeId: 1 }],
  ['exam_prep_mastery', { studentId: 1, topic: 1, collegeId: 1 }, { unique: true }],
  ['exam_prep_mastery', { studentId: 1 }],
];

async function createIndexes(database) {
  const BATCH_SIZE = 10;
  const baseOpts = { background: true };
  let created = 0;
  let failed = 0;

  for (let i = 0; i < INDEX_DEFS.length; i += BATCH_SIZE) {
    const batch = INDEX_DEFS.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(([col, key, opts]) =>
        database.collection(col).createIndex(key, { ...baseOpts, ...opts })
      )
    );
    for (const r of results) {
      if (r.status === 'fulfilled') created++;
      else failed++;
    }
  }

  console.log(`[MongoDB] Indexes: ${created} created, ${failed} failed (of ${INDEX_DEFS.length})`);
}

module.exports = { connectDB, getDB, closeDB, ensureConnection, ObjectId, oid };
