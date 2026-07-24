require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');

const MONGODB_URI = process.env.MONGODB_LOCAL_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGODB_DB || 'vishva_erp';
const SALT_ROUNDS = 10;

async function seed() {
  console.log('[Seed] Connecting to MongoDB...');
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  // Clear all collections
  const collections = await db.listCollections().toArray();
  for (const c of collections) {
    await db.dropCollection(c.name);
  }
  console.log('[Seed] Cleared existing data.');

  const hash = await bcrypt.hash('password123', SALT_ROUNDS);
  const now = new Date();
  const daysAgo = (d) => { const dt = new Date(); dt.setDate(dt.getDate() - d); return dt; };
  const daysFromNow = (d) => { const dt = new Date(); dt.setDate(dt.getDate() + d); return dt; };

  // ──── USERS ────
  const users = [
    { name: 'Aarav Sharma', email: 'aarav@campus.edu', passwordHash: hash, role: 'student', phone: '+919876543210', college: 'Vishva Institute of Technology', department: 'Computer Science', studentCode: 'VIT-001', year: 3, cgpa: 8.7, status: 'active' },
    { name: 'Isha Patel', email: 'isha@campus.edu', passwordHash: hash, role: 'student', phone: '+919876543211', college: 'Vishva Institute of Technology', department: 'Computer Science', studentCode: 'VIT-002', year: 2, cgpa: 9.1, status: 'active' },
    { name: 'Neel Gupta', email: 'neel@campus.edu', passwordHash: hash, role: 'student', phone: '+919876543212', college: 'Vishva Institute of Technology', department: 'Electronics', studentCode: 'VIT-003', year: 3, cgpa: 7.8, status: 'active' },
    { name: 'Dr. Meera Iyer', email: 'meera@campus.edu', passwordHash: hash, role: 'faculty', phone: '+919876543213', college: 'Vishva Institute of Technology', department: 'Computer Science', status: 'active' },
    { name: 'Prof. Kabir Khan', email: 'kabir@campus.edu', passwordHash: hash, role: 'faculty', phone: '+919876543214', college: 'Vishva Institute of Technology', department: 'Electronics', status: 'active' },
    { name: 'Rohit Sharma', email: 'rohit@campus.edu', passwordHash: hash, role: 'parent', phone: '+919876543215', college: 'Vishva Institute of Technology', status: 'active' },
    { name: 'Ananya Reddy', email: 'ananya@campus.edu', passwordHash: hash, role: 'college_admin', phone: '+919876543216', college: 'Vishva Institute of Technology', status: 'active' },
    { name: 'Vikram Singh', email: 'vikram@campus.edu', passwordHash: hash, role: 'super_admin', phone: '+919876543217', college: 'Vishva Institute of Technology', status: 'active' },
  ];

  const userResult = await db.collection('users').insertMany(users.map(u => ({ ...u, createdAt: now, updatedAt: now })));
  const userIds = Object.values(userResult.insertedIds);
  const [student1Id, student2Id, student3Id, faculty1Id, faculty2Id, parentId, adminId, superAdminId] = userIds;

  // Link parent to student
  await db.collection('users').updateOne({ _id: student1Id }, { $set: { parentId: parentId } });

  // ──── COLLEGES ────
  const collegesResult = await db.collection('colleges').insertMany([
    { name: 'Vishva Institute of Technology', code: 'VIT', address: '123 College Road, Bangalore', phone: '+918012345678', email: 'info@vit.edu', createdAt: now },
    { name: 'Vishva College of Arts & Science', code: 'VCAS', address: '456 University Road, Mumbai', phone: '+912212345678', email: 'info@vcas.edu', createdAt: now },
  ]);
  const [college1Id] = Object.values(collegesResult.insertedIds);

  // ──── COURSES ────
  const coursesResult = await db.collection('courses').insertMany([
    { code: 'CS301', name: 'Data Structures & Algorithms', department: 'Computer Science', credits: 4, facultyId: faculty1Id, semester: 5, college: 'Vishva Institute of Technology', createdAt: now },
    { code: 'CS305', name: 'Database Management Systems', department: 'Computer Science', credits: 4, facultyId: faculty1Id, semester: 5, college: 'Vishva Institute of Technology', createdAt: now },
    { code: 'AI401', name: 'Machine Learning', department: 'Computer Science', credits: 3, facultyId: faculty1Id, semester: 7, college: 'Vishva Institute of Technology', createdAt: now },
    { code: 'EC220', name: 'Digital Electronics', department: 'Electronics', credits: 3, facultyId: faculty2Id, semester: 3, college: 'Vishva Institute of Technology', createdAt: now },
  ]);
  const [course1Id, course2Id, course3Id, course4Id] = Object.values(coursesResult.insertedIds);

  // ──── ENROLLMENTS ────
  await db.collection('course_enrollments').insertMany([
    { studentId: student1Id, courseId: course1Id, createdAt: now },
    { studentId: student1Id, courseId: course2Id, createdAt: now },
    { studentId: student2Id, courseId: course1Id, createdAt: now },
    { studentId: student2Id, courseId: course2Id, createdAt: now },
    { studentId: student2Id, courseId: course3Id, createdAt: now },
    { studentId: student3Id, courseId: course4Id, createdAt: now },
    { studentId: student3Id, courseId: course1Id, createdAt: now },
    { studentId: student1Id, courseId: course3Id, createdAt: now },
  ]);

  // ──── CLASSROOMS ────
  const classroomsResult = await db.collection('classrooms').insertMany([
    { name: 'CS-301', building: 'Block A', capacity: 60, beacons: ['B1:A0:01'], wifiBssids: ['AA:BB:CC:DD:EE:01'], latitude: 12.9716, longitude: 77.5946, createdAt: now },
    { name: 'EC-201', building: 'Block B', capacity: 45, beacons: ['B2:A0:01'], wifiBssids: ['AA:BB:CC:DD:EE:02'], latitude: 12.9720, longitude: 77.5950, createdAt: now },
  ]);
  const [classroom1Id, classroom2Id] = Object.values(classroomsResult.insertedIds);

  // ──── TIMETABLE SLOTS ────
  await db.collection('timetable_slots').insertMany([
    { courseId: course1Id, dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:30', room: 'CS-301', facultyId: faculty1Id, createdAt: now },
    { courseId: course1Id, dayOfWeek: 'Wednesday', startTime: '09:00', endTime: '10:30', room: 'CS-301', facultyId: faculty1Id, createdAt: now },
    { courseId: course2Id, dayOfWeek: 'Tuesday', startTime: '11:00', endTime: '12:30', room: 'CS-301', facultyId: faculty1Id, createdAt: now },
    { courseId: course2Id, dayOfWeek: 'Thursday', startTime: '11:00', endTime: '12:30', room: 'CS-301', facultyId: faculty1Id, createdAt: now },
    { courseId: course3Id, dayOfWeek: 'Friday', startTime: '14:00', endTime: '15:30', room: 'CS-301', facultyId: faculty1Id, createdAt: now },
    { courseId: course4Id, dayOfWeek: 'Monday', startTime: '14:00', endTime: '15:30', room: 'EC-201', facultyId: faculty2Id, createdAt: now },
  ]);

  // ──── SCHEDULES ────
  await db.collection('schedules').insertMany([
    { courseId: course1Id, classroomId: classroom1Id, dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:30', semester: 5, createdAt: now },
    { courseId: course2Id, classroomId: classroom1Id, dayOfWeek: 'Tuesday', startTime: '11:00', endTime: '12:30', semester: 5, createdAt: now },
  ]);

  // ──── ATTENDANCE RECORDS ────
  const attRecords = [];
  for (let i = 0; i < 24; i++) {
    const dt = daysAgo(30 - i);
    attRecords.push({ studentId: student1Id, courseId: course1Id, date: dt.toISOString().slice(0, 10), status: i < 4 ? 'absent' : 'present', createdAt: now });
  }
  await db.collection('attendance_records').insertMany(attRecords);

  // ──── EXAMS ────
  const examsResult = await db.collection('exams').insertMany([
    { courseId: course1Id, title: 'Mid-Term Exam', date: daysFromNow(30).toISOString().slice(0, 10), duration: 120, totalMarks: 100, type: 'midterm', createdAt: now },
    { courseId: course2Id, title: 'Quiz 1', date: daysFromNow(14).toISOString().slice(0, 10), duration: 30, totalMarks: 20, type: 'quiz', createdAt: now },
  ]);
  const [exam1Id, exam2Id] = Object.values(examsResult.insertedIds);

  // ──── EXAM RESULTS ────
  await db.collection('exam_results').insertMany([
    { studentId: student1Id, examId: exam1Id, courseId: course1Id, marks: 82, grade: 'A', semester: 5, createdAt: now },
    { studentId: student1Id, examId: exam2Id, courseId: course2Id, marks: 18, grade: 'A+', semester: 5, createdAt: now },
    { studentId: student2Id, examId: exam1Id, courseId: course1Id, marks: 91, grade: 'A+', semester: 5, createdAt: now },
    { studentId: student3Id, examId: exam1Id, courseId: course1Id, marks: 65, grade: 'B+', semester: 5, createdAt: now },
  ]);

  // ──── FEES ────
  const feesResult = await db.collection('fees').insertMany([
    { userId: student1Id, type: 'Tuition Fee', amount: 45000, dueDate: daysFromNow(15).toISOString().slice(0, 10), status: 'pending', semester: 5, createdAt: now },
    { userId: student1Id, type: 'Hostel Fee', amount: 25000, dueDate: daysFromNow(15).toISOString().slice(0, 10), status: 'paid', semester: 5, receiptId: null, createdAt: now },
    { userId: student2Id, type: 'Tuition Fee', amount: 45000, dueDate: daysAgo(5).toISOString().slice(0, 10), status: 'overdue', semester: 3, createdAt: now },
    { userId: student3Id, type: 'Tuition Fee', amount: 42000, dueDate: daysFromNow(20).toISOString().slice(0, 10), status: 'pending', semester: 3, createdAt: now },
  ]);

  // ──── NOTIFICATIONS ────
  await db.collection('notifications').insertMany([
    { audience: 'students', title: 'Exam Schedule Released', body: 'Mid-term exam schedule has been published.', recipientIds: [], readBy: [], createdAt: now },
    { audience: 'all', title: 'Holiday Notice', body: 'College will remain closed on Monday for Republic Day.', recipientIds: [], readBy: [], createdAt: now },
    { audience: 'parents', title: 'PTM Scheduled', body: 'Parent-Teacher meeting on Feb 5 at 10 AM.', recipientIds: [], readBy: [], createdAt: now },
  ]);

  // ──── ASSIGNMENTS ────
  const assignmentsResult = await db.collection('assignments').insertMany([
    { courseId: course1Id, title: 'Implement Red-Black Tree', description: 'Implement insert, delete, and search operations for a Red-Black Tree in your preferred language.', dueDate: daysFromNow(7).toISOString().slice(0, 10), maxMarks: 100, createdById: faculty1Id, createdAt: now },
    { courseId: course2Id, title: 'ER Diagram Project', description: 'Design an ER diagram for a hospital management system.', dueDate: daysFromNow(14).toISOString().slice(0, 10), maxMarks: 50, createdById: faculty1Id, createdAt: now },
    { courseId: course1Id, title: 'Graph Algorithms Lab', description: 'Implement BFS and DFS with shortest path on a sample graph.', dueDate: daysAgo(3).toISOString().slice(0, 10), maxMarks: 50, createdById: faculty1Id, createdAt: now },
  ]);

  // ──── SUBMISSIONS ────
  await db.collection('submissions').insertMany([
    { assignmentId: Object.values(assignmentsResult.insertedIds)[2], studentId: student1Id, content: 'Completed BFS and DFS implementation with shortest path.', submittedAt: daysAgo(4).toISOString(), marks: 45, feedback: 'Good work, but optimize the space complexity.', createdAt: now },
  ]);

  // ──── NOTES ────
  await db.collection('notes').insertMany([
    { courseId: course1Id, title: 'Binary Trees Lecture Notes', content: 'Comprehensive notes on binary tree traversals, BST operations, and balanced trees.', createdById: faculty1Id, createdAt: now },
    { courseId: course2Id, title: 'Normalization Guide', content: 'Step-by-step guide to 1NF, 2NF, 3NF, and BCNF with examples.', createdById: faculty1Id, createdAt: now },
  ]);

  // ──── EVENTS ────
  await db.collection('events').insertMany([
    { title: 'Tech Fest 2026', description: 'Annual technical festival with workshops, hackathons, and guest lectures.', date: daysFromNow(45).toISOString().slice(0, 10), type: 'festival', audience: 'all', createdAt: now },
    { title: 'Placement Drive', description: 'Campus placement drive by leading tech companies.', date: daysFromNow(30).toISOString().slice(0, 10), type: 'placement', audience: 'students', createdAt: now },
  ]);

  // ──── BOOKS ────
  const booksResult = await db.collection('books').insertMany([
    { title: 'Introduction to Algorithms (CLRS)', author: 'Thomas H. Cormen', isbn: '978-0262033848', department: 'Computer Science', available: 3, total: 5, createdAt: now },
    { title: 'Database System Concepts', author: 'Abraham Silberschatz', isbn: '978-0078022159', department: 'Computer Science', available: 2, total: 4, createdAt: now },
    { title: 'Digital Design', author: 'M. Morris Mano', isbn: '978-0132774208', department: 'Electronics', available: 4, total: 4, createdAt: now },
  ]);
  const [book1Id, book2Id] = Object.values(booksResult.insertedIds);

  // ──── BOOK ISSUES ────
  await db.collection('book_issues').insertMany([
    { bookId: book1Id, userId: student1Id, issueDate: daysAgo(20).toISOString().slice(0, 10), dueDate: daysAgo(6).toISOString().slice(0, 10), returnDate: null, fine: 0, status: 'overdue', createdAt: now },
    { bookId: book2Id, userId: student2Id, issueDate: daysAgo(10).toISOString().slice(0, 10), dueDate: daysFromNow(4).toISOString().slice(0, 10), returnDate: null, fine: 0, status: 'issued', createdAt: now },
  ]);

  // ──── HOSTELS ────
  const hostelsResult = await db.collection('hostels').insertMany([
    { name: 'Gandhi Hall', type: 'boys', capacity: 200, occupied: 145, facilities: ['WiFi', 'Mess', 'Gym', 'Laundry'], warden: 'Mr. Verma', phone: '+919876500001', createdAt: now },
    { name: 'Sarojini Hall', type: 'girls', capacity: 150, occupied: 120, facilities: ['WiFi', 'Mess', 'Gym', 'Library'], warden: 'Mrs. Nair', phone: '+919876500002', createdAt: now },
  ]);
  const [hostel1Id] = Object.values(hostelsResult.insertedIds);

  await db.collection('hostel_allocations').insertMany([
    { hostelId: hostel1Id, studentId: student1Id, room: 'A-201', bed: '1', startDate: daysAgo(180).toISOString().slice(0, 10), status: 'active', createdAt: now },
  ]);

  // ──── TRANSPORT ────
  const routesResult = await db.collection('transport_routes').insertMany([
    { name: 'Route A - Koramangala', routeNumber: 'A1', stops: [{ name: 'Koramangala', time: '07:30', location: { lat: 12.9352, lng: 77.6245 } }, { name: 'HSR Layout', time: '07:50', location: { lat: 12.9116, lng: 77.6389 } }, { name: 'College', time: '08:30', location: { lat: 12.9716, lng: 77.5946 } }], fare: 1500, timing: '07:30 - 16:30', createdAt: now },
    { name: 'Route B - Whitefield', routeNumber: 'B1', stops: [{ name: 'Whitefield', time: '07:00', location: { lat: 12.9698, lng: 77.7500 } }, { name: 'Marathahalli', time: '07:30', location: { lat: 12.9592, lng: 77.6974 } }, { name: 'College', time: '08:30', location: { lat: 12.9716, lng: 77.5946 } }], fare: 2000, timing: '07:00 - 16:30', createdAt: now },
  ]);
  const [route1Id] = Object.values(routesResult.insertedIds);

  await db.collection('transport_enrollments').insertMany([
    { routeId: route1Id, studentId: student1Id, startDate: daysAgo(180).toISOString().slice(0, 10), status: 'active', createdAt: now },
  ]);

  // ──── GRIEVANCES ────
  await db.collection('grievances').insertMany([
    { userId: student1Id, category: 'Academic', subject: 'Late Assignment Submission', description: 'Need extension for DS assignment due to medical reasons.', status: 'open', priority: 'medium', responses: [], createdAt: now },
    { userId: student2Id, category: 'Facility', subject: 'WiFi Not Working', description: 'WiFi in Block A has been down for 2 days.', status: 'in_progress', priority: 'high', responses: [{ text: 'IT team has been notified.', by: 'admin', date: now.toISOString() }], createdAt: now },
  ]);

  // ──── ANNOUNCEMENTS ────
  await db.collection('announcements').insertMany([
    { title: 'Mid-Term Exam Schedule', body: 'Mid-term exams will begin from March 15. Check your department notice board for detailed schedule.', audience: 'students', createdById: faculty1Id, createdAt: now },
    { title: 'Annual Day Celebration', body: 'Annual day celebration on February 20. All students and faculty are invited.', audience: 'all', createdById: adminId, createdAt: now },
  ]);

  // ──── SUBSCRIPTION ────
  await db.collection('subscriptions').insertMany([
    { userId: adminId, plan: 'pro', status: 'active', startDate: daysAgo(30).toISOString().slice(0, 10), endDate: daysFromNow(335).toISOString().slice(0, 10), amount: 2999, createdAt: now },
  ]);

  // ──── QUESTION BANK ────
  await db.collection('question_bank_items').insertMany([
    { subject: 'Data Structures', topic: 'Binary Trees', question: 'What is the time complexity of searching in a balanced BST?', options: ['O(n)', 'O(log n)', 'O(1)', 'O(n log n)'], correctAnswer: 1, difficulty: 'easy', marks: 1, type: 'mcq', createdAt: now },
    { subject: 'Data Structures', topic: 'Graphs', question: 'Implement Dijkstra\'s algorithm for shortest path.', options: [], correctAnswer: -1, difficulty: 'hard', marks: 10, type: 'coding', createdAt: now },
    { subject: 'DBMS', topic: 'Normalization', question: 'Explain the difference between 2NF and 3NF with examples.', options: [], correctAnswer: -1, difficulty: 'medium', marks: 5, type: 'subjective', createdAt: now },
  ]);

  // ──── ATTENDANCE SESSIONS ────
  const sessionsResult = await db.collection('attendance_sessions').insertMany([
    { courseId: course1Id, facultyId: faculty1Id, date: daysAgo(2).toISOString().slice(0, 10), type: 'qr', qrCode: 'QR-DS-2026-001', startTime: '09:00', endTime: '10:30', isActive: false, location: { lat: 12.9716, lng: 77.5946 }, radius: 50, createdAt: now },
    { courseId: course1Id, facultyId: faculty1Id, date: now.toISOString().slice(0, 10), type: 'qr', qrCode: 'QR-DS-2026-002', startTime: '09:00', endTime: '10:30', isActive: true, location: { lat: 12.9716, lng: 77.5946 }, radius: 50, createdAt: now },
  ]);

  // ──── AI SESSIONS ────
  const aiSessionResult = await db.collection('ai_sessions').insertMany([
    { userId: student1Id, type: 'doubt_solver', title: 'Binary Tree Doubt', createdAt: now },
  ]);
  const [aiSessionId] = Object.values(aiSessionResult.insertedIds);

  await db.collection('ai_messages').insertMany([
    { sessionId: aiSessionId, role: 'user', content: 'What is the difference between a binary tree and a BST?', createdAt: now },
    { sessionId: aiSessionId, role: 'assistant', content: 'A binary tree is a tree data structure where each node has at most two children. A Binary Search Tree (BST) is a special type of binary tree where the left child contains only nodes with values less than the parent node, and the right child contains only nodes with values greater than the parent node.', createdAt: now },
  ]);

  // ──── STUDY PLANS ────
  await db.collection('study_plans').insertMany([
    { userId: student1Id, title: 'DBMS Revision Plan', startDate: now.toISOString().slice(0, 10), endDate: daysFromNow(7).toISOString().slice(0, 10), tasks: [
      { subject: 'DBMS', topic: 'ER Diagrams', date: now.toISOString().slice(0, 10), duration: 60, completed: true },
      { subject: 'DBMS', topic: 'Normalization', date: daysFromNow(1).toISOString().slice(0, 10), duration: 90, completed: false },
      { subject: 'DBMS', topic: 'SQL Joins', date: daysFromNow(2).toISOString().slice(0, 10), duration: 60, completed: false },
      { subject: 'DBMS', topic: 'Transactions', date: daysFromNow(3).toISOString().slice(0, 10), duration: 90, completed: false },
    ], createdAt: now },
  ]);

  // ──── CHAT MESSAGES ────
  await db.collection('chat_messages').insertMany([
    { senderId: faculty1Id, receiverId: student1Id, content: 'Hello Aarav, please submit your assignment by Friday.', read: true, createdAt: daysAgo(1) },
    { senderId: student1Id, receiverId: faculty1Id, content: 'Sure Dr. Meera, I will submit it by Thursday.', read: true, createdAt: daysAgo(1) },
  ]);

  // ──── REMINDERS ────
  await db.collection('reminders').insertMany([
    { userId: student1Id, title: 'Assignment Due', body: 'Red-Black Tree assignment is due in 7 days.', date: daysFromNow(7).toISOString().slice(0, 10), createdAt: now },
    { userId: student1Id, title: 'Fee Payment', body: 'Tuition fee of ₹45,000 due in 15 days.', date: daysFromNow(15).toISOString().slice(0, 10), createdAt: now },
  ]);

  console.log('[Seed] Seeded successfully!');
  console.log(`  Users: ${userResult.insertedCount}`);
  console.log(`  Courses: ${coursesResult.insertedCount}`);
  console.log(`  Attendance Records: ${attRecords.length}`);
  console.log(`  Fees: ${feesResult.insertedCount}`);
  console.log(`  Books: ${booksResult.insertedCount}`);

  await client.close();
  process.exit(0);
}

seed().catch(err => {
  console.error('[Seed] Failed:', err);
  process.exit(1);
});
