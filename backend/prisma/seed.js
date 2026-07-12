const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function isoDate(date) {
  return new Date(date.toISOString().slice(0, 10));
}

async function hash(password) {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log('Seeding database...');

  const [studentPass, facultyPass, parentPass, adminPass, superPass] = await Promise.all([
    hash('password123'),
    hash('password123'),
    hash('password123'),
    hash('password123'),
    hash('password123'),
  ]);

  const stu001 = await prisma.user.create({
    data: {
      id: 'stu-001',
      name: 'Aarav Sharma',
      email: 'student@campus.edu',
      passwordHash: studentPass,
      role: 'student',
      phone: '+91 98765 43210',
      college: 'Vishva Institute of Technology',
      department: 'Computer Science',
      studentCode: 'VIT-CS-2026-014',
      year: 3,
      cgpa: 8.7,
    },
  });

  const stu002 = await prisma.user.create({
    data: {
      id: 'stu-002',
      name: 'Isha Patel',
      email: 'isha@campus.edu',
      passwordHash: studentPass,
      role: 'student',
      phone: '+91 93456 78901',
      college: 'Vishva Institute of Technology',
      department: 'Computer Science',
      studentCode: 'VIT-CS-2026-018',
      year: 3,
      cgpa: 8.9,
    },
  });

  const stu003 = await prisma.user.create({
    data: {
      id: 'stu-003',
      name: 'Neel Verma',
      email: 'neel@campus.edu',
      passwordHash: studentPass,
      role: 'student',
      phone: '+91 92345 67890',
      college: 'Vishva Institute of Technology',
      department: 'Electronics',
      studentCode: 'VIT-EC-2027-022',
      year: 2,
      cgpa: 7.8,
    },
  });

  const fac001 = await prisma.user.create({
    data: {
      id: 'fac-001',
      name: 'Dr. Meera Iyer',
      email: 'faculty@campus.edu',
      passwordHash: facultyPass,
      role: 'faculty',
      phone: '+91 99887 66554',
      college: 'Vishva Institute of Technology',
      department: 'Computer Science',
    },
  });

  const fac002 = await prisma.user.create({
    data: {
      id: 'fac-002',
      name: 'Prof. Kabir Khan',
      email: 'kabir@campus.edu',
      passwordHash: facultyPass,
      role: 'faculty',
      phone: '+91 99880 11122',
      college: 'Vishva Institute of Technology',
      department: 'Electronics',
    },
  });

  const par001 = await prisma.user.create({
    data: {
      id: 'par-001',
      name: 'Rohit Sharma',
      email: 'parent@campus.edu',
      passwordHash: parentPass,
      role: 'parent',
      phone: '+91 90123 45678',
      college: 'Vishva Institute of Technology',
    },
  });
  // stu001's parentUserId points at their parent account (par001), not the other way around.
  await prisma.user.update({ where: { id: stu001.id }, data: { parentUserId: par001.id } });

  const adm001 = await prisma.user.create({
    data: {
      id: 'adm-001',
      name: 'Ananya Rao',
      email: 'admin@campus.edu',
      passwordHash: adminPass,
      role: 'college_admin',
      phone: '+91 91234 56789',
      college: 'Vishva Institute of Technology',
      department: 'Administration',
    },
  });

  await prisma.user.create({
    data: {
      id: 'sup-001',
      name: 'Vikram Sen',
      email: 'super@campus.edu',
      passwordHash: superPass,
      role: 'super_admin',
      phone: '+91 90000 11111',
      college: 'Vishva ERP Network',
      department: 'Platform Operations',
    },
  });

  await prisma.college.createMany({
    data: [
      { id: 'col-1', name: 'Vishva Institute of Technology', code: 'VIT', students: 1240, faculty: 82, admins: 9, address: 'Knowledge Park, Mumbai', contactEmail: 'hello@vit.edu' },
      { id: 'col-2', name: 'Vishva School of Management', code: 'VSM', students: 620, faculty: 41, admins: 5, address: 'Lake Road, Pune', contactEmail: 'office@vsm.edu' },
    ],
  });

  const c101 = await prisma.course.create({ data: { id: 'c-101', code: 'CS301', name: 'Data Structures', facultyId: fac001.id, credits: 4, color: '#059669' } });
  const c102 = await prisma.course.create({ data: { id: 'c-102', code: 'CS305', name: 'Database Systems', facultyId: fac001.id, credits: 4, color: '#2563EB' } });
  const c103 = await prisma.course.create({ data: { id: 'c-103', code: 'AI401', name: 'Applied Machine Learning', facultyId: fac002.id, credits: 3, color: '#7C3AED' } });
  const c104 = await prisma.course.create({ data: { id: 'c-104', code: 'EC220', name: 'Digital Electronics', facultyId: fac002.id, credits: 3, color: '#F59E0B' } });

  await prisma.courseEnrollment.createMany({
    data: [
      { courseId: c101.id, studentId: stu001.id },
      { courseId: c101.id, studentId: stu002.id },
      { courseId: c101.id, studentId: stu003.id },
      { courseId: c102.id, studentId: stu001.id },
      { courseId: c102.id, studentId: stu002.id },
      { courseId: c103.id, studentId: stu001.id },
      { courseId: c103.id, studentId: stu003.id },
      { courseId: c104.id, studentId: stu003.id },
    ],
  });

  await prisma.timetableSlot.createMany({
    data: [
      { day: 'Mon', start: '09:00', end: '10:00', courseId: c101.id, room: 'A-204' },
      { day: 'Mon', start: '10:15', end: '11:15', courseId: c102.id, room: 'Lab-3' },
      { day: 'Tue', start: '11:30', end: '12:30', courseId: c103.id, room: 'AI Studio' },
      { day: 'Wed', start: '14:00', end: '15:00', courseId: c104.id, room: 'E-112' },
      { day: 'Thu', start: '09:00', end: '10:30', courseId: c102.id, room: 'Lab-3' },
      { day: 'Fri', start: '12:00', end: '13:00', courseId: c101.id, room: 'A-204' },
    ],
  });

  const room1 = await prisma.classroom.create({
    data: {
      id: 'room-1', name: 'A-204', building: 'Academic Block A', floor: 2, capacity: 72,
      lat: 19.076, lng: 72.8777, radiusM: 35,
      beacons: [{ uuid: 'beacon-a204', major: 1, minor: 204, name: 'A204 Door' }],
      wifiBssids: ['VIT-A204-01'], wifiSsidPattern: 'VIT-Campus', active: true,
    },
  });
  const room2 = await prisma.classroom.create({
    data: {
      id: 'room-2', name: 'Lab-3', building: 'Computing Center', floor: 1, capacity: 48,
      lat: 19.077, lng: 72.878, radiusM: 25,
      beacons: [], wifiBssids: ['VIT-LAB3-01'], wifiSsidPattern: 'VIT-Lab', active: true,
    },
  });

  const sch1 = await prisma.schedule.create({
    data: {
      id: 'sch-1', collegeId: 'col-1', courseId: c101.id, facultyId: fac001.id, classroomId: room1.id,
      day: 'monday', startTime: '09:00', endTime: '10:00', attendanceMethod: 'qr',
      gracePeriodMinutes: 10, autoNotifyAbsent: true, active: true,
    },
  });
  const sch2 = await prisma.schedule.create({
    data: {
      id: 'sch-2', collegeId: 'col-1', courseId: c102.id, facultyId: fac001.id, classroomId: room2.id,
      day: 'thursday', startTime: '09:00', endTime: '10:30', attendanceMethod: 'face',
      gracePeriodMinutes: 5, autoNotifyAbsent: true, active: true,
    },
  });

  const courseCycle = [c101, c102, c103, c104];
  const attendanceRecords = Array.from({ length: 24 }, (_, index) => {
    const course = courseCycle[index % courseCycle.length];
    return {
      studentId: stu001.id,
      courseId: course.id,
      date: isoDate(daysFromNow(index - 26)),
      present: index % 7 !== 0,
      method: index % 3 === 0 ? 'qr' : index % 3 === 1 ? 'gps' : 'face',
    };
  });
  await prisma.attendanceRecord.createMany({ data: attendanceRecords });

  await prisma.examResult.createMany({
    data: [
      { studentId: stu001.id, courseId: c101.id, marks: 88, maxMarks: 100, grade: 'A', semester: 'Semester 5' },
      { studentId: stu001.id, courseId: c102.id, marks: 92, maxMarks: 100, grade: 'A+', semester: 'Semester 5' },
      { studentId: stu001.id, courseId: c103.id, marks: 81, maxMarks: 100, grade: 'A', semester: 'Semester 5' },
      { studentId: stu001.id, courseId: c104.id, marks: 74, maxMarks: 100, grade: 'B+', semester: 'Semester 4' },
    ],
  });

  await prisma.fee.createMany({
    data: [
      { id: 'fee-1', studentId: stu001.id, type: 'Tuition Fee', amount: 3850000, currency: 'INR', dueDate: daysFromNow(12), status: 'pending', semester: 'Semester 5' },
      { id: 'fee-2', studentId: stu001.id, type: 'Library Deposit', amount: 50000, currency: 'INR', dueDate: daysFromNow(-20), status: 'paid', paidAt: daysFromNow(-18), semester: 'Annual' },
      { id: 'fee-3', studentId: stu001.id, type: 'Hostel Charges', amount: 850000, currency: 'INR', dueDate: daysFromNow(24), status: 'pending', semester: 'Semester 5' },
      { id: 'fee-4', studentId: stu002.id, type: 'Tuition Fee', amount: 3650000, currency: 'INR', dueDate: daysFromNow(18), status: 'pending', semester: 'Semester 5' },
    ],
  });

  await prisma.paymentReceipt.create({
    data: {
      id: 'rcpt-1', type: 'fee', feeId: 'fee-2', amount: 50000, currency: 'INR',
      paymentId: 'pay_demo_seed', orderId: 'order_demo_seed', paidAt: daysFromNow(-18),
      status: 'paid',
    },
  });

  await prisma.notification.createMany({
    data: [
      { id: 'n-1', audience: 'all', title: 'Mid-sem timetable published', body: 'Check the Exams module for final dates and venues.', createdAt: daysFromNow(-1), readBy: [] },
      { id: 'n-2', audience: 'students', title: 'Library renewal reminder', body: 'Renew borrowed books before Friday to avoid fine.', createdAt: daysFromNow(-2), readBy: [] },
      { id: 'n-3', audience: 'all', title: 'Campus innovation fair', body: 'Project registrations close this weekend.', createdAt: daysFromNow(-4), readBy: [stu001.id] },
    ],
  });

  await prisma.reminder.createMany({
    data: [
      { id: 'r-1', type: 'attendance', priority: 0, title: 'Attendance risk in EC220', body: 'Attend the next 3 Digital Electronics classes to stay above 75%.' },
      { id: 'r-2', type: 'assignment', priority: 1, title: 'DBMS lab due tomorrow', body: 'Submit the normalization worksheet before 8 PM.' },
      { id: 'r-3', type: 'exam', priority: 2, title: 'AI quiz preparation', body: 'Revise supervised learning metrics for Thursday quiz.' },
    ],
  });

  const as1 = await prisma.assignment.create({
    data: { id: 'as-1', courseId: c102.id, title: 'Normalization Case Study', description: 'Design normalized tables for hostel allocation workflow.', dueDate: daysFromNow(1), maxMarks: 20 },
  });
  const as2 = await prisma.assignment.create({
    data: { id: 'as-2', courseId: c101.id, title: 'AVL Tree Implementation', description: 'Implement insertion, deletion and traversal operations.', dueDate: daysFromNow(5), maxMarks: 30 },
  });
  await prisma.assignment.create({
    data: { id: 'as-3', courseId: c103.id, title: 'Model Evaluation Report', description: 'Compare precision, recall, F1 and ROC-AUC on the provided dataset.', dueDate: daysFromNow(8), maxMarks: 25 },
  });
  await prisma.submission.create({
    data: { id: 'sub-1', assignmentId: as2.id, studentId: stu001.id, content: 'Submitted through ERP portal', submittedAt: daysFromNow(-1), status: 'submitted' },
  });

  await prisma.note.createMany({
    data: [
      { id: 'note-1', courseId: c102.id, subject: 'Database Systems', className: 'Year 3', title: 'SQL Joins and Indexes', type: 'pdf', url: 'https://example.com/sql.pdf', uploadedBy: 'Dr. Meera Iyer', createdAt: daysFromNow(-3), description: 'Faculty-approved revision notes covering joins, indexes, query plans, and common exam mistakes.', downloads: 128, helpfulCount: 42 },
      { id: 'note-2', courseId: c101.id, subject: 'Data Structures', className: 'Year 3', title: 'Balanced Trees Quick Guide', type: 'slides', url: 'https://example.com/trees.pdf', uploadedBy: 'Isha Patel', createdAt: daysFromNow(-5), description: 'Peer summary for AVL trees, rotations, and insertion examples with diagrams.', downloads: 96, helpfulCount: 31 },
    ],
  });

  await prisma.event.createMany({
    data: [
      { id: 'ev-1', title: 'TechnoVishva Hackathon', date: daysFromNow(9), venue: 'Innovation Hub', description: '24-hour problem solving sprint for ERP, AI and sustainability ideas.' },
      { id: 'ev-2', title: 'Alumni Leadership Talk', date: daysFromNow(15), venue: 'Auditorium', description: 'Product leaders discuss career paths and industry expectations.' },
    ],
  });

  const book1 = await prisma.book.create({ data: { id: 'book-1', title: 'Clean Architecture', author: 'Robert C. Martin', isbn: '9780134494166', category: 'Software Engineering', totalCopies: 7, shelfLocation: 'CS-A3' } });
  const book2 = await prisma.book.create({ data: { id: 'book-2', title: 'Database System Concepts', author: 'Silberschatz, Korth, Sudarshan', isbn: '9780073523323', category: 'Database', totalCopies: 4, shelfLocation: 'CS-B1' } });
  await prisma.book.create({ data: { id: 'book-3', title: 'Artificial Intelligence: A Modern Approach', author: 'Russell and Norvig', isbn: '9780134610993', category: 'AI', totalCopies: 2, shelfLocation: 'AI-C2' } });

  await prisma.bookIssue.createMany({
    data: [
      { id: 'issue-1', bookId: book2.id, studentId: stu001.id, issuedAt: daysFromNow(-7), dueDate: daysFromNow(7), fine: 0 },
      { id: 'issue-2', bookId: book1.id, studentId: stu001.id, issuedAt: daysFromNow(-22), dueDate: daysFromNow(-2), fine: 40 },
    ],
  });

  const hostel1 = await prisma.hostel.create({ data: { id: 'hostel-1', name: 'Nalanda Block', type: 'Boys', totalRooms: 120, wardenName: 'Mr. Ramesh Nair', contact: '+91 98765 00010' } });
  await prisma.hostel.create({ data: { id: 'hostel-2', name: 'Gargi Block', type: 'Girls', totalRooms: 110, wardenName: 'Ms. Kavita Menon', contact: '+91 98765 00011' } });

  await prisma.hostelAllocation.create({
    data: { id: 'alloc-1', hostelId: hostel1.id, roomNumber: 'B-214', studentId: stu001.id, allocatedAt: daysFromNow(-120), active: true },
  });

  const route1 = await prisma.transportRoute.create({
    data: {
      id: 'route-1', routeName: 'Green Line - Central City', vehicleNumber: 'VIT BUS 07',
      driverName: 'Suresh Kumar', driverPhone: '+91 99880 00001', active: true,
      stops: { create: [
        { name: 'Central Metro', time: '07:35', order: 0 },
        { name: 'River Road', time: '07:50', order: 1 },
        { name: 'Campus Gate', time: '08:15', order: 2 },
      ] },
    },
  });
  await prisma.transportRoute.create({
    data: {
      id: 'route-2', routeName: 'Blue Line - North Campus', vehicleNumber: 'VIT BUS 12',
      driverName: 'Imran Sheikh', driverPhone: '+91 99880 00002', active: true,
      stops: { create: [
        { name: 'Lake View', time: '07:20', order: 0 },
        { name: 'IT Park', time: '07:45', order: 1 },
        { name: 'Campus Gate', time: '08:10', order: 2 },
      ] },
    },
  });

  await prisma.transportEnrollment.create({
    data: { id: 'enroll-1', routeId: route1.id, studentId: stu001.id, active: true },
  });

  await prisma.grievance.createMany({
    data: [
      { id: 'gr-1', studentId: stu001.id, category: 'Facilities', subject: 'Wi-Fi coverage in Lab-3', description: 'Connectivity drops during database lab sessions.', isAnonymous: false, status: 'open', createdAt: daysFromNow(-2) },
      { id: 'gr-2', studentId: stu002.id, category: 'Academics', subject: 'Need extra doubt class', description: 'Requesting a revision session before mid-sem exams.', isAnonymous: false, status: 'in_review', createdAt: daysFromNow(-6) },
    ],
  });

  await prisma.exam.createMany({
    data: [
      { id: 'exam-1', courseId: c102.id, examType: 'Mid Semester', date: isoDate(daysFromNow(11)), startTime: '10:00', endTime: '12:00', venue: 'Hall A', maxMarks: 50 },
      { id: 'exam-2', courseId: c103.id, examType: 'Quiz 2', date: isoDate(daysFromNow(4)), startTime: '14:00', endTime: '15:00', venue: 'AI Studio', maxMarks: 20 },
    ],
  });

  await prisma.announcement.createMany({
    data: [
      { id: 'ann-1', title: 'ERP maintenance window', body: 'Attendance and payments will remain available while reports refresh overnight.', audience: 'all', createdById: adm001.id, createdAt: daysFromNow(-1) },
      { id: 'ann-2', title: 'Faculty development program', body: 'AI-assisted assessment workshop is scheduled for Friday afternoon.', audience: 'faculty', createdById: adm001.id, createdAt: daysFromNow(-5) },
    ],
  });

  await prisma.subscription.create({
    data: { active: true, plan: 'pro', status: 'active', renewsAt: daysFromNow(48), expiresAt: daysFromNow(48), seatsUsed: 2321, seatsLimit: 5000 },
  });

  await prisma.questionBankItem.createMany({
    data: [
      { id: 'qb-1', subject: 'Database Systems', unit: 'Unit 1', chapter: 'Normalization', questionText: 'Explain 3NF with an example.', questionType: 'subjective', options: [], correctAnswer: 'A relation is in 3NF when it is in 2NF and has no transitive dependency.', difficulty: 'medium', marks: 5 },
      { id: 'qb-2', subject: 'Database Systems', unit: 'Unit 2', chapter: 'SQL', questionText: 'Which clause filters grouped rows?', questionType: 'mcq', options: ['ORDER BY', 'GROUP BY', 'HAVING', 'WHERE'], correctAnswer: 'HAVING', difficulty: 'easy', marks: 1 },
      { id: 'qb-3', subject: 'Data Structures', unit: 'Unit 3', chapter: 'Trees', questionText: 'What is the balance factor of a node?', questionType: 'subjective', options: [], correctAnswer: 'The height difference between left and right subtree.', difficulty: 'medium', marks: 3 },
    ],
  });

  await prisma.generatedExam.create({
    data: { id: 'gen-1', title: 'DBMS Mid-Sem Practice Paper', subject: 'Database Systems', totalQuestions: 20, totalMarks: 50, difficulty: 'medium', createdById: fac001.id, createdAt: daysFromNow(-2), instructions: 'Answer all questions.' },
  });

  await prisma.studyPlan.create({
    data: {
      id: 'plan-1', userId: stu001.id, planType: 'study', goal: 'Raise attendance and prepare for DBMS mid-sem', createdAt: daysFromNow(-1),
      plan: {
        title: 'Balanced 7-Day Study Plan',
        tips: ['Study in 45-minute focus blocks', 'Revise weak course before sleep'],
        days: [
          {
            day: 'Mon',
            date: isoDate(new Date()).toISOString().slice(0, 10),
            focus: 'DBMS joins and indexing',
            tasks: [
              { time: '18:00', task: 'Solve 20 SQL join questions', course: 'CS305', done: false },
              { time: '20:00', task: 'Review indexing notes', course: 'CS305', done: true },
            ],
          },
        ],
      },
    },
  });

  const aiSession = await prisma.aiSession.create({
    data: { id: 'ai-chat-1', userId: stu001.id, title: 'DBMS revision', createdAt: daysFromNow(-1), updatedAt: daysFromNow(-1) },
  });
  await prisma.aiMessage.createMany({
    data: [
      { sessionId: aiSession.id, userMsg: 'Explain normalization in simple words.', aiMsg: 'Normalization is a way to organize data so that it avoids duplication and stays consistent.', createdAt: daysFromNow(-1) },
      { sessionId: aiSession.id, userMsg: 'What should I revise next?', aiMsg: 'Focus on joins, keys, and indexing because they usually connect theory and SQL practice.', createdAt: daysFromNow(-1) },
    ],
  });

  await prisma.faceProfile.create({ data: { userId: stu001.id } });

  const session1 = await prisma.attendanceSession.create({
    data: {
      id: 'sess-1', scheduleId: sch1.id, courseId: c101.id, facultyId: fac001.id, classroomName: 'A-204',
      method: 'qr', code: '482913', startedAt: new Date(), expiresAt: new Date(Date.now() + 35 * 60000),
      active: true, locationLat: room1.lat, locationLng: room1.lng, locationRadiusM: room1.radiusM,
    },
  });
  await prisma.attendanceRollEntry.createMany({
    data: [
      { sessionId: session1.id, studentId: stu001.id, checkIn: new Date(Date.now() - 14 * 60000), method: 'qr', status: 'present' },
      { sessionId: session1.id, studentId: stu002.id, checkIn: new Date(Date.now() - 11 * 60000), method: 'qr', status: 'late' },
    ],
  });

  const session2 = await prisma.attendanceSession.create({
    data: {
      id: 'sess-2', scheduleId: sch2.id, courseId: c102.id, facultyId: fac001.id, classroomName: 'Lab-3',
      method: 'face', code: '719204', startedAt: new Date(), expiresAt: new Date(Date.now() + 45 * 60000),
      active: true, locationLat: room2.lat, locationLng: room2.lng, locationRadiusM: room2.radiusM,
    },
  });
  await prisma.attendanceRollEntry.create({
    data: { sessionId: session2.id, studentId: stu001.id, checkIn: new Date(Date.now() - 8 * 60000), method: 'face', status: 'present' },
  });

  const chat1 = await prisma.chatMessage.create({
    data: { fromId: fac001.id, toId: stu001.id, message: 'Please review the DBMS lab feedback before class.', createdAt: daysFromNow(-1) },
  });
  await prisma.chatMessage.create({
    data: { fromId: stu001.id, toId: fac001.id, message: 'Sure maam, I will update the ER diagram tonight.', createdAt: daysFromNow(-1) },
  });
  void chat1;
  void par001;

  console.log('Seed complete.');
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
