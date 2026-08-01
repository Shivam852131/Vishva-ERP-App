require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');

const MONGODB_URI = process.env.MONGODB_LOCAL_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGODB_DB || 'vishva_erp';
const SALT_ROUNDS = 10;

async function seed() {
  console.log('[Seed-All] Connecting to MongoDB...');
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  const collections = await db.listCollections().toArray();
  for (const c of collections) {
    await db.dropCollection(c.name);
  }
  console.log('[Seed-All] Cleared existing data.');

  const hash = await bcrypt.hash('password123', SALT_ROUNDS);
  const now = new Date();
  const daysAgo = (d) => { const dt = new Date(); dt.setDate(dt.getDate() - d); return dt; };
  const daysFromNow = (d) => { const dt = new Date(); dt.setDate(dt.getDate() + d); return dt; };
  const iso = (d) => d.toISOString();
  const dateStr = (d) => d.toISOString().slice(0, 10);

  // ══════════════════════════════════════════════
  // 1. USERS
  // ══════════════════════════════════════════════
  const usersData = [
    { name: 'Aarav Sharma', email: 'aarav@campus.edu', role: 'student', phone: '+919876543210', department: 'Computer Science', studentCode: 'VIT-001', year: 3, cgpa: 8.7 },
    { name: 'Isha Patel', email: 'isha@campus.edu', role: 'student', phone: '+919876543211', department: 'Computer Science', studentCode: 'VIT-002', year: 2, cgpa: 9.1 },
    { name: 'Neel Gupta', email: 'neel@campus.edu', role: 'student', phone: '+919876543212', department: 'Electronics', studentCode: 'VIT-003', year: 3, cgpa: 7.8 },
    { name: 'Priya Nair', email: 'priya@campus.edu', role: 'student', phone: '+919876543218', department: 'Computer Science', studentCode: 'VIT-004', year: 4, cgpa: 9.3 },
    { name: 'Ravi Kumar', email: 'ravi@campus.edu', role: 'student', phone: '+919876543219', department: 'Mechanical', studentCode: 'VIT-005', year: 1, cgpa: 7.2 },
    { name: 'Sneha Reddy', email: 'sneha@campus.edu', role: 'student', phone: '+919876543220', department: 'Computer Science', studentCode: 'VIT-006', year: 2, cgpa: 8.5 },
    { name: 'Arjun Mehta', email: 'arjun@campus.edu', role: 'student', phone: '+919876543221', department: 'Electronics', studentCode: 'VIT-007', year: 3, cgpa: 7.9 },
    { name: 'Kavya Singh', email: 'kavya@campus.edu', role: 'student', phone: '+919876543222', department: 'Computer Science', studentCode: 'VIT-008', year: 4, cgpa: 9.0 },
    { name: 'Rohan Das', email: 'rohan@campus.edu', role: 'student', phone: '+919876543223', department: 'Mechanical', studentCode: 'VIT-009', year: 2, cgpa: 6.8 },
    { name: 'Nisha Joshi', email: 'nisha@campus.edu', role: 'student', phone: '+919876543224', department: 'Computer Science', studentCode: 'VIT-010', year: 1, cgpa: 8.9 },
    { name: 'Dr. Meera Iyer', email: 'meera@campus.edu', role: 'faculty', phone: '+919876543213', department: 'Computer Science' },
    { name: 'Prof. Kabir Khan', email: 'kabir@campus.edu', role: 'faculty', phone: '+919876543214', department: 'Electronics' },
    { name: 'Dr. Sunita Menon', email: 'sunita@campus.edu', role: 'faculty', phone: '+919876543225', department: 'Computer Science' },
    { name: 'Prof. Amit Verma', email: 'amit@campus.edu', role: 'faculty', phone: '+919876543226', department: 'Mechanical' },
    { name: 'Rohit Sharma', email: 'rohit@campus.edu', role: 'parent', phone: '+919876543215' },
    { name: 'Suman Patel', email: 'suman@campus.edu', role: 'parent', phone: '+919876543227' },
    { name: 'Ananya Reddy', email: 'ananya@campus.edu', role: 'college_admin', phone: '+919876543216' },
    { name: 'Vikram Singh', email: 'vikram@campus.edu', role: 'super_admin', phone: '+919876543217' },
  ];

  const userResult = await db.collection('users').insertMany(usersData.map(u => ({
    ...u, passwordHash: hash, college: 'Vishva Institute of Technology',
    isActive: true, status: 'active', createdAt: now, updatedAt: now,
    ...(u.role === 'student' ? { parentId: null } : {}),
  })));
  const uid = Object.values(userResult.insertedIds);
  const S = (i) => uid[i], F = (i) => uid[10 + i], P = (i) => uid[14 + i], A = (i) => uid[16 + i];

  await db.collection('users').updateOne({ _id: S(0) }, { $set: { parentId: P(0) } });
  await db.collection('users').updateOne({ _id: S(4) }, { $set: { parentId: P(1) } });
  console.log(`  Users: ${userResult.insertedCount}`);

  // ══════════════════════════════════════════════
  // 2. COLLEGES
  // ══════════════════════════════════════════════
  await db.collection('colleges').insertMany([
    { name: 'Vishva Institute of Technology', code: 'VIT', address: '123 College Road, Bangalore', phone: '+918012345678', email: 'info@vit.edu', logo: '', createdAt: now },
    { name: 'Vishva College of Arts & Science', code: 'VCAS', address: '456 University Road, Mumbai', phone: '+912212345678', email: 'info@vcas.edu', logo: '', createdAt: now },
    { name: 'Vishva School of Engineering', code: 'VSE', address: '789 Tech Park, Hyderabad', phone: '+914012345678', email: 'info@vse.edu', logo: '', createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 3. COURSES
  // ══════════════════════════════════════════════
  const coursesResult = await db.collection('courses').insertMany([
    { code: 'CS301', name: 'Data Structures & Algorithms', department: 'Computer Science', credits: 4, facultyId: F(0), semester: '5', college: 'Vishva Institute of Technology', createdAt: now },
    { code: 'CS305', name: 'Database Management Systems', department: 'Computer Science', credits: 4, facultyId: F(0), semester: '5', college: 'Vishva Institute of Technology', createdAt: now },
    { code: 'AI401', name: 'Machine Learning', department: 'Computer Science', credits: 3, facultyId: F(0), semester: '7', college: 'Vishva Institute of Technology', createdAt: now },
    { code: 'CS201', name: 'Operating Systems', department: 'Computer Science', credits: 4, facultyId: F(2), semester: '3', college: 'Vishva Institute of Technology', createdAt: now },
    { code: 'EC220', name: 'Digital Electronics', department: 'Electronics', credits: 3, facultyId: F(1), semester: '3', college: 'Vishva Institute of Technology', createdAt: now },
    { code: 'EC310', name: 'Embedded Systems', department: 'Electronics', credits: 3, facultyId: F(1), semester: '5', college: 'Vishva Institute of Technology', createdAt: now },
    { code: 'ME101', name: 'Engineering Mechanics', department: 'Mechanical', credits: 4, facultyId: F(3), semester: '1', college: 'Vishva Institute of Technology', createdAt: now },
    { code: 'ME205', name: 'Thermodynamics', department: 'Mechanical', credits: 3, facultyId: F(3), semester: '3', college: 'Vishva Institute of Technology', createdAt: now },
  ]);
  const C = (i) => Object.values(coursesResult.insertedIds)[i];
  console.log(`  Courses: ${coursesResult.insertedCount}`);

  // ══════════════════════════════════════════════
  // 4. COURSE ENROLLMENTS
  // ══════════════════════════════════════════════
  await db.collection('course_enrollments').insertMany([
    { studentId: S(0), courseId: C(0), createdAt: now }, { studentId: S(0), courseId: C(1), createdAt: now }, { studentId: S(0), courseId: C(2), createdAt: now },
    { studentId: S(1), courseId: C(0), createdAt: now }, { studentId: S(1), courseId: C(1), createdAt: now }, { studentId: S(1), courseId: C(2), createdAt: now },
    { studentId: S(2), courseId: C(4), createdAt: now }, { studentId: S(2), courseId: C(5), createdAt: now }, { studentId: S(2), courseId: C(0), createdAt: now },
    { studentId: S(3), courseId: C(0), createdAt: now }, { studentId: S(3), courseId: C(1), createdAt: now }, { studentId: S(3), courseId: C(3), createdAt: now },
    { studentId: S(4), courseId: C(6), createdAt: now }, { studentId: S(4), courseId: C(7), createdAt: now },
    { studentId: S(5), courseId: C(0), createdAt: now }, { studentId: S(5), courseId: C(1), createdAt: now },
    { studentId: S(6), courseId: C(4), createdAt: now }, { studentId: S(6), courseId: C(5), createdAt: now },
    { studentId: S(7), courseId: C(0), createdAt: now }, { studentId: S(7), courseId: C(2), createdAt: now },
    { studentId: S(8), courseId: C(6), createdAt: now }, { studentId: S(8), courseId: C(7), createdAt: now },
    { studentId: S(9), courseId: C(0), createdAt: now }, { studentId: S(9), courseId: C(3), createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 5. CLASSROOMS
  // ══════════════════════════════════════════════
  const classResult = await db.collection('classrooms').insertMany([
    { name: 'CS-301', building: 'Block A', capacity: 60, beacons: ['B1:A0:01'], wifiBssids: ['AA:BB:CC:DD:EE:01'], latitude: 12.9716, longitude: 77.5946, radius: 25, createdAt: now },
    { name: 'EC-201', building: 'Block B', capacity: 45, beacons: ['B2:A0:01'], wifiBssids: ['AA:BB:CC:DD:EE:02'], latitude: 12.9720, longitude: 77.5950, radius: 25, createdAt: now },
    { name: 'ME-101', building: 'Block C', capacity: 80, beacons: ['B3:A0:01'], wifiBssids: ['AA:BB:CC:DD:EE:03'], latitude: 12.9725, longitude: 77.5955, radius: 25, createdAt: now },
    { name: 'CS-Lab1', building: 'Block A', capacity: 40, beacons: ['B1:A0:02'], wifiBssids: ['AA:BB:CC:DD:EE:04'], latitude: 12.9717, longitude: 77.5947, radius: 25, createdAt: now },
  ]);
  const clIds = Object.values(classResult.insertedIds);

  // ══════════════════════════════════════════════
  // 6. TIMETABLE SLOTS
  // ══════════════════════════════════════════════
  await db.collection('timetable_slots').insertMany([
    { courseId: C(0), dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:30', room: 'CS-301', facultyId: F(0), createdAt: now },
    { courseId: C(0), dayOfWeek: 'Wednesday', startTime: '09:00', endTime: '10:30', room: 'CS-301', facultyId: F(0), createdAt: now },
    { courseId: C(1), dayOfWeek: 'Tuesday', startTime: '11:00', endTime: '12:30', room: 'CS-301', facultyId: F(0), createdAt: now },
    { courseId: C(1), dayOfWeek: 'Thursday', startTime: '11:00', endTime: '12:30', room: 'CS-301', facultyId: F(0), createdAt: now },
    { courseId: C(2), dayOfWeek: 'Friday', startTime: '14:00', endTime: '15:30', room: 'CS-Lab1', facultyId: F(0), createdAt: now },
    { courseId: C(3), dayOfWeek: 'Monday', startTime: '11:00', endTime: '12:30', room: 'CS-301', facultyId: F(2), createdAt: now },
    { courseId: C(4), dayOfWeek: 'Monday', startTime: '14:00', endTime: '15:30', room: 'EC-201', facultyId: F(1), createdAt: now },
    { courseId: C(4), dayOfWeek: 'Wednesday', startTime: '14:00', endTime: '15:30', room: 'EC-201', facultyId: F(1), createdAt: now },
    { courseId: C(5), dayOfWeek: 'Tuesday', startTime: '09:00', endTime: '10:30', room: 'EC-201', facultyId: F(1), createdAt: now },
    { courseId: C(6), dayOfWeek: 'Tuesday', startTime: '14:00', endTime: '15:30', room: 'ME-101', facultyId: F(3), createdAt: now },
    { courseId: C(7), dayOfWeek: 'Thursday', startTime: '14:00', endTime: '15:30', room: 'ME-101', facultyId: F(3), createdAt: now },
    { courseId: C(3), dayOfWeek: 'Thursday', startTime: '09:00', endTime: '10:30', room: 'CS-Lab1', facultyId: F(2), createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 7. SCHEDULES
  // ══════════════════════════════════════════════
  await db.collection('schedules').insertMany([
    { courseId: C(0), classroomId: clIds[0], dayOfWeek: 'monday', startTime: '09:00', endTime: '10:30', semester: '5', createdAt: now },
    { courseId: C(1), classroomId: clIds[0], dayOfWeek: 'tuesday', startTime: '11:00', endTime: '12:30', semester: '5', createdAt: now },
    { courseId: C(4), classroomId: clIds[1], dayOfWeek: 'monday', startTime: '14:00', endTime: '15:30', semester: '3', createdAt: now },
    { courseId: C(6), classroomId: clIds[2], dayOfWeek: 'tuesday', startTime: '14:00', endTime: '15:30', semester: '1', createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 8. ATTENDANCE RECORDS
  // ══════════════════════════════════════════════
  const attRecords = [];
  for (const sid of [S(0), S(1), S(2), S(3), S(5), S(6), S(7), S(9)]) {
    for (const cid of [C(0), C(1), C(4)]) {
      for (let i = 0; i < 30; i++) {
        const dt = daysAgo(30 - i);
        if (dt.getDay() === 0 || dt.getDay() === 6) continue;
        const r = Math.random();
        attRecords.push({ studentId: sid, courseId: cid, date: dateStr(dt), status: r < 0.15 ? 'absent' : r < 0.25 ? 'late' : 'present', method: 'qr', sessionId: null, markedAt: iso(now), createdAt: now });
      }
    }
  }
  if (attRecords.length > 0) await db.collection('attendance_records').insertMany(attRecords);

  // ══════════════════════════════════════════════
  // 9. ATTENDANCE SESSIONS
  // ══════════════════════════════════════════════
  const sessResult = await db.collection('attendance_sessions').insertMany([
    { courseId: C(0), facultyId: F(0), date: dateStr(daysAgo(2)), type: 'qr', qrCode: 'QR-DS-2026-001', startTime: '09:00', endTime: '10:30', isActive: false, location: { lat: 12.9716, lng: 77.5946 }, radius: 50, classroomId: clIds[0], day: 'Monday', createdAt: now },
    { courseId: C(0), facultyId: F(0), date: dateStr(now), type: 'qr', qrCode: 'QR-DS-2026-002', startTime: '09:00', endTime: '10:30', isActive: true, location: { lat: 12.9716, lng: 77.5946 }, radius: 50, classroomId: clIds[0], day: 'Wednesday', createdAt: now },
    { courseId: C(1), facultyId: F(0), date: dateStr(daysAgo(1)), type: 'face', qrCode: null, startTime: '11:00', endTime: '12:30', isActive: false, location: { lat: 12.9716, lng: 77.5946 }, radius: 50, classroomId: clIds[0], day: 'Tuesday', createdAt: now },
    { courseId: C(4), facultyId: F(1), date: dateStr(daysAgo(3)), type: 'qr', qrCode: 'QR-EC-2026-001', startTime: '14:00', endTime: '15:30', isActive: false, location: { lat: 12.9720, lng: 77.5950 }, radius: 50, classroomId: clIds[1], day: 'Monday', createdAt: now },
    { courseId: C(4), facultyId: F(1), date: dateStr(now), type: 'beacon', qrCode: null, startTime: '14:00', endTime: '15:30', isActive: true, location: { lat: 12.9720, lng: 77.5950 }, radius: 50, classroomId: clIds[1], day: 'Wednesday', createdAt: now },
    { courseId: C(6), facultyId: F(3), date: dateStr(daysAgo(5)), type: 'qr', qrCode: 'QR-ME-2026-001', startTime: '14:00', endTime: '15:30', isActive: false, location: { lat: 12.9725, lng: 77.5955 }, radius: 50, classroomId: clIds[2], day: 'Tuesday', createdAt: now },
    { courseId: C(2), facultyId: F(0), date: dateStr(daysAgo(4)), type: 'qr', qrCode: 'QR-AI-2026-001', startTime: '14:00', endTime: '15:30', isActive: false, location: { lat: 12.9717, lng: 77.5947 }, radius: 50, classroomId: clIds[3], day: 'Friday', createdAt: now },
    { courseId: C(3), facultyId: F(2), date: dateStr(daysAgo(6)), type: 'face', qrCode: null, startTime: '11:00', endTime: '12:30', isActive: false, location: { lat: 12.9716, lng: 77.5946 }, radius: 50, classroomId: clIds[0], day: 'Monday', createdAt: now },
  ]);
  const sIds = Object.values(sessResult.insertedIds);

  // ══════════════════════════════════════════════
  // 10. ATTENDANCE ROLL ENTRIES
  // ══════════════════════════════════════════════
  const rollEntries = [];
  for (const sid of [S(0), S(1), S(2), S(3), S(5)]) {
    for (let si = 0; si < 4; si++) {
      rollEntries.push({ sessionId: sIds[si], studentId: sid, checkInTime: daysAgo(6 - si), method: 'qr', status: Math.random() > 0.2 ? 'present' : 'late', location: { lat: 12.9716, lng: 77.5946 }, verified: true, overrideReason: null, handRaisedAt: null, createdAt: now });
    }
  }
  await db.collection('attendance_roll_entries').insertMany(rollEntries);

  // ══════════════════════════════════════════════
  // 11. LEAVE REQUESTS
  // ══════════════════════════════════════════════
  await db.collection('leave_requests').insertMany([
    { studentId: S(0), studentName: 'Aarav Sharma', studentEmail: 'aarav@campus.edu', date: dateStr(daysAgo(10)), reason: 'Medical appointment', courseId: C(0), status: 'approved', comment: 'Approved. Get well soon.', createdAt: now, updatedAt: now },
    { studentId: S(1), studentName: 'Isha Patel', studentEmail: 'isha@campus.edu', date: dateStr(daysFromNow(3)), reason: 'Family function', courseId: C(1), status: 'pending', comment: '', createdAt: now, updatedAt: now },
    { studentId: S(5), studentName: 'Sneha Reddy', studentEmail: 'sneha@campus.edu', date: dateStr(daysAgo(5)), reason: 'Personal reasons', courseId: null, status: 'rejected', comment: 'Cannot approve during exam week.', createdAt: now, updatedAt: now },
    { studentId: S(9), studentName: 'Nisha Joshi', studentEmail: 'nisha@campus.edu', date: dateStr(daysFromNow(7)), reason: 'Sports tournament', courseId: C(0), status: 'approved', comment: 'All the best!', createdAt: now, updatedAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 12. EXAMS
  // ══════════════════════════════════════════════
  const examsResult = await db.collection('exams').insertMany([
    { courseId: C(0), title: 'Mid-Term Exam - DSA', date: dateStr(daysFromNow(30)), duration: '120 minutes', totalMarks: 100, type: 'midterm', createdAt: now },
    { courseId: C(1), title: 'Quiz 1 - DBMS', date: dateStr(daysFromNow(14)), duration: '30 minutes', totalMarks: 20, type: 'quiz', createdAt: now },
    { courseId: C(4), title: 'Mid-Term - Digital Electronics', date: dateStr(daysFromNow(25)), duration: '90 minutes', totalMarks: 80, type: 'midterm', createdAt: now },
    { courseId: C(0), title: 'Final Exam - DSA', date: dateStr(daysFromNow(60)), duration: '180 minutes', totalMarks: 100, type: 'final', createdAt: now },
    { courseId: C(6), title: 'Quiz - Engineering Mechanics', date: dateStr(daysFromNow(10)), duration: '20 minutes', totalMarks: 20, type: 'quiz', createdAt: now },
    { courseId: C(3), title: 'Mid-Term - OS', date: dateStr(daysFromNow(20)), duration: '120 minutes', totalMarks: 100, type: 'midterm', createdAt: now },
  ]);
  const exIds = Object.values(examsResult.insertedIds);

  // ══════════════════════════════════════════════
  // 13. EXAM RESULTS
  // ══════════════════════════════════════════════
  await db.collection('exam_results').insertMany([
    { studentId: S(0), examId: exIds[0], courseId: C(0), marks: 82, grade: 'A', semester: '5', createdAt: now },
    { studentId: S(0), examId: exIds[1], courseId: C(1), marks: 18, grade: 'A+', semester: '5', createdAt: now },
    { studentId: S(1), examId: exIds[0], courseId: C(0), marks: 91, grade: 'A+', semester: '5', createdAt: now },
    { studentId: S(2), examId: exIds[0], courseId: C(0), marks: 65, grade: 'B+', semester: '5', createdAt: now },
    { studentId: S(3), examId: exIds[0], courseId: C(0), marks: 88, grade: 'A', semester: '5', createdAt: now },
    { studentId: S(5), examId: exIds[0], courseId: C(0), marks: 73, grade: 'B+', semester: '5', createdAt: now },
    { studentId: S(7), examId: exIds[0], courseId: C(0), marks: 95, grade: 'A+', semester: '5', createdAt: now },
    { studentId: S(2), examId: exIds[2], courseId: C(4), marks: 70, grade: 'A', semester: '3', createdAt: now },
    { studentId: S(6), examId: exIds[2], courseId: C(4), marks: 62, grade: 'B', semester: '3', createdAt: now },
    { studentId: S(4), examId: exIds[4], courseId: C(6), marks: 16, grade: 'B+', semester: '1', createdAt: now },
    { studentId: S(8), examId: exIds[4], courseId: C(6), marks: 14, grade: 'B', semester: '1', createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 14. GENERATED EXAMS
  // ══════════════════════════════════════════════
  await db.collection('generated_exams').insertMany([
    { examId: exIds[0], courseId: C(0), title: 'DSA Practice Set', type: 'practice', questionCount: 20, totalMarks: 50, createdById: F(0), createdAt: now },
    { examId: exIds[1], courseId: C(1), title: 'DBMS Quiz Practice', type: 'practice', questionCount: 10, totalMarks: 20, createdById: F(0), createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 15. QUESTION BANK ITEMS
  // ══════════════════════════════════════════════
  await db.collection('question_bank_items').insertMany([
    { subject: 'Data Structures', topic: 'Binary Trees', question: 'Time complexity of searching in balanced BST?', options: ['O(n)', 'O(log n)', 'O(1)', 'O(n log n)'], correctAnswer: 'O(log n)', difficulty: 'easy', marks: 1, type: 'mcq', createdAt: now },
    { subject: 'Data Structures', topic: 'Graphs', question: 'Implement Dijkstra algorithm for shortest path.', options: [], correctAnswer: '', difficulty: 'hard', marks: 10, type: 'coding', createdAt: now },
    { subject: 'DBMS', topic: 'Normalization', question: 'Explain difference between 2NF and 3NF with examples.', options: [], correctAnswer: '', difficulty: 'medium', marks: 5, type: 'subjective', createdAt: now },
    { subject: 'DBMS', topic: 'SQL', question: 'What is the difference between WHERE and HAVING?', options: ['Filter before/after grouping', 'Same thing', 'WHERE for rows HAVING for columns', 'None'], correctAnswer: 'Filter before/after grouping', difficulty: 'easy', marks: 1, type: 'mcq', createdAt: now },
    { subject: 'OS', topic: 'Scheduling', question: 'Which scheduling algorithm may cause starvation?', options: ['FCFS', 'Round Robin', 'SJF', 'All'], correctAnswer: 'SJF', difficulty: 'medium', marks: 2, type: 'mcq', createdAt: now },
    { subject: 'OS', topic: 'Memory', question: 'What is virtual memory?', options: ['Physical RAM', 'Disk space used as RAM', 'Cache memory', 'ROM'], correctAnswer: 'Disk space used as RAM', difficulty: 'easy', marks: 1, type: 'mcq', createdAt: now },
    { subject: 'Digital Electronics', topic: 'Logic Gates', question: 'How many inputs does an XOR gate have?', options: ['1', '2', '3', '4'], correctAnswer: '2', difficulty: 'easy', marks: 1, type: 'mcq', createdAt: now },
    { subject: 'Machine Learning', topic: 'Regression', question: 'What is overfitting in ML?', options: ['Model too simple', 'Model fits noise in training data', 'Model underperforms', 'Model has high bias'], correctAnswer: 'Model fits noise in training data', difficulty: 'medium', marks: 2, type: 'mcq', createdAt: now },
    { subject: 'Machine Learning', topic: 'Neural Networks', question: 'Explain backpropagation algorithm.', options: [], correctAnswer: '', difficulty: 'hard', marks: 10, type: 'subjective', createdAt: now },
    { subject: 'Data Structures', topic: 'Arrays', question: 'Time complexity of accessing element by index in array?', options: ['O(n)', 'O(log n)', 'O(1)', 'O(n^2)'], correctAnswer: 'O(1)', difficulty: 'easy', marks: 1, type: 'mcq', createdAt: now },
    { subject: 'DBMS', topic: 'Transactions', question: 'What does ACID stand for?', options: ['Atomicity Consistency Isolation Durability', 'Add Change Insert Delete', 'Association Correlation Integration Distribution', 'None'], correctAnswer: 'Atomicity Consistency Isolation Durability', difficulty: 'easy', marks: 1, type: 'mcq', createdAt: now },
    { subject: 'Engineering Mechanics', topic: 'Statics', question: 'State conditions for equilibrium of a rigid body.', options: [], correctAnswer: '', difficulty: 'medium', marks: 5, type: 'subjective', createdAt: now },
    { subject: 'Data Structures', topic: 'Hashing', question: 'What is a hash collision?', options: ['Two keys map to same bucket', 'Table is full', 'Key not found', 'Invalid key'], correctAnswer: 'Two keys map to same bucket', difficulty: 'easy', marks: 1, type: 'mcq', createdAt: now },
    { subject: 'OS', topic: 'Deadlocks', question: 'Which is NOT a necessary condition for deadlock?', options: ['Mutual Exclusion', 'Hold and Wait', 'Preemption', 'Circular Wait'], correctAnswer: 'Preemption', difficulty: 'medium', marks: 2, type: 'mcq', createdAt: now },
    { subject: 'Machine Learning', topic: 'Classification', question: 'What is a confusion matrix?', options: ['Matrix of weights', 'Table showing TP TN FP FN', 'Cost function', 'Activation function'], correctAnswer: 'Table showing TP TN FP FN', difficulty: 'easy', marks: 1, type: 'mcq', createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 16. ASSIGNMENTS
  // ══════════════════════════════════════════════
  const assResult = await db.collection('assignments').insertMany([
    { courseId: C(0), title: 'Implement Red-Black Tree', description: 'Implement insert delete and search operations.', dueDate: dateStr(daysFromNow(7)), maxMarks: 100, createdById: F(0), createdAt: now },
    { courseId: C(1), title: 'ER Diagram Project', description: 'Design ER diagram for hospital management system.', dueDate: dateStr(daysFromNow(14)), maxMarks: 50, createdById: F(0), createdAt: now },
    { courseId: C(0), title: 'Graph Algorithms Lab', description: 'Implement BFS and DFS with shortest path.', dueDate: dateStr(daysAgo(3)), maxMarks: 50, createdById: F(0), createdAt: now },
    { courseId: C(4), title: 'Boolean Algebra Exercises', description: 'Simplify Boolean expressions using K-maps.', dueDate: dateStr(daysFromNow(10)), maxMarks: 30, createdById: F(1), createdAt: now },
    { courseId: C(3), title: 'Process Scheduling Simulation', description: 'Implement FCFS SJF and Round Robin algorithms.', dueDate: dateStr(daysFromNow(12)), maxMarks: 80, createdById: F(2), createdAt: now },
    { courseId: C(2), title: 'Linear Regression Project', description: 'Build linear regression model on housing dataset.', dueDate: dateStr(daysFromNow(20)), maxMarks: 100, createdById: F(0), createdAt: now },
    { courseId: C(6), title: 'Free Body Diagram Analysis', description: 'Draw FBDs for 10 structures and solve for reactions.', dueDate: dateStr(daysAgo(1)), maxMarks: 40, createdById: F(3), createdAt: now },
    { courseId: C(5), title: 'Arduino Interfacing Lab', description: 'Interface LCD display and temperature sensor.', dueDate: dateStr(daysFromNow(15)), maxMarks: 50, createdById: F(1), createdAt: now },
  ]);
  const aIds = Object.values(assResult.insertedIds);

  // ══════════════════════════════════════════════
  // 17. SUBMISSIONS
  // ══════════════════════════════════════════════
  await db.collection('submissions').insertMany([
    { assignmentId: aIds[2], studentId: S(0), content: 'Completed BFS and DFS implementation with shortest path.', submittedAt: iso(daysAgo(4)), marks: 45, feedback: 'Good work optimize space complexity.', createdAt: now },
    { assignmentId: aIds[2], studentId: S(1), content: 'BFS and DFS code with test cases using adjacency list.', submittedAt: iso(daysAgo(3)), marks: 48, feedback: 'Excellent implementation!', createdAt: now },
    { assignmentId: aIds[2], studentId: S(3), content: 'Graph algorithms in Python with visualization.', submittedAt: iso(daysAgo(5)), marks: 50, feedback: 'Outstanding! Great use of matplotlib.', createdAt: now },
    { assignmentId: aIds[6], studentId: S(4), content: 'FBD analysis for all 10 structures with detailed calculations.', submittedAt: iso(daysAgo(2)), marks: 35, feedback: 'Minor errors in Q7 Q8. Check units.', createdAt: now },
    { assignmentId: aIds[6], studentId: S(8), content: 'Free body diagram solutions with step-by-step approach.', submittedAt: iso(daysAgo(1)), marks: null, feedback: null, createdAt: now },
    { assignmentId: aIds[1], studentId: S(0), content: 'ER Diagram for hospital management system using draw.io.', submittedAt: iso(daysAgo(1)), marks: null, feedback: null, createdAt: now },
    { assignmentId: aIds[1], studentId: S(3), content: 'ER diagram with detailed entity relationships and cardinalities.', submittedAt: iso(daysAgo(2)), marks: null, feedback: null, createdAt: now },
    { assignmentId: aIds[3], studentId: S(2), content: 'Boolean algebra K-map simplifications for all 10 problems.', submittedAt: iso(daysAgo(1)), marks: null, feedback: null, createdAt: now },
    { assignmentId: aIds[0], studentId: S(0), content: 'Red-Black Tree implementation in C++ with all operations.', submittedAt: iso(daysAgo(1)), marks: null, feedback: null, createdAt: now },
    { assignmentId: aIds[0], studentId: S(1), content: 'Red-Black Tree in Java with visual tree output.', submittedAt: iso(daysAgo(1)), marks: null, feedback: null, createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 18. NOTES
  // ══════════════════════════════════════════════
  await db.collection('notes').insertMany([
    { courseId: C(0), title: 'Binary Trees Lecture Notes', content: 'Comprehensive notes on binary tree traversals BST operations and balanced trees.', createdById: F(0), createdAt: now },
    { courseId: C(1), title: 'Normalization Guide', content: 'Step-by-step guide to 1NF 2NF 3NF and BCNF with examples.', createdById: F(0), createdAt: now },
    { courseId: C(1), title: 'SQL Joins Cheat Sheet', content: 'Visual guide to INNER JOIN LEFT JOIN RIGHT JOIN FULL OUTER JOIN.', createdById: F(0), createdAt: now },
    { courseId: C(4), title: 'Karnaugh Map Tutorial', content: 'Complete guide to K-map simplification for 2 3 4 and 5 variables.', createdById: F(1), createdAt: now },
    { courseId: C(3), title: 'Process Scheduling Notes', content: 'Detailed explanation of FCFS SJF SRTF Round Robin and Priority scheduling.', createdById: F(2), createdAt: now },
    { courseId: C(6), title: 'Statics Formulas Sheet', content: 'Important formulas for equilibrium moments friction and center of gravity.', createdById: F(3), createdAt: now },
    { courseId: C(2), title: 'ML Algorithm Comparison', content: 'Comparison of linear regression logistic regression SVM decision trees and random forests.', createdById: F(0), createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 19. FEES
  // ══════════════════════════════════════════════
  const feesResult = await db.collection('fees').insertMany([
    { userId: S(0), type: 'Tuition Fee', amount: 45000, dueDate: dateStr(daysFromNow(15)), status: 'pending', semester: '5', receiptId: null, createdAt: now },
    { userId: S(0), type: 'Hostel Fee', amount: 25000, dueDate: dateStr(daysFromNow(15)), status: 'paid', semester: '5', receiptId: null, createdAt: now },
    { userId: S(1), type: 'Tuition Fee', amount: 45000, dueDate: dateStr(daysAgo(5)), status: 'overdue', semester: '3', receiptId: null, createdAt: now },
    { userId: S(2), type: 'Tuition Fee', amount: 42000, dueDate: dateStr(daysFromNow(20)), status: 'pending', semester: '3', receiptId: null, createdAt: now },
    { userId: S(3), type: 'Tuition Fee', amount: 48000, dueDate: dateStr(daysFromNow(10)), status: 'paid', semester: '7', receiptId: null, createdAt: now },
    { userId: S(4), type: 'Tuition Fee', amount: 38000, dueDate: dateStr(daysFromNow(25)), status: 'pending', semester: '1', receiptId: null, createdAt: now },
    { userId: S(5), type: 'Tuition Fee', amount: 45000, dueDate: dateStr(daysAgo(10)), status: 'overdue', semester: '3', receiptId: null, createdAt: now },
    { userId: S(5), type: 'Lab Fee', amount: 5000, dueDate: dateStr(daysAgo(10)), status: 'overdue', semester: '3', receiptId: null, createdAt: now },
    { userId: S(6), type: 'Tuition Fee', amount: 42000, dueDate: dateStr(daysFromNow(18)), status: 'pending', semester: '5', receiptId: null, createdAt: now },
    { userId: S(7), type: 'Tuition Fee', amount: 48000, dueDate: dateStr(daysFromNow(12)), status: 'paid', semester: '7', receiptId: null, createdAt: now },
    { userId: S(8), type: 'Tuition Fee', amount: 38000, dueDate: dateStr(daysFromNow(30)), status: 'pending', semester: '3', receiptId: null, createdAt: now },
    { userId: S(9), type: 'Tuition Fee', amount: 38000, dueDate: dateStr(daysFromNow(30)), status: 'pending', semester: '1', receiptId: null, createdAt: now },
  ]);
  const fIds = Object.values(feesResult.insertedIds);

  // ══════════════════════════════════════════════
  // 20. PAYMENT RECEIPTS
  // ══════════════════════════════════════════════
  await db.collection('payment_receipts').insertMany([
    { feeId: fIds[1], userId: S(0), amount: 25000, razorpayPaymentId: 'pay_QB1abc123', date: iso(daysAgo(10)), createdAt: now },
    { feeId: fIds[4], userId: S(3), amount: 48000, razorpayPaymentId: 'pay_QB2def456', date: iso(daysAgo(5)), createdAt: now },
    { feeId: fIds[9], userId: S(7), amount: 48000, razorpayPaymentId: 'pay_QB3ghi789', date: iso(daysAgo(3)), createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 21. BOOKS
  // ══════════════════════════════════════════════
  const booksResult = await db.collection('books').insertMany([
    { title: 'Introduction to Algorithms (CLRS)', author: 'Thomas H. Cormen', isbn: '978-0262033848', department: 'Computer Science', available: 3, total: 5, createdAt: now },
    { title: 'Database System Concepts', author: 'Abraham Silberschatz', isbn: '978-0078022159', department: 'Computer Science', available: 2, total: 4, createdAt: now },
    { title: 'Digital Design', author: 'M. Morris Mano', isbn: '978-0132774208', department: 'Electronics', available: 4, total: 4, createdAt: now },
    { title: 'Operating System Concepts', author: 'Silberschatz & Galvin', isbn: '978-1118063330', department: 'Computer Science', available: 3, total: 6, createdAt: now },
    { title: 'Engineering Mechanics', author: 'R.C. Hibbeler', isbn: '978-0132915540', department: 'Mechanical', available: 5, total: 5, createdAt: now },
    { title: 'Pattern Recognition & ML', author: 'Christopher Bishop', isbn: '978-0387310732', department: 'Computer Science', available: 2, total: 3, createdAt: now },
    { title: 'Modern Digital Electronics', author: 'R.P. Jain', isbn: '978-1259006210', department: 'Electronics', available: 3, total: 4, createdAt: now },
    { title: 'Thermodynamics: An Engineering Approach', author: 'Yunus Cengel', isbn: '978-0073398198', department: 'Mechanical', available: 4, total: 5, createdAt: now },
  ]);
  const bIds = Object.values(booksResult.insertedIds);

  // ══════════════════════════════════════════════
  // 22. BOOK ISSUES
  // ══════════════════════════════════════════════
  await db.collection('book_issues').insertMany([
    { bookId: bIds[0], userId: S(0), issueDate: dateStr(daysAgo(20)), dueDate: dateStr(daysAgo(6)), returnDate: null, fine: 70, status: 'overdue', createdAt: now },
    { bookId: bIds[1], userId: S(1), issueDate: dateStr(daysAgo(10)), dueDate: dateStr(daysFromNow(4)), returnDate: null, fine: 0, status: 'issued', createdAt: now },
    { bookId: bIds[3], userId: S(3), issueDate: dateStr(daysAgo(15)), dueDate: dateStr(daysAgo(1)), returnDate: null, fine: 0, status: 'overdue', createdAt: now },
    { bookId: bIds[5], userId: S(5), issueDate: dateStr(daysAgo(5)), dueDate: dateStr(daysFromNow(9)), returnDate: null, fine: 0, status: 'issued', createdAt: now },
    { bookId: bIds[0], userId: S(7), issueDate: dateStr(daysAgo(30)), dueDate: dateStr(daysAgo(16)), returnDate: dateStr(daysAgo(15)), fine: 0, status: 'returned', createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 23. HOSTELS
  // ══════════════════════════════════════════════
  const hostResult = await db.collection('hostels').insertMany([
    { name: 'Gandhi Hall', type: 'Boys', total_rooms: 200, occupied: 145, warden_name: 'Mr. Verma', contact: '+919876500001', amenities: ['WiFi', 'Mess', 'Gym', 'Laundry'], description: 'Main boys hostel with modern facilities.', createdAt: now },
    { name: 'Sarojini Hall', type: 'Girls', total_rooms: 150, occupied: 120, warden_name: 'Mrs. Nair', contact: '+919876500002', amenities: ['WiFi', 'Mess', 'Gym', 'Library'], description: 'Girls hostel with 24/7 security.', createdAt: now },
    { name: 'Nehru Block', type: 'Boys', total_rooms: 100, occupied: 72, warden_name: 'Mr. Rao', contact: '+919876500003', amenities: ['WiFi', 'Mess', 'Study Hall'], description: 'Senior boys hostel.', createdAt: now },
    { name: 'Kasturba Hall', type: 'Girls', total_rooms: 80, occupied: 55, warden_name: 'Mrs. Gupta', contact: '+919876500004', amenities: ['WiFi', 'Mess', 'Gym'], description: 'First year girls hostel.', createdAt: now },
  ]);
  const hIds = Object.values(hostResult.insertedIds);

  // ══════════════════════════════════════════════
  // 24. HOSTEL ALLOCATIONS
  // ══════════════════════════════════════════════
  await db.collection('hostel_allocations').insertMany([
    { hostelId: hIds[0], studentId: S(0), room: 'A-201', bed: '1', startDate: dateStr(daysAgo(180)), endDate: null, status: 'active', createdAt: now },
    { hostelId: hIds[0], studentId: S(2), room: 'A-201', bed: '2', startDate: dateStr(daysAgo(180)), endDate: null, status: 'active', createdAt: now },
    { hostelId: hIds[0], studentId: S(6), room: 'B-105', bed: '1', startDate: dateStr(daysAgo(120)), endDate: null, status: 'active', createdAt: now },
    { hostelId: hIds[1], studentId: S(1), room: 'C-302', bed: '1', startDate: dateStr(daysAgo(180)), endDate: null, status: 'active', createdAt: now },
    { hostelId: hIds[1], studentId: S(5), room: 'C-302', bed: '2', startDate: dateStr(daysAgo(180)), endDate: null, status: 'active', createdAt: now },
    { hostelId: hIds[1], studentId: S(3), room: 'D-101', bed: '1', startDate: dateStr(daysAgo(365)), endDate: null, status: 'active', createdAt: now },
    { hostelId: hIds[2], studentId: S(7), room: 'E-404', bed: '1', startDate: dateStr(daysAgo(200)), endDate: null, status: 'active', createdAt: now },
    { hostelId: hIds[2], studentId: S(9), room: 'E-404', bed: '2', startDate: dateStr(daysAgo(30)), endDate: null, status: 'active', createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 25. TRANSPORT ROUTES
  // ══════════════════════════════════════════════
  const rtResult = await db.collection('transport_routes').insertMany([
    { route_name: 'Koramangala Express', vehicle_number: 'KA-01-AB-1234', driver_name: 'Rajesh Kumar', driver_phone: '+91 98765 43210', stops: [{ name: 'Koramangala', time: '07:30' }, { name: 'HSR Layout', time: '07:50' }, { name: 'College', time: '08:30' }], active: true, createdAt: now },
    { route_name: 'Whitefield Shuttle', vehicle_number: 'KA-02-CD-5678', driver_name: 'Mohammed Irfan', driver_phone: '+91 98765 43211', stops: [{ name: 'Whitefield', time: '07:00' }, { name: 'Marathahalli', time: '07:30' }, { name: 'College', time: '08:30' }], active: true, createdAt: now },
    { route_name: 'Electronic City Bus', vehicle_number: 'KA-03-EF-9012', driver_name: 'Suresh Patil', driver_phone: '+91 98765 43212', stops: [{ name: 'Electronic City', time: '06:45' }, { name: 'HSR Layout', time: '07:15' }, { name: 'College', time: '08:15' }], active: true, createdAt: now },
    { route_name: 'Jayanagar Route', vehicle_number: 'KA-04-GH-3456', driver_name: 'Venkatesh R', driver_phone: '+91 98765 43213', stops: [{ name: 'Jayanagar', time: '07:45' }, { name: 'JP Nagar', time: '08:00' }, { name: 'College', time: '08:30' }], active: true, createdAt: now },
  ]);
  const rtIds = Object.values(rtResult.insertedIds);

  // ══════════════════════════════════════════════
  // 26. TRANSPORT ENROLLMENTS
  // ══════════════════════════════════════════════
  await db.collection('transport_enrollments').insertMany([
    { routeId: rtIds[0], studentId: S(0), startDate: dateStr(daysAgo(180)), status: 'active', createdAt: now },
    { routeId: rtIds[0], studentId: S(1), startDate: dateStr(daysAgo(180)), status: 'active', createdAt: now },
    { routeId: rtIds[1], studentId: S(3), startDate: dateStr(daysAgo(120)), status: 'active', createdAt: now },
    { routeId: rtIds[2], studentId: S(5), startDate: dateStr(daysAgo(90)), status: 'active', createdAt: now },
    { routeId: rtIds[3], studentId: S(9), startDate: dateStr(daysAgo(30)), status: 'active', createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 27. GRIEVANCES
  // ══════════════════════════════════════════════
  await db.collection('grievances').insertMany([
    { userId: S(0), category: 'Academic', subject: 'Late Assignment Submission', description: 'Need extension for DS assignment due to medical reasons.', status: 'open', priority: 'medium', responses: [], createdAt: now },
    { userId: S(1), category: 'Facility', subject: 'WiFi Not Working', description: 'WiFi in Block A has been down for 2 days.', status: 'in_progress', priority: 'high', responses: [{ userId: A(0), text: 'IT team notified. Expected fix by tomorrow.', createdAt: iso(now) }], createdAt: now },
    { userId: S(4), category: 'Hostel', subject: 'Mess Food Quality', description: 'Quality of food in mess has deteriorated significantly.', status: 'open', priority: 'medium', responses: [], createdAt: now },
    { userId: S(6), category: 'Academic', subject: 'Lab Equipment', description: 'Oscilloscopes in EC lab are not calibrated properly.', status: 'resolved', priority: 'low', responses: [{ userId: F(1), text: 'Calibration done. Thanks for reporting.', createdAt: iso(daysAgo(5)) }], createdAt: daysAgo(10) },
    { userId: S(8), category: 'Transport', subject: 'Bus Timing Change', description: 'Request to change bus timing from 3:30 PM to 4:00 PM on Fridays.', status: 'in_progress', priority: 'low', responses: [{ userId: A(0), text: 'Under review. Will update soon.', createdAt: iso(daysAgo(2)) }], createdAt: daysAgo(3) },
    { userId: null, category: 'Facility', subject: 'AC Not Working in Library', description: 'Air conditioning in library reading room not working for a week.', status: 'open', priority: 'high', responses: [], createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 28. NOTIFICATIONS
  // ══════════════════════════════════════════════
  await db.collection('notifications').insertMany([
    { audience: 'students', title: 'Exam Schedule Released', body: 'Mid-term exam schedule published.', recipientIds: [], readBy: [], createdAt: now },
    { audience: 'all', title: 'Holiday Notice', body: 'College closed on Monday for Republic Day.', recipientIds: [], readBy: [], createdAt: now },
    { audience: 'parents', title: 'PTM Scheduled', body: 'Parent-Teacher meeting on Feb 5 at 10 AM.', recipientIds: [], readBy: [], createdAt: now },
    { audience: 'students', title: 'Placement Drive Alert', body: 'Google campus placement drive on March 15.', recipientIds: [], readBy: [], createdAt: now },
    { audience: 'faculty', title: 'Faculty Meeting', body: 'Monthly faculty meeting next Wednesday at 3 PM.', recipientIds: [], readBy: [], createdAt: now },
    { audience: 'all', title: 'Sports Day Announced', body: 'Annual sports day on April 10.', recipientIds: [], readBy: [], createdAt: now },
    { audience: 'students', title: 'Library Hours Extended', body: 'Library open until 10 PM during exam week.', recipientIds: [], readBy: [], createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 29. ANNOUNCEMENTS
  // ══════════════════════════════════════════════
  await db.collection('announcements').insertMany([
    { title: 'Mid-Term Exam Schedule', body: 'Mid-term exams begin March 15.', audience: 'students', createdById: F(0), createdAt: now },
    { title: 'Annual Day Celebration', body: 'Annual day on February 20. All invited.', audience: 'all', createdById: A(0), createdAt: now },
    { title: 'Hackathon Registration Open', body: '48-hour hackathon on April 5-7. Register by March 28.', audience: 'students', createdById: F(0), createdAt: now },
    { title: 'New Lab Equipment', body: 'New Raspberry Pi kits added to CS Lab.', audience: 'students', createdById: A(0), createdAt: now },
    { title: 'Guest Lecture - AI', body: 'Dr. Raghunathan from IISc on March 10.', audience: 'all', createdById: F(0), createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 30. EVENTS
  // ══════════════════════════════════════════════
  await db.collection('events').insertMany([
    { title: 'Tech Fest 2026', description: 'Annual technical festival with workshops and hackathons.', date: dateStr(daysFromNow(45)), type: 'festival', audience: 'all', createdAt: now },
    { title: 'Placement Drive - Google', description: 'Campus placement by Google for SDE roles.', date: dateStr(daysFromNow(30)), type: 'placement', audience: 'students', createdAt: now },
    { title: 'Hackathon 2026', description: '48-hour hackathon with prizes worth 2 lakhs.', date: dateStr(daysFromNow(60)), type: 'competition', audience: 'students', createdAt: now },
    { title: 'Cultural Night', description: 'Annual cultural night with music dance and drama.', date: dateStr(daysFromNow(20)), type: 'cultural', audience: 'all', createdAt: now },
    { title: 'Industry Visit - Infosys', description: 'Visit to Infosys Mysore campus.', date: dateStr(daysFromNow(15)), type: 'industrial', audience: 'students', createdAt: now },
    { title: 'Sports Day', description: 'Annual sports day with cricket football and athletics.', date: dateStr(daysFromNow(40)), type: 'sports', audience: 'all', createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 31. SUBSCRIPTIONS
  // ══════════════════════════════════════════════
  await db.collection('subscriptions').insertMany([
    { userId: A(0), plan: 'pro', status: 'active', startDate: dateStr(daysAgo(30)), endDate: dateStr(daysFromNow(335)), amount: 2999, razorpayOrderId: 'order_QBabc123', createdAt: now },
    { userId: A(1), plan: 'enterprise', status: 'active', startDate: dateStr(daysAgo(60)), endDate: dateStr(daysFromNow(305)), amount: 9999, razorpayOrderId: 'order_QBdef456', createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 32. ASSESSMENTS
  // ══════════════════════════════════════════════
  await db.collection('assessments').insertMany([
    { key: 'js-fundamentals', title: 'JavaScript Fundamentals', description: 'JS basics closures promises and ES6.', skillKey: 'javascript', skillName: 'JavaScript', category: 'programming', durationMinutes: 30, totalQuestions: 10, passScore: 70, difficulty: 'easy', attempts: 45, isActive: true, createdAt: now },
    { key: 'python-basics', title: 'Python Programming Basics', description: 'Python syntax data structures and OOP.', skillKey: 'python', skillName: 'Python', category: 'programming', durationMinutes: 30, totalQuestions: 10, passScore: 70, difficulty: 'easy', attempts: 32, isActive: true, createdAt: now },
    { key: 'react-advanced', title: 'React Advanced Concepts', description: 'Hooks context and performance optimization.', skillKey: 'react', skillName: 'React', category: 'programming', durationMinutes: 45, totalQuestions: 15, passScore: 65, difficulty: 'hard', attempts: 18, isActive: true, createdAt: now },
    { key: 'sql-intermediate', title: 'SQL Intermediate', description: 'Joins subqueries and window functions.', skillKey: 'sql', skillName: 'SQL', category: 'database', durationMinutes: 25, totalQuestions: 10, passScore: 75, difficulty: 'medium', attempts: 28, isActive: true, createdAt: now },
    { key: 'java-oop', title: 'Java OOP Concepts', description: 'Inheritance polymorphism and design patterns.', skillKey: 'java', skillName: 'Java', category: 'programming', durationMinutes: 30, totalQuestions: 10, passScore: 70, difficulty: 'medium', attempts: 22, isActive: true, createdAt: now },
    { key: 'aws-cloud', title: 'AWS Cloud Practitioner', description: 'AWS services security and pricing.', skillKey: 'aws', skillName: 'AWS', category: 'cloud', durationMinutes: 40, totalQuestions: 20, passScore: 60, difficulty: 'medium', attempts: 15, isActive: true, createdAt: now },
    { key: 'ml-basics', title: 'Machine Learning Basics', description: 'Supervised unsupervised learning regression classification.', skillKey: 'machine_learning', skillName: 'Machine Learning', category: 'data_science', durationMinutes: 35, totalQuestions: 12, passScore: 65, difficulty: 'medium', attempts: 12, isActive: true, createdAt: now },
    { key: 'nodejs-api', title: 'Node.js API Development', description: 'Express.js middleware REST API design.', skillKey: 'nodejs', skillName: 'Node.js', category: 'programming', durationMinutes: 30, totalQuestions: 10, passScore: 70, difficulty: 'medium', attempts: 20, isActive: true, createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 33. ASSESSMENT ATTEMPTS
  // ══════════════════════════════════════════════
  await db.collection('assessment_attempts').insertMany([
    { assessmentId: null, assessmentTitle: 'JavaScript Fundamentals', skillKey: 'javascript', studentId: S(0), studentName: 'Aarav Sharma', status: 'submitted', answers: { '0': 1, '1': 2, '2': 0, '3': 1, '4': 2, '5': 1, '6': 0, '7': 2, '8': 1, '9': 0 }, totalQuestions: 10, startedAt: iso(daysAgo(5)), expiresAt: iso(daysAgo(5)), scorePercent: 80, correctCount: 8, passed: true, submittedAt: iso(daysAgo(5)), timeTakenSeconds: 1200, certificateId: null, createdAt: now },
    { assessmentId: null, assessmentTitle: 'JavaScript Fundamentals', skillKey: 'javascript', studentId: S(1), studentName: 'Isha Patel', status: 'submitted', answers: { '0': 1, '1': 2, '2': 1, '3': 1, '4': 2, '5': 0, '6': 2, '7': 1, '8': 2, '9': 1 }, totalQuestions: 10, startedAt: iso(daysAgo(3)), expiresAt: iso(daysAgo(3)), scorePercent: 70, correctCount: 7, passed: true, submittedAt: iso(daysAgo(3)), timeTakenSeconds: 1080, certificateId: null, createdAt: now },
    { assessmentId: null, assessmentTitle: 'Python Programming Basics', skillKey: 'python', studentId: S(3), studentName: 'Priya Nair', status: 'submitted', answers: { '0': 2, '1': 1, '2': 0, '3': 2, '4': 1, '5': 2, '6': 0, '7': 1, '8': 2, '9': 0 }, totalQuestions: 10, startedAt: iso(daysAgo(4)), expiresAt: iso(daysAgo(4)), scorePercent: 90, correctCount: 9, passed: true, submittedAt: iso(daysAgo(4)), timeTakenSeconds: 900, certificateId: null, createdAt: now },
    { assessmentId: null, assessmentTitle: 'SQL Intermediate', skillKey: 'sql', studentId: S(0), studentName: 'Aarav Sharma', status: 'submitted', answers: { '0': 0, '1': 2, '2': 1, '3': 0, '4': 2, '5': 1, '6': 2, '7': 0, '8': 1, '9': 2 }, totalQuestions: 10, startedAt: iso(daysAgo(2)), expiresAt: iso(daysAgo(2)), scorePercent: 75, correctCount: 7, passed: true, submittedAt: iso(daysAgo(2)), timeTakenSeconds: 1100, certificateId: null, createdAt: now },
    { assessmentId: null, assessmentTitle: 'JavaScript Fundamentals', skillKey: 'javascript', studentId: S(5), studentName: 'Sneha Reddy', status: 'submitted', answers: { '0': 2, '1': 0, '2': 1, '3': 2, '4': 0, '5': 1, '6': 2, '7': 0, '8': 1, '9': 2 }, totalQuestions: 10, startedAt: iso(daysAgo(1)), expiresAt: iso(daysAgo(1)), scorePercent: 40, correctCount: 4, passed: false, submittedAt: iso(daysAgo(1)), timeTakenSeconds: 1500, certificateId: null, createdAt: now },
    { assessmentId: null, assessmentTitle: 'Node.js API Development', skillKey: 'nodejs', studentId: S(7), studentName: 'Kavya Singh', status: 'submitted', answers: { '0': 1, '1': 2, '2': 0, '3': 1, '4': 0, '5': 2, '6': 1, '7': 2, '8': 0, '9': 1 }, totalQuestions: 10, startedAt: iso(daysAgo(6)), expiresAt: iso(daysAgo(6)), scorePercent: 80, correctCount: 8, passed: true, submittedAt: iso(daysAgo(6)), timeTakenSeconds: 950, certificateId: null, createdAt: now },
    { assessmentId: null, assessmentTitle: 'React Advanced Concepts', skillKey: 'react', studentId: S(3), studentName: 'Priya Nair', status: 'submitted', answers: { '0': 1, '1': 0, '2': 2, '3': 1, '4': 2, '5': 0, '6': 1, '7': 2, '8': 1, '9': 0, '10': 2, '11': 1, '12': 0, '13': 2, '14': 1 }, totalQuestions: 15, startedAt: iso(daysAgo(7)), expiresAt: iso(daysAgo(7)), scorePercent: 73, correctCount: 11, passed: true, submittedAt: iso(daysAgo(7)), timeTakenSeconds: 2100, certificateId: null, createdAt: now },
    { assessmentId: null, assessmentTitle: 'Machine Learning Basics', skillKey: 'machine_learning', studentId: S(0), studentName: 'Aarav Sharma', status: 'submitted', answers: { '0': 2, '1': 1, '2': 0, '3': 2, '4': 1, '5': 2, '6': 0, '7': 1, '8': 2, '9': 1, '10': 0, '11': 2 }, totalQuestions: 12, startedAt: iso(daysAgo(8)), expiresAt: iso(daysAgo(8)), scorePercent: 58, correctCount: 7, passed: false, submittedAt: iso(daysAgo(8)), timeTakenSeconds: 1800, certificateId: null, createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 34. STUDENT SKILLS
  // ══════════════════════════════════════════════
  await db.collection('student_skills').insertMany([
    { studentId: S(0), skillKey: 'javascript', selfRating: 75, assessmentScore: 80, lastAssessmentScore: 80, assessmentCount: 2, endorsementCount: 1, createdAt: now, updatedAt: now },
    { studentId: S(0), skillKey: 'python', selfRating: 65, assessmentScore: 0, lastAssessmentScore: 0, assessmentCount: 0, endorsementCount: 0, createdAt: now, updatedAt: now },
    { studentId: S(0), skillKey: 'sql', selfRating: 70, assessmentScore: 75, lastAssessmentScore: 75, assessmentCount: 1, endorsementCount: 0, createdAt: now, updatedAt: now },
    { studentId: S(0), skillKey: 'machine_learning', selfRating: 50, assessmentScore: 58, lastAssessmentScore: 58, assessmentCount: 1, endorsementCount: 0, createdAt: now, updatedAt: now },
    { studentId: S(1), skillKey: 'javascript', selfRating: 80, assessmentScore: 70, lastAssessmentScore: 70, assessmentCount: 1, endorsementCount: 1, createdAt: now, updatedAt: now },
    { studentId: S(1), skillKey: 'react', selfRating: 70, assessmentScore: 0, lastAssessmentScore: 0, assessmentCount: 0, endorsementCount: 0, createdAt: now, updatedAt: now },
    { studentId: S(3), skillKey: 'python', selfRating: 90, assessmentScore: 90, lastAssessmentScore: 90, assessmentCount: 1, endorsementCount: 2, createdAt: now, updatedAt: now },
    { studentId: S(3), skillKey: 'react', selfRating: 85, assessmentScore: 73, lastAssessmentScore: 73, assessmentCount: 1, endorsementCount: 1, createdAt: now, updatedAt: now },
    { studentId: S(3), skillKey: 'nodejs', selfRating: 80, assessmentScore: 0, lastAssessmentScore: 0, assessmentCount: 0, endorsementCount: 0, createdAt: now, updatedAt: now },
    { studentId: S(5), skillKey: 'javascript', selfRating: 60, assessmentScore: 40, lastAssessmentScore: 40, assessmentCount: 1, endorsementCount: 0, createdAt: now, updatedAt: now },
    { studentId: S(5), skillKey: 'java', selfRating: 55, assessmentScore: 0, lastAssessmentScore: 0, assessmentCount: 0, endorsementCount: 0, createdAt: now, updatedAt: now },
    { studentId: S(7), skillKey: 'nodejs', selfRating: 85, assessmentScore: 80, lastAssessmentScore: 80, assessmentCount: 1, endorsementCount: 1, createdAt: now, updatedAt: now },
    { studentId: S(7), skillKey: 'javascript', selfRating: 80, assessmentScore: 0, lastAssessmentScore: 0, assessmentCount: 0, endorsementCount: 0, createdAt: now, updatedAt: now },
    { studentId: S(7), skillKey: 'aws', selfRating: 70, assessmentScore: 0, lastAssessmentScore: 0, assessmentCount: 0, endorsementCount: 0, createdAt: now, updatedAt: now },
    { studentId: S(9), skillKey: 'javascript', selfRating: 70, assessmentScore: 0, lastAssessmentScore: 0, assessmentCount: 0, endorsementCount: 0, createdAt: now, updatedAt: now },
    { studentId: S(9), skillKey: 'python', selfRating: 60, assessmentScore: 0, lastAssessmentScore: 0, assessmentCount: 0, endorsementCount: 0, createdAt: now, updatedAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 35. STUDENT CERTIFICATIONS
  // ══════════════════════════════════════════════
  await db.collection('student_certifications').insertMany([
    { studentId: S(0), title: 'AWS Cloud Practitioner', issuer: 'Amazon Web Services', skillKey: 'aws', credentialId: 'AWS-CCP-2026-001', credentialUrl: 'https://aws.amazon.com/verification/001', issuedAt: dateStr(daysAgo(60)), expiresAt: dateStr(daysFromNow(305)), source: 'external', attemptId: null, scorePercent: null, createdAt: now },
    { studentId: S(3), title: 'Python for Data Science', issuer: 'Vishva ERP', skillKey: 'python', credentialId: 'VSA-PY-2026-001', credentialUrl: null, issuedAt: dateStr(daysAgo(10)), expiresAt: null, source: 'assessment', attemptId: null, scorePercent: 90, createdAt: now },
    { studentId: S(3), title: 'React Advanced Developer', issuer: 'Vishva ERP', skillKey: 'react', credentialId: 'VSA-RA-2026-001', credentialUrl: null, issuedAt: dateStr(daysAgo(7)), expiresAt: null, source: 'assessment', attemptId: null, scorePercent: 73, createdAt: now },
    { studentId: S(7), title: 'Node.js Backend Developer', issuer: 'Vishva ERP', skillKey: 'nodejs', credentialId: 'VSA-NJ-2026-001', credentialUrl: null, issuedAt: dateStr(daysAgo(6)), expiresAt: null, source: 'assessment', attemptId: null, scorePercent: 80, createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 36. STUDENT PROJECTS
  // ══════════════════════════════════════════════
  await db.collection('student_projects').insertMany([
    { studentId: S(0), title: 'E-commerce Platform', description: 'Full-stack e-commerce with React Node.js MongoDB and Razorpay.', skills: ['javascript', 'react', 'nodejs', 'mongodb'], repoUrl: 'https://github.com/aarav/ecommerce', demoUrl: 'https://aarav-ecommerce.netlify.app', createdAt: now },
    { studentId: S(0), title: 'Chat Application', description: 'Real-time chat with Socket.io and private messaging.', skills: ['javascript', 'nodejs', 'socketio'], repoUrl: 'https://github.com/aarav/chat-app', demoUrl: null, createdAt: now },
    { studentId: S(1), title: 'Task Manager', description: 'Kanban-style task manager with drag-and-drop.', skills: ['javascript', 'react', 'css'], repoUrl: 'https://github.com/isha/task-manager', demoUrl: 'https://isha-tasks.netlify.app', createdAt: now },
    { studentId: S(3), title: 'ML Stock Predictor', description: 'Stock price prediction using LSTM neural networks.', skills: ['python', 'machine_learning', 'tensorflow'], repoUrl: 'https://github.com/priya/stock-predictor', demoUrl: null, createdAt: now },
    { studentId: S(3), title: 'Portfolio Website', description: 'Personal portfolio with animations and responsive design.', skills: ['react', 'css', 'javascript'], repoUrl: 'https://github.com/priya/portfolio', demoUrl: 'https://priya-portfolio.vercel.app', createdAt: now },
    { studentId: S(5), title: 'Weather App', description: 'Weather forecast app using OpenWeatherMap API.', skills: ['javascript', 'html', 'css'], repoUrl: 'https://github.com/sneha/weather-app', demoUrl: null, createdAt: now },
    { studentId: S(7), title: 'Blog Platform', description: 'Full-stack blog with authentication and image uploads.', skills: ['nodejs', 'javascript', 'mongodb', 'react'], repoUrl: 'https://github.com/kavya/blog', demoUrl: 'https://kavya-blog.herokuapp.com', createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 37. SKILL ENDORSEMENTS
  // ══════════════════════════════════════════════
  await db.collection('skill_endorsements').insertMany([
    { studentId: S(0), skillKey: 'javascript', endorserId: F(0), endorserName: 'Dr. Meera Iyer', endorserRole: 'faculty', note: 'Excellent JavaScript skills in class projects.', createdAt: daysAgo(10) },
    { studentId: S(1), skillKey: 'javascript', endorserId: F(0), endorserName: 'Dr. Meera Iyer', endorserRole: 'faculty', note: 'Great understanding of async programming.', createdAt: daysAgo(8) },
    { studentId: S(3), skillKey: 'python', endorserId: F(0), endorserName: 'Dr. Meera Iyer', endorserRole: 'faculty', note: 'Outstanding Python proficiency.', createdAt: daysAgo(12) },
    { studentId: S(3), skillKey: 'python', endorserId: F(2), endorserName: 'Dr. Sunita Menon', endorserRole: 'faculty', note: 'Exceptional ML project using Python.', createdAt: daysAgo(5) },
    { studentId: S(3), skillKey: 'react', endorserId: F(0), endorserName: 'Dr. Meera Iyer', endorserRole: 'faculty', note: 'Strong React skills with great architecture.', createdAt: daysAgo(4) },
    { studentId: S(7), skillKey: 'nodejs', endorserId: F(2), endorserName: 'Dr. Sunita Menon', endorserRole: 'faculty', note: 'Well-structured backend projects.', createdAt: daysAgo(6) },
  ]);

  // ══════════════════════════════════════════════
  // 38. PLACEMENT DRIVES
  // ══════════════════════════════════════════════
  const drvResult = await db.collection('placement_drives').insertMany([
    { company: 'Google', role: 'Software Engineer', sector: 'Tech', packageLpa: 12, packageLabel: '₹12 LPA', location: 'Bangalore', jobType: 'full_time', description: 'SDE role on Google Cloud Platform.', minCgpa: 8.0, minAttendance: 75, maxBacklogs: 0, allowedDepartments: ['Computer Science', 'Electronics'], requiredSkills: ['javascript', 'python', 'system_design'], rounds: ['Online Assessment', 'Technical Interview 1', 'Technical Interview 2', 'HR'], deadline: dateStr(daysFromNow(15)), driveDate: dateStr(daysFromNow(30)), openings: 5, status: 'open', applicationCount: 12, createdBy: A(0), createdAt: now },
    { company: 'Microsoft', role: 'Frontend Developer', sector: 'Tech', packageLpa: 10, packageLabel: '₹10 LPA', location: 'Hyderabad', jobType: 'full_time', description: 'Frontend developer for Azure portal.', minCgpa: 7.5, minAttendance: 70, maxBacklogs: 0, allowedDepartments: ['Computer Science'], requiredSkills: ['javascript', 'react', 'typescript'], rounds: ['Online Test', 'Technical Interview', 'HR'], deadline: dateStr(daysFromNow(20)), driveDate: dateStr(daysFromNow(40)), openings: 8, status: 'open', applicationCount: 8, createdBy: A(0), createdAt: now },
    { company: 'Infosys', role: 'Systems Engineer', sector: 'IT Services', packageLpa: 3.6, packageLabel: '₹3.6 LPA', location: 'Mysore', jobType: 'full_time', description: 'Entry-level software engineer.', minCgpa: 6.0, minAttendance: 60, maxBacklogs: 2, allowedDepartments: ['Computer Science', 'Electronics', 'Mechanical'], requiredSkills: ['javascript', 'java', 'python'], rounds: ['Aptitude Test', 'Technical Interview', 'HR'], deadline: dateStr(daysFromNow(10)), driveDate: dateStr(daysFromNow(25)), openings: 30, status: 'open', applicationCount: 45, createdBy: A(0), createdAt: now },
    { company: 'Amazon', role: 'SDE-1', sector: 'Tech', packageLpa: 15, packageLabel: '₹15 LPA', location: 'Bangalore', jobType: 'full_time', description: 'SDE-1 for Amazon India team.', minCgpa: 8.5, minAttendance: 80, maxBacklogs: 0, allowedDepartments: ['Computer Science'], requiredSkills: ['java', 'python', 'system_design'], rounds: ['Online Assessment', 'Technical Interview 1', 'Technical Interview 2', 'Bar Raiser', 'HR'], deadline: dateStr(daysFromNow(25)), driveDate: dateStr(daysFromNow(45)), openings: 3, status: 'upcoming', applicationCount: 18, createdBy: A(0), createdAt: now },
    { company: 'TCS', role: 'Assistant System Engineer', sector: 'IT Services', packageLpa: 3.3, packageLabel: '₹3.3 LPA', location: 'Pune', jobType: 'full_time', description: 'Entry-level full stack developer.', minCgpa: 5.5, minAttendance: 50, maxBacklogs: 3, allowedDepartments: ['Computer Science', 'Electronics', 'Mechanical'], requiredSkills: ['javascript', 'java'], rounds: ['Online Test', 'Interview'], deadline: dateStr(daysAgo(5)), driveDate: dateStr(daysAgo(1)), openings: 50, status: 'closed', applicationCount: 80, createdBy: A(0), createdAt: now },
  ]);
  const dIds = Object.values(drvResult.insertedIds);

  // ══════════════════════════════════════════════
  // 39. PLACEMENT APPLICATIONS
  // ══════════════════════════════════════════════
  await db.collection('placement_applications').insertMany([
    { driveId: dIds[0], studentId: S(0), studentName: 'Aarav Sharma', studentEmail: 'aarav@campus.edu', department: 'Computer Science', company: 'Google', role: 'Software Engineer', packageLabel: '₹12 LPA', status: 'shortlisted', currentRound: 1, rounds: [{ name: 'Online Assessment', status: 'cleared', scheduledAt: iso(daysAgo(5)), feedback: 'Scored 85/100' }, { name: 'Technical Interview 1', status: 'cleared', scheduledAt: iso(daysAgo(2)), feedback: 'Strong DSA and system design.' }, { name: 'Technical Interview 2', status: 'pending', scheduledAt: iso(daysFromNow(5)), feedback: null }, { name: 'HR', status: 'pending', scheduledAt: null, feedback: null }], resumeUrl: null, coverNote: 'Passionate about cloud technologies.', snapshot: { cgpa: 8.7, attendance: 85, skill_readiness: 78 }, timeline: [{ event: 'Applied', at: iso(daysAgo(10)), note: null }, { event: 'OA Cleared', at: iso(daysAgo(5)), note: 'Score: 85' }, { event: 'Interview 1 Cleared', at: iso(daysAgo(2)), note: null }], offer: null, appliedAt: iso(daysAgo(10)), updatedAt: now, createdAt: now },
    { driveId: dIds[0], studentId: S(3), studentName: 'Priya Nair', studentEmail: 'priya@campus.edu', department: 'Computer Science', company: 'Google', role: 'Software Engineer', packageLabel: '₹12 LPA', status: 'shortlisted', currentRound: 2, rounds: [{ name: 'Online Assessment', status: 'cleared', scheduledAt: iso(daysAgo(5)), feedback: 'Scored 92/100' }, { name: 'Technical Interview 1', status: 'cleared', scheduledAt: iso(daysAgo(2)), feedback: 'Exceptional problem solving.' }, { name: 'Technical Interview 2', status: 'cleared', scheduledAt: iso(daysAgo(1)), feedback: 'Deep ML knowledge.' }, { name: 'HR', status: 'pending', scheduledAt: null, feedback: null }], resumeUrl: null, coverNote: 'Strong ML and Python background.', snapshot: { cgpa: 9.3, attendance: 92, skill_readiness: 88 }, timeline: [{ event: 'Applied', at: iso(daysAgo(10)), note: null }, { event: 'OA Cleared', at: iso(daysAgo(5)), note: 'Score: 92' }, { event: 'Interview 1 Cleared', at: iso(daysAgo(2)), note: null }, { event: 'Interview 2 Cleared', at: iso(daysAgo(1)), note: null }], offer: null, appliedAt: iso(daysAgo(10)), updatedAt: now, createdAt: now },
    { driveId: dIds[1], studentId: S(1), studentName: 'Isha Patel', studentEmail: 'isha@campus.edu', department: 'Computer Science', company: 'Microsoft', role: 'Frontend Developer', packageLabel: '₹10 LPA', status: 'applied', currentRound: 0, rounds: [{ name: 'Online Test', status: 'pending', scheduledAt: null, feedback: null }, { name: 'Technical Interview', status: 'pending', scheduledAt: null, feedback: null }, { name: 'HR', status: 'pending', scheduledAt: null, feedback: null }], resumeUrl: null, coverNote: 'Frontend enthusiast with React experience.', snapshot: { cgpa: 9.1, attendance: 88, skill_readiness: 72 }, timeline: [{ event: 'Applied', at: iso(daysAgo(3)), note: null }], offer: null, appliedAt: iso(daysAgo(3)), updatedAt: now, createdAt: now },
    { driveId: dIds[2], studentId: S(4), studentName: 'Ravi Kumar', studentEmail: 'ravi@campus.edu', department: 'Mechanical', company: 'Infosys', role: 'Systems Engineer', packageLabel: '₹3.6 LPA', status: 'applied', currentRound: 0, rounds: [{ name: 'Aptitude Test', status: 'pending', scheduledAt: null, feedback: null }, { name: 'Technical Interview', status: 'pending', scheduledAt: null, feedback: null }, { name: 'HR', status: 'pending', scheduledAt: null, feedback: null }], resumeUrl: null, coverNote: null, snapshot: { cgpa: 7.2, attendance: 70, skill_readiness: 40 }, timeline: [{ event: 'Applied', at: iso(daysAgo(1)), note: null }], offer: null, appliedAt: iso(daysAgo(1)), updatedAt: now, createdAt: now },
    { driveId: dIds[2], studentId: S(8), studentName: 'Rohan Das', studentEmail: 'rohan@campus.edu', department: 'Mechanical', company: 'Infosys', role: 'Systems Engineer', packageLabel: '₹3.6 LPA', status: 'rejected', currentRound: 0, rounds: [{ name: 'Aptitude Test', status: 'failed', scheduledAt: iso(daysAgo(8)), feedback: 'Below cutoff score.' }, { name: 'Technical Interview', status: 'pending', scheduledAt: null, feedback: null }, { name: 'HR', status: 'pending', scheduledAt: null, feedback: null }], resumeUrl: null, coverNote: null, snapshot: { cgpa: 6.8, attendance: 62, skill_readiness: 30 }, timeline: [{ event: 'Applied', at: iso(daysAgo(10)), note: null }, { event: 'OA Failed', at: iso(daysAgo(8)), note: 'Score: 35/100' }], offer: null, appliedAt: iso(daysAgo(10)), updatedAt: now, createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 40. MENTORS
  // ══════════════════════════════════════════════
  const mntResult = await db.collection('mentors').insertMany([
    { name: 'Priya Sharma', headline: 'Senior SDE at Google', company: 'Google', bio: '10+ years in distributed systems and cloud computing.', expertise: ['javascript', 'system_design', 'cloud'], careerTracks: ['full_stack', 'cloud_architect'], experienceYears: 12, languages: ['English', 'Hindi'], availability: ['Mon 10-12', 'Wed 2-4', 'Fri 10-12'], rating: 4.8, sessionsCompleted: 45, isActive: true, createdAt: now },
    { name: 'Rajesh Menon', headline: 'ML Engineer at Microsoft', company: 'Microsoft', bio: 'ML/AI specialist with NLP and computer vision expertise.', expertise: ['machine_learning', 'python', 'tensorflow'], careerTracks: ['data_science', 'ml_engineer'], experienceYears: 8, languages: ['English', 'Malayalam'], availability: ['Tue 3-5', 'Thu 10-12'], rating: 4.6, sessionsCompleted: 30, isActive: true, createdAt: now },
    { name: 'Ankit Gupta', headline: 'Tech Lead at Flipkart', company: 'Flipkart', bio: 'Full-stack developer with React and Node.js expertise.', expertise: ['react', 'nodejs', 'javascript', 'mongodb'], careerTracks: ['full_stack', 'tech_leadership'], experienceYears: 9, languages: ['English', 'Hindi'], availability: ['Mon 2-4', 'Wed 10-12', 'Sat 10-12'], rating: 4.9, sessionsCompleted: 55, isActive: true, createdAt: now },
    { name: 'Deepa Krishnan', headline: 'Cloud Architect at AWS', company: 'AWS', bio: 'AWS Solutions Architect Professional certified.', expertise: ['aws', 'cloud', 'devops'], careerTracks: ['cloud_architect', 'devops_engineer'], experienceYears: 11, languages: ['English', 'Tamil'], availability: ['Fri 2-4', 'Sat 2-4'], rating: 4.7, sessionsCompleted: 38, isActive: true, createdAt: now },
  ]);
  const mIds = Object.values(mntResult.insertedIds);

  // ══════════════════════════════════════════════
  // 41. MENTORSHIP CONNECTIONS
  // ══════════════════════════════════════════════
  const conResult = await db.collection('mentorship_connections').insertMany([
    { mentorId: mIds[0], mentorName: 'Priya Sharma', mentorHeadline: 'Senior SDE at Google', studentId: S(0), studentName: 'Aarav Sharma', studentEmail: 'aarav@campus.edu', status: 'active', goal: 'Prepare for Google SDE interview', message: 'Want to learn system design and DSA.', declineReason: null, focusSkills: ['javascript', 'system_design'], sessionsCount: 3, requestedAt: iso(daysAgo(30)), respondedAt: iso(daysAgo(28)), createdAt: now },
    { mentorId: mIds[1], mentorName: 'Rajesh Menon', mentorHeadline: 'ML Engineer at Microsoft', studentId: S(3), studentName: 'Priya Nair', studentEmail: 'priya@campus.edu', status: 'active', goal: 'Learn ML engineering and build portfolio', message: 'Interested in industry ML roles.', declineReason: null, focusSkills: ['machine_learning', 'python'], sessionsCount: 4, requestedAt: iso(daysAgo(25)), respondedAt: iso(daysAgo(23)), createdAt: now },
    { mentorId: mIds[2], mentorName: 'Ankit Gupta', mentorHeadline: 'Tech Lead at Flipkart', studentId: S(1), studentName: 'Isha Patel', studentEmail: 'isha@campus.edu', status: 'active', goal: 'Improve React skills', message: 'Want to learn production-grade React.', declineReason: null, focusSkills: ['react', 'javascript'], sessionsCount: 2, requestedAt: iso(daysAgo(20)), respondedAt: iso(daysAgo(18)), createdAt: now },
    { mentorId: mIds[2], mentorName: 'Ankit Gupta', mentorHeadline: 'Tech Lead at Flipkart', studentId: S(5), studentName: 'Sneha Reddy', studentEmail: 'sneha@campus.edu', status: 'pending', goal: 'Learn full-stack development', message: 'Beginner in web dev want guidance.', declineReason: null, focusSkills: ['javascript', 'react', 'nodejs'], sessionsCount: 0, requestedAt: iso(daysAgo(3)), respondedAt: null, createdAt: now },
    { mentorId: mIds[3], mentorName: 'Deepa Krishnan', mentorHeadline: 'Cloud Architect at AWS', studentId: S(7), studentName: 'Kavya Singh', studentEmail: 'kavya@campus.edu', status: 'active', goal: 'Get AWS certified', message: 'Planning to take AWS exam.', declineReason: null, focusSkills: ['aws', 'cloud'], sessionsCount: 5, requestedAt: iso(daysAgo(45)), respondedAt: iso(daysAgo(43)), createdAt: now },
  ]);
  const cIds = Object.values(conResult.insertedIds);

  // ══════════════════════════════════════════════
  // 42. MENTORSHIP SESSIONS
  // ══════════════════════════════════════════════
  await db.collection('mentorship_sessions').insertMany([
    { connectionId: cIds[0], mentorId: mIds[0], mentorName: 'Priya Sharma', studentId: S(0), studentName: 'Aarav Sharma', topic: 'System Design Basics', agenda: 'Distributed systems CAP theorem load balancing.', scheduledAt: iso(daysAgo(25)), durationMinutes: 45, meetingUrl: 'https://meet.google.com/abc-defg-hij', status: 'completed', notes: 'Covered CAP theorem.', actionItems: ['Read DDIA Chapter 5'], rating: 5, feedback: 'Excellent session!', ratedAt: iso(daysAgo(25)), completedAt: iso(daysAgo(25)), createdAt: now },
    { connectionId: cIds[0], mentorId: mIds[0], mentorName: 'Priya Sharma', studentId: S(0), studentName: 'Aarav Sharma', topic: 'DSA Problem Solving', agenda: 'Solve medium-level LeetCode problems.', scheduledAt: iso(daysAgo(18)), durationMinutes: 60, meetingUrl: 'https://meet.google.com/abc-defg-hij', status: 'completed', notes: 'Solved 3 problems.', actionItems: ['Practice 5 more array problems'], rating: 4, feedback: 'Good session.', ratedAt: iso(daysAgo(18)), completedAt: iso(daysAgo(18)), createdAt: now },
    { connectionId: cIds[0], mentorId: mIds[0], mentorName: 'Priya Sharma', studentId: S(0), studentName: 'Aarav Sharma', topic: 'Mock Interview', agenda: 'Simulate Google SDE interview.', scheduledAt: iso(daysAgo(8)), durationMinutes: 45, meetingUrl: 'https://meet.google.com/abc-defg-hij', status: 'completed', notes: 'Good performance. Improve communication.', actionItems: ['Practice explaining solutions aloud'], rating: 5, feedback: 'Very helpful mock.', ratedAt: iso(daysAgo(8)), completedAt: iso(daysAgo(8)), createdAt: now },
    { connectionId: cIds[1], mentorId: mIds[1], mentorName: 'Rajesh Menon', studentId: S(3), studentName: 'Priya Nair', topic: 'ML Project Architecture', agenda: 'How to structure ML projects for production.', scheduledAt: iso(daysAgo(20)), durationMinutes: 50, meetingUrl: 'https://meet.google.com/xyz-uvwx-rst', status: 'completed', notes: 'Covered MLOps basics.', actionItems: ['Set up MLflow'], rating: 5, feedback: 'Eye-opening session.', ratedAt: iso(daysAgo(20)), completedAt: iso(daysAgo(20)), createdAt: now },
    { connectionId: cIds[2], mentorId: mIds[2], mentorName: 'Ankit Gupta', studentId: S(1), studentName: 'Isha Patel', topic: 'React Performance', agenda: 'Memoization lazy loading and profiling.', scheduledAt: iso(daysAgo(12)), durationMinutes: 40, meetingUrl: 'https://meet.google.com/mno-pqrs-tuv', status: 'completed', notes: 'Deep dive into React.memo useMemo.', actionItems: ['Optimize task manager app'], rating: 5, feedback: 'Amazing mentor!', ratedAt: iso(daysAgo(12)), completedAt: iso(daysAgo(12)), createdAt: now },
    { connectionId: cIds[3], mentorId: mIds[3], mentorName: 'Deepa Krishnan', studentId: S(7), studentName: 'Kavya Singh', topic: 'AWS EC2 & S3', agenda: 'Hands-on with EC2 and S3.', scheduledAt: iso(daysAgo(35)), durationMinutes: 60, meetingUrl: 'https://meet.google.com/wxy-zabc-def', status: 'completed', notes: 'Set up EC2 instance and S3 bucket.', actionItems: ['Complete AWS labs'], rating: 5, feedback: 'Very practical session.', ratedAt: iso(daysAgo(35)), completedAt: iso(daysAgo(35)), createdAt: now },
    { connectionId: cIds[4], mentorId: mIds[3], mentorName: 'Deepa Krishnan', studentId: S(7), studentName: 'Kavya Singh', topic: 'AWS Certification Prep', agenda: 'Review practice exam questions.', scheduledAt: iso(daysAgo(15)), durationMinutes: 45, meetingUrl: 'https://meet.google.com/wxy-zabc-def', status: 'completed', notes: 'Reviewed IAM VPC pricing.', actionItems: ['Take 3 more practice exams'], rating: 5, feedback: 'Great guidance.', ratedAt: iso(daysAgo(15)), completedAt: iso(daysAgo(15)), createdAt: now },
    { connectionId: cIds[0], mentorId: mIds[0], mentorName: 'Priya Sharma', studentId: S(0), studentName: 'Aarav Sharma', topic: 'Behavioral Interview Prep', agenda: 'STAR method and common questions.', scheduledAt: iso(daysFromNow(5)), durationMinutes: 45, meetingUrl: 'https://meet.google.com/abc-defg-hij', status: 'scheduled', notes: null, actionItems: [], rating: null, feedback: null, ratedAt: null, completedAt: null, createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 43. MENTORSHIP GOALS
  // ══════════════════════════════════════════════
  await db.collection('mentorship_goals').insertMany([
    { studentId: S(0), connectionId: cIds[0], title: 'Clear Google SDE Interview', description: 'Prepare for Google SDE covering DSA system design and behavioral.', skillKey: 'system_design', targetDate: dateStr(daysFromNow(60)), status: 'active', progress: 45, milestones: [{ title: 'Master array/string problems', done: true }, { title: 'Learn system design fundamentals', done: true }, { title: 'Complete 50 LeetCode problems', done: false }, { title: 'Practice 3 mock interviews', done: true }, { title: 'Study behavioral questions', done: false }], createdAt: now, completedAt: null },
    { studentId: S(3), connectionId: cIds[1], title: 'Build ML Portfolio', description: 'Create 3 end-to-end ML projects.', skillKey: 'machine_learning', targetDate: dateStr(daysFromNow(45)), status: 'active', progress: 66, milestones: [{ title: 'Stock prediction with LSTM', done: true }, { title: 'NLP sentiment analysis', done: true }, { title: 'Computer vision project', done: false }, { title: 'Deploy all models to cloud', done: false }], createdAt: now, completedAt: null },
    { studentId: S(7), connectionId: cIds[4], title: 'AWS Certification', description: 'Pass AWS Solutions Architect Associate exam.', skillKey: 'aws', targetDate: dateStr(daysFromNow(30)), status: 'active', progress: 75, milestones: [{ title: 'Complete online course', done: true }, { title: 'Hands-on labs', done: true }, { title: 'Practice exams', done: true }, { title: 'Schedule and pass exam', done: false }], createdAt: now, completedAt: null },
  ]);

  // ══════════════════════════════════════════════
  // 44. LIVE SESSIONS
  // ══════════════════════════════════════════════
  const lvResult = await db.collection('live_sessions').insertMany([
    { title: 'DSA Lecture - Graph Algorithms', description: 'BFS DFS and Dijkstra algorithm.', courseId: C(0), courseName: 'Data Structures & Algorithms', hostId: F(0), hostName: 'Dr. Meera Iyer', scheduledAt: iso(daysAgo(2)), startedAt: iso(daysAgo(2)), endedAt: iso(daysAgo(2)), durationMinutes: 90, status: 'ended', meetingUrl: 'https://meet.google.com/lecture-dsa-001', recordingUrl: 'https://youtube.com/watch?v=dsa001', allowChat: true, allowQuestions: true, department: 'Computer Science', year: 3, tags: ['dsa', 'graphs'], materials: ['https://slides.com/dsa-graphs'], createdAt: now },
    { title: 'DBMS Live Practice', description: 'Hands-on SQL practice.', courseId: C(1), courseName: 'Database Management Systems', hostId: F(0), hostName: 'Dr. Meera Iyer', scheduledAt: iso(now), startedAt: iso(now), endedAt: null, durationMinutes: 60, status: 'live', meetingUrl: 'https://meet.google.com/lecture-dbms-002', recordingUrl: null, allowChat: true, allowQuestions: true, department: 'Computer Science', year: 3, tags: ['dbms', 'sql'], materials: ['https://sqlfiddle.com'], createdAt: now },
    { title: 'Guest Lecture - AI in Industry', description: 'Industry expert talks about AI applications.', courseId: null, courseName: null, hostId: F(2), hostName: 'Dr. Sunita Menon', scheduledAt: iso(daysFromNow(10)), startedAt: null, endedAt: null, durationMinutes: 120, status: 'scheduled', meetingUrl: 'https://meet.google.com/guest-ai-003', recordingUrl: null, allowChat: true, allowQuestions: true, department: 'Computer Science', year: null, tags: ['ai', 'guest'], materials: [], createdAt: now },
    { title: 'EC Lab - Digital Circuits Demo', description: 'Live demo of digital circuit simulations.', courseId: C(4), courseName: 'Digital Electronics', hostId: F(1), hostName: 'Prof. Kabir Khan', scheduledAt: iso(daysAgo(5)), startedAt: iso(daysAgo(5)), endedAt: iso(daysAgo(5)), durationMinutes: 60, status: 'ended', meetingUrl: 'https://meet.google.com/lecture-ec-004', recordingUrl: 'https://youtube.com/watch?v=ec004', allowChat: false, allowQuestions: true, department: 'Electronics', year: 3, tags: ['electronics', 'circuits'], materials: ['https://multisim.com/demo'], createdAt: now },
  ]);
  const lvIds = Object.values(lvResult.insertedIds);

  // ══════════════════════════════════════════════
  // 45. LIVE PARTICIPANTS
  // ══════════════════════════════════════════════
  await db.collection('live_participants').insertMany([
    { sessionId: lvIds[0], studentId: S(0), studentName: 'Aarav Sharma', joinedAt: iso(daysAgo(2)), leftAt: iso(daysAgo(2)), rejoinedAt: null, handRaised: false, handRaisedAt: null, attentionSeconds: 4800, present: true, createdAt: now },
    { sessionId: lvIds[0], studentId: S(1), studentName: 'Isha Patel', joinedAt: iso(daysAgo(2)), leftAt: iso(daysAgo(2)), rejoinedAt: null, handRaised: false, handRaisedAt: null, attentionSeconds: 5000, present: true, createdAt: now },
    { sessionId: lvIds[0], studentId: S(3), studentName: 'Priya Nair', joinedAt: iso(daysAgo(2)), leftAt: iso(daysAgo(2)), rejoinedAt: null, handRaised: true, handRaisedAt: iso(daysAgo(2)), attentionSeconds: 5200, present: true, createdAt: now },
    { sessionId: lvIds[0], studentId: S(5), studentName: 'Sneha Reddy', joinedAt: iso(daysAgo(2)), leftAt: iso(daysAgo(2)), rejoinedAt: null, handRaised: false, handRaisedAt: null, attentionSeconds: 3000, present: true, createdAt: now },
    { sessionId: lvIds[0], studentId: S(9), studentName: 'Nisha Joshi', joinedAt: iso(daysAgo(2)), leftAt: null, rejoinedAt: null, handRaised: false, handRaisedAt: null, attentionSeconds: 2500, present: true, createdAt: now },
    { sessionId: lvIds[1], studentId: S(0), studentName: 'Aarav Sharma', joinedAt: iso(now), leftAt: null, rejoinedAt: null, handRaised: false, handRaisedAt: null, attentionSeconds: 0, present: true, createdAt: now },
    { sessionId: lvIds[1], studentId: S(3), studentName: 'Priya Nair', joinedAt: iso(now), leftAt: null, rejoinedAt: null, handRaised: false, handRaisedAt: null, attentionSeconds: 0, present: true, createdAt: now },
    { sessionId: lvIds[1], studentId: S(7), studentName: 'Kavya Singh', joinedAt: iso(now), leftAt: null, rejoinedAt: null, handRaised: false, handRaisedAt: null, attentionSeconds: 0, present: true, createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 46. LIVE MESSAGES
  // ══════════════════════════════════════════════
  await db.collection('live_messages').insertMany([
    { sessionId: lvIds[0], text: 'Welcome everyone! Today we cover graph algorithms.', authorId: F(0), authorName: 'Dr. Meera Iyer', authorRole: 'faculty', createdAt: daysAgo(2) },
    { sessionId: lvIds[0], text: 'Can you explain BFS vs DFS again?', authorId: S(0), authorName: 'Aarav Sharma', authorRole: 'student', createdAt: daysAgo(2) },
    { sessionId: lvIds[0], text: 'BFS explores level by level using queue. DFS goes deep first using stack.', authorId: F(0), authorName: 'Dr. Meera Iyer', authorRole: 'faculty', createdAt: daysAgo(2) },
    { sessionId: lvIds[0], text: 'Thanks! That makes sense now.', authorId: S(1), authorName: 'Isha Patel', authorRole: 'student', createdAt: daysAgo(2) },
    { sessionId: lvIds[1], text: 'Lets start with SQL join problems!', authorId: F(0), authorName: 'Dr. Meera Iyer', authorRole: 'faculty', createdAt: now },
    { sessionId: lvIds[1], text: 'Ready! Can we do LEFT JOIN first?', authorId: S(3), authorName: 'Priya Nair', authorRole: 'student', createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 47. LIVE QUESTIONS
  // ══════════════════════════════════════════════
  await db.collection('live_questions').insertMany([
    { sessionId: lvIds[0], text: 'How is Dijkstra different from Bellman-Ford?', authorId: S(0), authorName: 'Aarav Sharma', anonymous: false, upvoters: [S(1), S(3)], answer: 'Dijkstra is faster but requires non-negative weights.', answeredAt: iso(daysAgo(2)), createdAt: daysAgo(2) },
    { sessionId: lvIds[0], text: 'Can we use BFS for weighted graphs?', authorId: S(1), authorName: 'Isha Patel', anonymous: false, upvoters: [S(0)], answer: 'Standard BFS does not work for weighted graphs.', answeredAt: iso(daysAgo(2)), createdAt: daysAgo(2) },
    { sessionId: lvIds[0], text: 'Is topological sort only for DAGs?', authorId: S(3), authorName: 'Priya Nair', anonymous: true, upvoters: [S(0), S(5)], answer: 'Yes, only for Directed Acyclic Graphs.', answeredAt: iso(daysAgo(2)), createdAt: daysAgo(2) },
    { sessionId: lvIds[1], text: 'What is the difference between WHERE and HAVING?', authorId: S(7), authorName: 'Kavya Singh', anonymous: false, upvoters: [], answer: null, answeredAt: null, createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 48. LIVE POLLS
  // ══════════════════════════════════════════════
  await db.collection('live_polls').insertMany([
    { sessionId: lvIds[0], question: 'Which traversal is better for shortest path in unweighted graph?', options: ['BFS', 'DFS', 'Both', 'Neither'], votes: [{ userId: S(0), optionIndex: 0, at: iso(daysAgo(2)) }, { userId: S(1), optionIndex: 0, at: iso(daysAgo(2)) }, { userId: S(3), optionIndex: 0, at: iso(daysAgo(2)) }, { userId: S(5), optionIndex: 1, at: iso(daysAgo(2)) }, { userId: S(9), optionIndex: 0, at: iso(daysAgo(2)) }], status: 'closed', createdBy: F(0), createdAt: daysAgo(2) },
    { sessionId: lvIds[1], question: 'Which SQL join is most confusing?', options: ['INNER', 'LEFT', 'RIGHT', 'FULL OUTER', 'CROSS'], votes: [{ userId: S(0), optionIndex: 3, at: iso(now) }, { userId: S(3), optionIndex: 2, at: iso(now) }, { userId: S(7), optionIndex: 4, at: iso(now) }], status: 'open', createdBy: F(0), createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 49. AI SESSIONS & MESSAGES
  // ══════════════════════════════════════════════
  const aiResult = await db.collection('ai_sessions').insertMany([
    { userId: S(0), type: 'doubt_solver', title: 'Binary Tree Doubt', createdAt: now },
    { userId: S(1), type: 'academic_advisor', title: 'Course Selection Help', createdAt: now },
    { userId: S(3), type: 'code_helper', title: 'Python Decorator Issue', createdAt: now },
    { userId: S(5), type: 'study_coach', title: 'Study Plan for Exams', createdAt: now },
    { userId: S(9), type: 'general', title: 'College Life Tips', createdAt: now },
  ]);
  const aiIds = Object.values(aiResult.insertedIds);

  await db.collection('ai_messages').insertMany([
    { sessionId: aiIds[0], role: 'user', content: 'What is the difference between a binary tree and a BST?', createdAt: now },
    { sessionId: aiIds[0], role: 'assistant', content: 'A binary tree has at most 2 children per node. A BST is a binary tree where left < parent < right.', createdAt: now },
    { sessionId: aiIds[1], role: 'user', content: 'Which courses should I take next semester?', createdAt: now },
    { sessionId: aiIds[1], role: 'assistant', content: 'Based on your interests in web development, I recommend Advanced React, Cloud Computing, and System Design.', createdAt: now },
    { sessionId: aiIds[2], role: 'user', content: 'How do Python decorators work?', createdAt: now },
    { sessionId: aiIds[2], role: 'assistant', content: 'Decorators are functions that modify other functions. Use @decorator syntax above the function definition.', createdAt: now },
    { sessionId: aiIds[3], role: 'user', content: 'Help me create a study plan for upcoming exams.', createdAt: now },
    { sessionId: aiIds[3], role: 'assistant', content: 'I will create a structured study plan. First tell me your exam dates and subjects.', createdAt: now },
    { sessionId: aiIds[4], role: 'user', content: 'Any tips for managing college life?', createdAt: now },
    { sessionId: aiIds[4], role: 'assistant', content: '1. Maintain a schedule 2. Join clubs 3. Network with seniors 4. Balance study and recreation.', createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 50. STUDY PLANS
  // ══════════════════════════════════════════════
  await db.collection('study_plans').insertMany([
    { userId: S(0), title: 'DBMS Revision Plan', startDate: dateStr(now), endDate: dateStr(daysFromNow(7)), tasks: [{ subject: 'DBMS', topic: 'ER Diagrams', date: dateStr(now), duration: '60min', completed: true }, { subject: 'DBMS', topic: 'Normalization', date: dateStr(daysFromNow(1)), duration: '90min', completed: false }, { subject: 'DBMS', topic: 'SQL Joins', date: dateStr(daysFromNow(2)), duration: '60min', completed: false }, { subject: 'DBMS', topic: 'Transactions', date: dateStr(daysFromNow(3)), duration: '90min', completed: false }], createdAt: now },
    { userId: S(3), title: 'ML Exam Prep', startDate: dateStr(now), endDate: dateStr(daysFromNow(10)), tasks: [{ subject: 'ML', topic: 'Regression', date: dateStr(now), duration: '120min', completed: true }, { subject: 'ML', topic: 'Classification', date: dateStr(daysFromNow(1)), duration: '120min', completed: true }, { subject: 'ML', topic: 'Neural Networks', date: dateStr(daysFromNow(2)), duration: '180min', completed: false }, { subject: 'ML', topic: 'Evaluation Metrics', date: dateStr(daysFromNow(3)), duration: '60min', completed: false }], createdAt: now },
    { userId: S(9), title: 'DSA Basics Plan', startDate: dateStr(now), endDate: dateStr(daysFromNow(14)), tasks: [{ subject: 'DSA', topic: 'Arrays', date: dateStr(now), duration: '60min', completed: true }, { subject: 'DSA', topic: 'Linked Lists', date: dateStr(daysFromNow(2)), duration: '90min', completed: false }, { subject: 'DSA', topic: 'Stacks & Queues', date: dateStr(daysFromNow(4)), duration: '60min', completed: false }, { subject: 'DSA', topic: 'Trees', date: dateStr(daysFromNow(6)), duration: '120min', completed: false }, { subject: 'DSA', topic: 'Graphs', date: dateStr(daysFromNow(8)), duration: '180min', completed: false }], createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 51. CHAT MESSAGES
  // ══════════════════════════════════════════════
  await db.collection('chat_messages').insertMany([
    { senderId: F(0), receiverId: S(0), content: 'Hello Aarav, please submit your assignment by Friday.', read: true, createdAt: daysAgo(1) },
    { senderId: S(0), receiverId: F(0), content: 'Sure Dr. Meera, I will submit it by Thursday.', read: true, createdAt: daysAgo(1) },
    { senderId: S(0), receiverId: S(3), content: 'Hey Priya, can you share your ML notes?', read: true, createdAt: daysAgo(2) },
    { senderId: S(3), receiverId: S(0), content: 'Sure! I will share them after class.', read: true, createdAt: daysAgo(2) },
    { senderId: S(1), receiverId: S(5), content: 'Want to study together for the DBMS quiz?', read: false, createdAt: daysAgo(1) },
    { senderId: F(2), receiverId: S(3), content: 'Priya, your ML project review is scheduled for next week.', read: true, createdAt: daysAgo(3) },
    { senderId: S(3), receiverId: F(2), content: 'Thank you Dr. Sunita. I will prepare the presentation.', read: true, createdAt: daysAgo(3) },
  ]);

  // ══════════════════════════════════════════════
  // 52. REMINDERS
  // ══════════════════════════════════════════════
  await db.collection('reminders').insertMany([
    { userId: S(0), title: 'Assignment Due', body: 'Red-Black Tree assignment due in 7 days.', date: dateStr(daysFromNow(7)), priority: 1, createdAt: now },
    { userId: S(0), title: 'Fee Payment', body: 'Tuition fee of 45000 due in 15 days.', date: dateStr(daysFromNow(15)), priority: 2, createdAt: now },
    { userId: S(1), title: 'DBMS Quiz', body: 'Quiz 1 - DBMS in 14 days.', date: dateStr(daysFromNow(14)), priority: 1, createdAt: now },
    { userId: S(3), title: 'Placement Interview', body: 'Google interview round 2 in 5 days.', date: dateStr(daysFromNow(5)), priority: 1, createdAt: now },
    { userId: S(5), title: 'Overdue Fee', body: 'Tuition fee overdue. Please pay immediately.', date: dateStr(now), priority: 0, createdAt: now },
    { userId: S(7), title: 'AWS Exam', body: 'AWS certification exam in 30 days.', date: dateStr(daysFromNow(30)), priority: 1, createdAt: now },
  ]);

  // ══════════════════════════════════════════════
  // 53. FACE PROFILES
  // ══════════════════════════════════════════════
  await db.collection('face_profiles').insertMany([
    { userId: S(0), encoding: 'mock_encoding_aarav', enrolledAt: daysAgo(180), lastVerified: daysAgo(1), verificationCount: 20, createdAt: now },
    { userId: S(1), encoding: 'mock_encoding_isha', enrolledAt: daysAgo(180), lastVerified: daysAgo(2), verificationCount: 18, createdAt: now },
    { userId: S(3), encoding: 'mock_encoding_priya', enrolledAt: daysAgo(150), lastVerified: daysAgo(1), verificationCount: 22, createdAt: now },
  ]);

  console.log('\n[Seed-All] Seeded successfully!');
  console.log('  ─────────────────────────────────');
  console.log(`  Users:              ${userResult.insertedCount}`);
  console.log(`  Courses:            ${coursesResult.insertedCount}`);
  console.log(`  Enrollments:        24`);
  console.log(`  Attendance Records: ${attRecords.length}`);
  console.log(`  Fees:               ${feesResult.insertedCount}`);
  console.log(`  Books:              ${booksResult.insertedCount}`);
  console.log(`  Live Sessions:      ${lvResult.insertedCount}`);
  console.log(`  Mentors:            ${mntResult.insertedCount}`);
  console.log(`  Placement Drives:   ${drvResult.insertedCount}`);
  console.log(`  Assessments:        8`);
  console.log('  ─────────────────────────────────');
  console.log('  Login credentials:  password123');
  console.log('  ─────────────────────────────────');

  await client.close();
  process.exit(0);
}

seed().catch(err => {
  console.error('[Seed-All] Failed:', err);
  process.exit(1);
});
