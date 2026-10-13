require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');

const ATLAS_HOSTS = 'ac-xzethlm-shard-00-00.uevx1zw.mongodb.net:27017,ac-xzethlm-shard-00-01.uevx1zw.mongodb.net:27017,ac-xzethlm-shard-00-02.uevx1zw.mongodb.net:27017';
const ATLAS_USER = 'shivam32880_db_user';
const ATLAS_PASS = 'pT1L0nBwvGLaNRcV';
const DB_NAME = process.env.MONGODB_DB || 'test';
const ATLAS_URI = `mongodb://${ATLAS_USER}:${ATLAS_PASS}@${ATLAS_HOSTS}/${DB_NAME}?authSource=admin&replicaSet=atlas-gbwt42-shard-0&ssl=true&compressors=zlib`;

const SALT_ROUNDS = 10;

async function seed() {
  console.log('[Atlas Seed] Connecting...');
  const client = new MongoClient(ATLAS_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  await client.db('admin').command({ ping: 1 });
  const db = client.db(DB_NAME);
  console.log('[Atlas Seed] Connected. Seeding test data (upsert mode)...');

  const hash = await bcrypt.hash('password123', SALT_ROUNDS);
  const now = new Date();
  const daysAgo = (d) => { const dt = new Date(); dt.setDate(dt.getDate() - d); return dt; };
  const daysFromNow = (d) => { const dt = new Date(); dt.setDate(dt.getDate() + d); return dt; };

  // ──── USERS (upsert) ────
  const usersData = [
    { name: 'Aarav Sharma', email: 'aarav@campus.edu', passwordHash: hash, role: 'student', phone: '+919876543210', college: 'Vishva Institute of Technology', department: 'Computer Science', studentCode: 'VIT-001', year: 3, cgpa: 8.7, isActive: true, status: 'active' },
    { name: 'Isha Patel', email: 'isha@campus.edu', passwordHash: hash, role: 'student', phone: '+919876543211', college: 'Vishva Institute of Technology', department: 'Computer Science', studentCode: 'VIT-002', year: 2, cgpa: 9.1, isActive: true, status: 'active' },
    { name: 'Neel Gupta', email: 'neel@campus.edu', passwordHash: hash, role: 'student', phone: '+919876543212', college: 'Vishva Institute of Technology', department: 'Electronics', studentCode: 'VIT-003', year: 3, cgpa: 7.8, isActive: true, status: 'active' },
    { name: 'Dr. Meera Iyer', email: 'meera@campus.edu', passwordHash: hash, role: 'faculty', phone: '+919876543213', college: 'Vishva Institute of Technology', department: 'Computer Science', isActive: true, status: 'active' },
    { name: 'Prof. Kabir Khan', email: 'kabir@campus.edu', passwordHash: hash, role: 'faculty', phone: '+919876543214', college: 'Vishva Institute of Technology', department: 'Electronics', isActive: true, status: 'active' },
    { name: 'Rohit Sharma', email: 'rohit@campus.edu', passwordHash: hash, role: 'parent', phone: '+919876543215', college: 'Vishva Institute of Technology', isActive: true, status: 'active' },
    { name: 'Ananya Reddy', email: 'ananya@campus.edu', passwordHash: hash, role: 'college_admin', phone: '+919876543216', college: 'Vishva Institute of Technology', isActive: true, status: 'active' },
    { name: 'Vikram Singh', email: 'vikram@campus.edu', passwordHash: hash, role: 'super_admin', phone: '+919876543217', college: 'Vishva Institute of Technology', isActive: true, status: 'active' },
  ];

  const userIds = {};
  for (const u of usersData) {
    const result = await db.collection('users').updateOne(
      { email: u.email },
      { $set: { ...u, createdAt: now, updatedAt: now } },
      { upsert: true }
    );
    userIds[u.email] = result.upsertedId || (await db.collection('users').findOne({ email: u.email }))._id;
  }

  const { 'aarav@campus.edu': student1Id, 'isha@campus.edu': student2Id, 'neel@campus.edu': student3Id, 'meera@campus.edu': faculty1Id, 'kabir@campus.edu': faculty2Id, 'rohit@campus.edu': parentId, 'ananya@campus.edu': adminId } = userIds;

  // Link parent
  await db.collection('users').updateOne({ _id: student1Id }, { $set: { parentId } });

  // ──── COURSES (upsert) ────
  const coursesData = [
    { code: 'CS301', name: 'Data Structures & Algorithms', department: 'Computer Science', credits: 4, facultyId: String(faculty1Id), semester: 5, college: 'Vishva Institute of Technology' },
    { code: 'CS305', name: 'Database Management Systems', department: 'Computer Science', credits: 4, facultyId: String(faculty1Id), semester: 5, college: 'Vishva Institute of Technology' },
    { code: 'AI401', name: 'Machine Learning', department: 'Computer Science', credits: 3, facultyId: String(faculty1Id), semester: 7, college: 'Vishva Institute of Technology' },
    { code: 'EC220', name: 'Digital Electronics', department: 'Electronics', credits: 3, facultyId: String(faculty2Id), semester: 3, college: 'Vishva Institute of Technology' },
  ];

  const courseIds = {};
  for (const c of coursesData) {
    const result = await db.collection('courses').updateOne(
      { code: c.code },
      { $set: { ...c, isActive: true, createdAt: now, updatedAt: now } },
      { upsert: true }
    );
    courseIds[c.code] = result.upsertedId || (await db.collection('courses').findOne({ code: c.code }))._id;
  }

  // ──── ENROLLMENTS (upsert) ────
  const enrollments = [
    { studentId: String(student1Id), courseId: String(courseIds['CS301']) },
    { studentId: String(student1Id), courseId: String(courseIds['CS305']) },
    { studentId: String(student2Id), courseId: String(courseIds['CS301']) },
    { studentId: String(student2Id), courseId: String(courseIds['CS305']) },
    { studentId: String(student2Id), courseId: String(courseIds['AI401']) },
    { studentId: String(student3Id), courseId: String(courseIds['EC220']) },
    { studentId: String(student3Id), courseId: String(courseIds['CS301']) },
    { studentId: String(student1Id), courseId: String(courseIds['AI401']) },
  ];

  for (const e of enrollments) {
    await db.collection('course_enrollments').updateOne(
      { studentId: e.studentId, courseId: e.courseId },
      { $setOnInsert: { ...e, createdAt: now } },
      { upsert: true }
    );
  }

  // ──── ATTENDANCE RECORDS ────
  const existingAtt = await db.collection('attendance_records').countDocuments({ studentId: String(student1Id) });
  if (existingAtt === 0) {
    const attRecords = [];
    for (let i = 0; i < 24; i++) {
      const dt = daysAgo(30 - i);
      attRecords.push({ studentId: String(student1Id), courseId: String(courseIds['CS301']), date: dt.toISOString().slice(0, 10), status: i < 4 ? 'absent' : 'present', createdAt: now });
    }
    await db.collection('attendance_records').insertMany(attRecords);
  }

  // ──── FEES (upsert) ────
  await db.collection('fees').updateOne(
    { userId: String(student1Id), type: 'Tuition Fee', semester: 5 },
    { $setOnInsert: { userId: String(student1Id), type: 'Tuition Fee', amount: 45000, dueDate: daysFromNow(15).toISOString().slice(0, 10), status: 'pending', semester: 5, createdAt: now } },
    { upsert: true }
  );
  await db.collection('fees').updateOne(
    { userId: String(student1Id), type: 'Hostel Fee', semester: 5 },
    { $setOnInsert: { userId: String(student1Id), type: 'Hostel Fee', amount: 25000, dueDate: daysFromNow(15).toISOString().slice(0, 10), status: 'paid', semester: 5, createdAt: now } },
    { upsert: true }
  );

  // ──── NOTIFICATIONS (insert only if empty) ────
  const notifCount = await db.collection('notifications').countDocuments();
  if (notifCount === 0) {
    await db.collection('notifications').insertMany([
      { audience: 'students', title: 'Exam Schedule Released', body: 'Mid-term exam schedule has been published.', recipientIds: [], readBy: [], createdAt: now },
      { audience: 'all', title: 'Holiday Notice', body: 'College will remain closed on Monday for Republic Day.', recipientIds: [], readBy: [], createdAt: now },
    ]);
  }

  // ──── BOOKS (upsert) ────
  await db.collection('books').updateOne(
    { isbn: '978-0262033848' },
    { $setOnInsert: { title: 'Introduction to Algorithms (CLRS)', author: 'Thomas H. Cormen', isbn: '978-0262033848', department: 'Computer Science', available: 3, total: 5, createdAt: now } },
    { upsert: true }
  );
  await db.collection('books').updateOne(
    { isbn: '978-0078022159' },
    { $setOnInsert: { title: 'Database System Concepts', author: 'Abraham Silberschatz', isbn: '978-0078022159', department: 'Computer Science', available: 2, total: 4, createdAt: now } },
    { upsert: true }
  );

  // ──── BOOK ISSUES (upsert) ────
  const book1 = await db.collection('books').findOne({ isbn: '978-0262033848' });
  const book2 = await db.collection('books').findOne({ isbn: '978-0078022159' });
  if (book1) {
    await db.collection('book_issues').updateOne(
      { bookId: String(book1._id), userId: String(student1Id) },
      { $setOnInsert: { bookId: String(book1._id), userId: String(student1Id), issueDate: daysAgo(20).toISOString().slice(0, 10), dueDate: daysAgo(6).toISOString().slice(0, 10), returnDate: null, fine: 0, status: 'overdue', createdAt: now } },
      { upsert: true }
    );
  }
  if (book2) {
    await db.collection('book_issues').updateOne(
      { bookId: String(book2._id), userId: String(student2Id) },
      { $setOnInsert: { bookId: String(book2._id), userId: String(student2Id), issueDate: daysAgo(10).toISOString().slice(0, 10), dueDate: daysFromNow(4).toISOString().slice(0, 10), returnDate: null, fine: 0, status: 'issued', createdAt: now } },
      { upsert: true }
    );
  }

  // ──── ASSIGNMENTS (upsert) ────
  await db.collection('assignments').updateOne(
    { title: 'Implement Red-Black Tree' },
    { $setOnInsert: { courseId: String(courseIds['CS301']), title: 'Implement Red-Black Tree', description: 'Implement insert, delete, and search operations.', dueDate: daysFromNow(7).toISOString().slice(0, 10), maxMarks: 100, createdById: String(faculty1Id), createdAt: now } },
    { upsert: true }
  );
  await db.collection('assignments').updateOne(
    { title: 'ER Diagram Project' },
    { $setOnInsert: { courseId: String(courseIds['CS305']), title: 'ER Diagram Project', description: 'Design an ER diagram for a hospital management system.', dueDate: daysFromNow(14).toISOString().slice(0, 10), maxMarks: 50, createdById: String(faculty1Id), createdAt: now } },
    { upsert: true }
  );

  // ──── HOSTELS (upsert) ────
  await db.collection('hostels').updateOne(
    { name: 'Gandhi Hall' },
    { $setOnInsert: { name: 'Gandhi Hall', type: 'boys', capacity: 200, occupied: 145, facilities: ['WiFi', 'Mess', 'Gym', 'Laundry'], warden: 'Mr. Verma', phone: '+919876500001', createdAt: now } },
    { upsert: true }
  );
  await db.collection('hostels').updateOne(
    { name: 'Sarojini Hall' },
    { $setOnInsert: { name: 'Sarojini Hall', type: 'girls', capacity: 150, occupied: 120, facilities: ['WiFi', 'Mess', 'Gym', 'Library'], warden: 'Mrs. Nair', phone: '+919876500002', createdAt: now } },
    { upsert: true }
  );

  // ──── TRANSPORT (upsert) ────
  await db.collection('transport_routes').updateOne(
    { route_name: 'Koramangala Express' },
    { $setOnInsert: { route_name: 'Koramangala Express', vehicle_number: 'KA-01-AB-1234', driver_name: 'Rajesh Kumar', driver_phone: '+91 98765 43210', stops: [{ name: 'Koramangala', time: '07:30' }, { name: 'HSR Layout', time: '07:50' }, { name: 'College', time: '08:30' }], active: true, createdAt: now } },
    { upsert: true }
  );
  await db.collection('transport_routes').updateOne(
    { route_name: 'Whitefield Shuttle' },
    { $setOnInsert: { route_name: 'Whitefield Shuttle', vehicle_number: 'KA-02-CD-5678', driver_name: 'Mohammed Irfan', driver_phone: '+91 98765 43211', stops: [{ name: 'Whitefield', time: '07:00' }, { name: 'Marathahalli', time: '07:30' }, { name: 'College', time: '08:30' }], active: true, createdAt: now } },
    { upsert: true }
  );

  // ──── GRIEVANCES (insert only if empty for student1) ────
  const grievCount = await db.collection('grievances').countDocuments({ userId: String(student1Id) });
  if (grievCount === 0) {
    await db.collection('grievances').insertOne({ userId: String(student1Id), category: 'Academic', subject: 'Late Assignment Submission', description: 'Need extension for DS assignment.', status: 'open', priority: 'medium', responses: [], createdAt: now });
  }

  // ──── AI SESSIONS ────
  const aiExists = await db.collection('ai_sessions').countDocuments({ userId: String(student1Id) });
  if (aiExists === 0) {
    const aiResult = await db.collection('ai_sessions').insertOne({ userId: String(student1Id), type: 'doubt_solver', title: 'Binary Tree Doubt', createdAt: now });
    await db.collection('ai_messages').insertMany([
      { sessionId: String(aiResult.insertedId), role: 'user', content: 'What is the difference between a binary tree and a BST?', createdAt: now },
      { sessionId: String(aiResult.insertedId), role: 'assistant', content: 'A binary tree is a tree data structure where each node has at most two children. A BST is a special type where left < parent < right.', createdAt: now },
    ]);
  }

  // ──── CHAT MESSAGES ────
  const chatCount = await db.collection('chat_messages').countDocuments({ senderId: String(faculty1Id) });
  if (chatCount === 0) {
    await db.collection('chat_messages').insertMany([
      { senderId: String(faculty1Id), receiverId: String(student1Id), content: 'Hello Aarav, please submit your assignment by Friday.', read: true, createdAt: daysAgo(1) },
      { senderId: String(student1Id), receiverId: String(faculty1Id), content: 'Sure Dr. Meera, I will submit it by Thursday.', read: true, createdAt: daysAgo(1) },
    ]);
  }

  console.log('[Atlas Seed] Done!');
  console.log(`  Users: ${Object.keys(userIds).length} upserted`);
  console.log(`  Courses: ${Object.keys(courseIds).length} upserted`);
  await client.close();
  process.exit(0);
}

seed().catch(err => {
  console.error('[Atlas Seed] Failed:', err);
  process.exit(1);
});
