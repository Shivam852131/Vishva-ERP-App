const { connectDB, getDB, closeDB, oid } = require('../../src/db');

const prisma = {
  $disconnect: async () => {
    // Graceful teardown shim for legacy test callers
  },
  user: {
    findUnique: async ({ where }) => {
      const db = getDB();
      const q = {};
      if (where.email) q.email = where.email.toLowerCase();
      if (where.id) q._id = oid(where.id);
      const u = await db.collection('users').findOne(q);
      return u ? { ...u, id: String(u._id) } : null;
    },
    update: async ({ where, data }) => {
      const db = getDB();
      const q = {};
      if (where.email) q.email = where.email.toLowerCase();
      if (where.id) q._id = oid(where.id);
      await db.collection('users').updateOne(q, { $set: data });
      const u = await db.collection('users').findOne(q);
      return u ? { ...u, id: String(u._id) } : null;
    },
  },
  questionBankItem: {
    createMany: async ({ data }) => {
      const db = getDB();
      const col = await db.collection('colleges').findOne({});
      const docs = data.map(d => ({
        subject: d.subject || 'General',
        topic: d.topic || d.chapter || 'Topic 1',
        question: d.question || d.questionText || '',
        options: d.options || ['A', 'B', 'C', 'D'],
        correctAnswer: d.correctAnswer || 'A',
        difficulty: d.difficulty || 'medium',
        marks: d.marks || 1,
        type: d.type || d.questionType || 'mcq',
        collegeId: d.collegeId ? oid(d.collegeId) : (col?._id || null),
        createdAt: new Date().toISOString(),
      }));
      return db.collection('question_bank_items').insertMany(docs);
    },
  },
  fee: {
    create: async ({ data }) => {
      const db = getDB();
      const student = await db.collection('users').findOne({ _id: oid(data.studentId || data.userId) });
      const doc = {
        userId: oid(data.studentId || data.userId),
        collegeId: data.collegeId ? oid(data.collegeId) : (student?.collegeId || null),
        type: data.type || 'Tuition',
        amount: data.amount || 1000,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : new Date().toISOString(),
        status: 'pending',
        semester: data.semester || 'Sem 1',
        createdAt: new Date().toISOString(),
      };
      const r = await db.collection('fees').insertOne(doc);
      return { ...doc, id: String(r.insertedId), _id: r.insertedId };
    },
  },
};

async function resetDb() {
  await connectDB();
  const db = getDB();
  const collections = [
    'users',
    'colleges',
    'courses',
    'course_enrollments',
    'questions',
    'question_bank_items',
    'attendance',
    'attendance_sessions',
    'attendance_roll_entries',
    'attendance_records',
    'face_profiles',
    'fees',
    'notifications',
    'assignments',
    'assignment_submissions',
    'chat_messages',
    'localshare_sessions',
    'localshare_participants',
    'localshare_downloads',
    'localshare_feedback',
    'localshare_audit_logs',
  ];
  await Promise.all(
    collections.map(c => db.collection(c).deleteMany({}).catch(() => {}))
  );
}

module.exports = { prisma, resetDb, connectDB, getDB, closeDB, oid };
