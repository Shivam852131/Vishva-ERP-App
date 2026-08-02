import type {
  AiReminder,
  Announcement,
  Assignment,
  AttendanceData,
  AttendanceReport,
  AuthResp,
  AuthUser,
  ChatMessage,
  ChatUser,
  ClassSchedule,
  Classroom,
  College,
  Course,
  Event,
  Exam,
  ExamResult,
  FacultyDashboardData,
  Fee,
  Grievance,
  Hostel,
  HostelAllocation,
  LibraryBook,
  LibraryIssue,
  Note,
  Notification,
  ParentDashboardData,
  StudentDashboardData,
  TimetableSlot,
  TransportEnrollment,
  TransportRoute,
  UserRole,
} from './types';

type DemoRequest = RequestInit & { body?: BodyInit | null };

const now = new Date();
const isoToday = now.toISOString().slice(0, 10);

function daysFromNow(days: number) {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function inferRole(email = ''): UserRole {
  const key = email.toLowerCase();
  if (key.includes('super')) return 'super_admin';
  if (key.includes('admin')) return 'college_admin';
  if (key.includes('faculty') || key.includes('prof')) return 'faculty';
  if (key.includes('parent')) return 'parent';
  return 'student';
}

function userForRole(role: UserRole, email?: string, name?: string): AuthUser {
  const profiles: Record<UserRole, AuthUser> = {
    student: {
      id: 'stu-001',
      name: 'Aarav Sharma',
      email: email || 'student@campus.edu',
      role: 'student',
      phone: '+91 98765 43210',
      college: 'Vishva Institute of Technology',
      department: 'Computer Science',
      student_id: 'VIT-CS-2026-014',
      year: 3,
      cgpa: 8.7,
    },
    faculty: {
      id: 'fac-001',
      name: 'Dr. Meera Iyer',
      email: email || 'faculty@campus.edu',
      role: 'faculty',
      phone: '+91 99887 66554',
      college: 'Vishva Institute of Technology',
      department: 'Computer Science',
    },
    parent: {
      id: 'par-001',
      name: 'Rohit Sharma',
      email: email || 'parent@campus.edu',
      role: 'parent',
      phone: '+91 90123 45678',
      college: 'Vishva Institute of Technology',
    },
    college_admin: {
      id: 'adm-001',
      name: 'Ananya Rao',
      email: email || 'admin@campus.edu',
      role: 'college_admin',
      phone: '+91 91234 56789',
      college: 'Vishva Institute of Technology',
      department: 'Administration',
    },
    super_admin: {
      id: 'sup-001',
      name: 'Vikram Sen',
      email: email || 'super@campus.edu',
      role: 'super_admin',
      phone: '+91 90000 11111',
      college: 'Vishva ERP Network',
      department: 'Platform Operations',
    },
  };

  return { ...profiles[role], email: email || profiles[role].email, name: name || profiles[role].name };
}

const users: AuthUser[] = [
  userForRole('student'),
  userForRole('faculty'),
  userForRole('parent'),
  userForRole('college_admin'),
  userForRole('super_admin'),
  { id: 'fac-002', name: 'Prof. Kabir Khan', email: 'kabir@campus.edu', role: 'faculty', department: 'Electronics', college: 'Vishva Institute of Technology' },
  { id: 'stu-002', name: 'Isha Patel', email: 'isha@campus.edu', role: 'student', department: 'Computer Science', student_id: 'VIT-CS-2026-018', year: 3, cgpa: 8.9 },
  { id: 'stu-003', name: 'Neel Verma', email: 'neel@campus.edu', role: 'student', department: 'Electronics', student_id: 'VIT-EC-2027-022', year: 2, cgpa: 7.8 },
];

const courses: Course[] = [
  { id: 'c-101', code: 'CS301', name: 'Data Structures', faculty_id: 'fac-001', faculty_name: 'Dr. Meera Iyer', credits: 4, color: '#059669' },
  { id: 'c-102', code: 'CS305', name: 'Database Systems', faculty_id: 'fac-001', faculty_name: 'Dr. Meera Iyer', credits: 4, color: '#2563EB' },
  { id: 'c-103', code: 'AI401', name: 'Applied Machine Learning', faculty_id: 'fac-002', faculty_name: 'Prof. Kabir Khan', credits: 3, color: '#7C3AED' },
  { id: 'c-104', code: 'EC220', name: 'Digital Electronics', faculty_id: 'fac-002', faculty_name: 'Prof. Kabir Khan', credits: 3, color: '#F59E0B' },
];

const timetable: TimetableSlot[] = [
  { id: 'tt-1', day: 'Mon', start: '09:00', end: '10:00', course_id: 'c-101', course_name: 'Data Structures', course_code: 'CS301', faculty_name: 'Dr. Meera Iyer', room: 'A-204' },
  { id: 'tt-2', day: 'Mon', start: '10:15', end: '11:15', course_id: 'c-102', course_name: 'Database Systems', course_code: 'CS305', faculty_name: 'Dr. Meera Iyer', room: 'Lab-3' },
  { id: 'tt-3', day: 'Tue', start: '11:30', end: '12:30', course_id: 'c-103', course_name: 'Applied Machine Learning', course_code: 'AI401', faculty_name: 'Prof. Kabir Khan', room: 'AI Studio' },
  { id: 'tt-4', day: 'Wed', start: '14:00', end: '15:00', course_id: 'c-104', course_name: 'Digital Electronics', course_code: 'EC220', faculty_name: 'Prof. Kabir Khan', room: 'E-112' },
  { id: 'tt-5', day: 'Thu', start: '09:00', end: '10:30', course_id: 'c-102', course_name: 'Database Systems', course_code: 'CS305', faculty_name: 'Dr. Meera Iyer', room: 'Lab-3' },
  { id: 'tt-6', day: 'Fri', start: '12:00', end: '13:00', course_id: 'c-101', course_name: 'Data Structures', course_code: 'CS301', faculty_name: 'Dr. Meera Iyer', room: 'A-204' },
];

const attendanceData: AttendanceData = {
  by_course: [
    { course_id: 'c-101', course_name: 'Data Structures', course_code: 'CS301', color: '#059669', total: 42, present: 38, percentage: 90 },
    { course_id: 'c-102', course_name: 'Database Systems', course_code: 'CS305', color: '#2563EB', total: 40, present: 33, percentage: 83 },
    { course_id: 'c-103', course_name: 'Applied Machine Learning', course_code: 'AI401', color: '#7C3AED', total: 32, present: 24, percentage: 75 },
    { course_id: 'c-104', course_name: 'Digital Electronics', course_code: 'EC220', color: '#F59E0B', total: 36, present: 25, percentage: 69 },
  ],
  records: Array.from({ length: 24 }, (_, i) => ({
    id: `att-${i + 1}`,
    student_id: 'stu-001',
    course_id: courses[i % courses.length].id,
    date: daysFromNow(i - 26).slice(0, 10),
    present: i % 7 !== 0,
    method: i % 3 === 0 ? 'qr' : i % 3 === 1 ? 'gps' : 'face',
  })),
};

const examResults: ExamResult[] = [
  { id: 'res-1', course_id: 'c-101', course_name: 'Data Structures', course_code: 'CS301', marks: 88, max_marks: 100, grade: 'A', semester: 'Semester 5' },
  { id: 'res-2', course_id: 'c-102', course_name: 'Database Systems', course_code: 'CS305', marks: 92, max_marks: 100, grade: 'A+', semester: 'Semester 5' },
  { id: 'res-3', course_id: 'c-103', course_name: 'Applied Machine Learning', course_code: 'AI401', marks: 81, max_marks: 100, grade: 'A', semester: 'Semester 5' },
  { id: 'res-4', course_id: 'c-104', course_name: 'Digital Electronics', course_code: 'EC220', marks: 74, max_marks: 100, grade: 'B+', semester: 'Semester 4' },
];

const fees: Fee[] = [
  { id: 'fee-1', student_id: 'stu-001', type: 'Tuition Fee', amount: 3850000, currency: 'INR', due_date: daysFromNow(12), status: 'pending', semester: 'Semester 5' },
  { id: 'fee-2', student_id: 'stu-001', type: 'Library Deposit', amount: 50000, currency: 'INR', due_date: daysFromNow(-20), status: 'paid', paid_at: daysFromNow(-18), semester: 'Annual' },
  { id: 'fee-3', student_id: 'stu-001', type: 'Hostel Charges', amount: 850000, currency: 'INR', due_date: daysFromNow(24), status: 'pending', semester: 'Semester 5' },
];

const notifications: Notification[] = [
  { id: 'n-1', audience: 'all', title: 'Mid-sem timetable published', body: 'Check the Exams module for final dates and venues.', created_at: daysFromNow(-1), read: false },
  { id: 'n-2', audience: 'students', title: 'Library renewal reminder', body: 'Renew borrowed books before Friday to avoid fine.', created_at: daysFromNow(-2), read: false },
  { id: 'n-3', audience: 'all', title: 'Campus innovation fair', body: 'Project registrations close this weekend.', created_at: daysFromNow(-4), read: true },
];

const reminders: AiReminder[] = [
  { id: 'r-1', type: 'attendance', priority: 0, title: 'Attendance risk in EC220', body: 'Attend the next 3 Digital Electronics classes to stay above 75%.' },
  { id: 'r-2', type: 'assignment', priority: 1, title: 'DBMS lab due tomorrow', body: 'Submit the normalization worksheet before 8 PM.' },
  { id: 'r-3', type: 'exam', priority: 2, title: 'AI quiz preparation', body: 'Revise supervised learning metrics for Thursday quiz.' },
];

const assignments: Assignment[] = [
  { id: 'as-1', course_id: 'c-102', course_name: 'Database Systems', title: 'Normalization Case Study', description: 'Design normalized tables for hostel allocation workflow.', due_date: daysFromNow(1), max_marks: 20, submitted: false, submission: null },
  { id: 'as-2', course_id: 'c-101', course_name: 'Data Structures', title: 'AVL Tree Implementation', description: 'Implement insertion, deletion and traversal operations.', due_date: daysFromNow(5), max_marks: 30, submitted: true, submission: { id: 'sub-1', assignment_id: 'as-2', student_id: 'stu-001', content: 'Submitted through ERP portal', submitted_at: daysFromNow(-1), status: 'submitted' } },
  { id: 'as-3', course_id: 'c-103', course_name: 'Applied Machine Learning', title: 'Model Evaluation Report', description: 'Compare precision, recall, F1 and ROC-AUC on the provided dataset.', due_date: daysFromNow(8), max_marks: 25, submitted: false, submission: null },
];

const notes: Note[] = [
  { id: 'note-1', course_id: 'c-102', course_name: 'Database Systems', subject: 'Database Systems', class_name: 'Year 3', title: 'SQL Joins and Indexes', type: 'pdf', url: 'https://example.com/sql.pdf', uploaded_by: 'Dr. Meera Iyer', created_at: daysFromNow(-3), description: 'Faculty-approved revision notes covering joins, indexes, query plans, and common exam mistakes.', downloads: 128, helpful_count: 42 },
  { id: 'note-2', course_id: 'c-101', course_name: 'Data Structures', subject: 'Data Structures', class_name: 'Year 3', title: 'Balanced Trees Quick Guide', type: 'slides', url: 'https://example.com/trees.pdf', uploaded_by: 'Isha Patel', created_at: daysFromNow(-5), description: 'Peer summary for AVL trees, rotations, and insertion examples with diagrams.', downloads: 96, helpful_count: 31 },
  { id: 'note-3', course_id: 'c-103', course_name: 'Applied Machine Learning', subject: 'Applied Machine Learning', class_name: 'Year 4', title: 'Model Evaluation Cheat Sheet', type: 'notes', url: 'https://example.com/ml-evaluation.pdf', uploaded_by: 'Prof. Kabir Khan', created_at: daysFromNow(-2), description: 'Precision, recall, F1, ROC-AUC, confusion matrix examples, and when to use each metric.', downloads: 73, helpful_count: 26 },
];

const events: Event[] = [
  { id: 'ev-1', title: 'TechnoVishva Hackathon', date: daysFromNow(9), venue: 'Innovation Hub', description: '24-hour problem solving sprint for ERP, AI and sustainability ideas.' },
  { id: 'ev-2', title: 'Alumni Leadership Talk', date: daysFromNow(15), venue: 'Auditorium', description: 'Product leaders discuss career paths and industry expectations.' },
];

const books: LibraryBook[] = [
  { id: 'book-1', title: 'Clean Architecture', author: 'Robert C. Martin', isbn: '9780134494166', category: 'Software Engineering', total_copies: 7, shelf_location: 'CS-A3' },
  { id: 'book-2', title: 'Database System Concepts', author: 'Silberschatz, Korth, Sudarshan', isbn: '9780073523323', category: 'Database', total_copies: 4, shelf_location: 'CS-B1' },
  { id: 'book-3', title: 'Artificial Intelligence: A Modern Approach', author: 'Russell and Norvig', isbn: '9780134610993', category: 'AI', total_copies: 2, shelf_location: 'AI-C2' },
];

const issues: LibraryIssue[] = [
  { id: 'issue-1', book_id: 'book-2', book_title: 'Database System Concepts', student_id: 'stu-001', student_name: 'Aarav Sharma', issued_at: daysFromNow(-7), due_date: daysFromNow(7), fine: 0 },
  { id: 'issue-2', book_id: 'book-1', book_title: 'Clean Architecture', student_id: 'stu-001', student_name: 'Aarav Sharma', issued_at: daysFromNow(-22), due_date: daysFromNow(-2), fine: 40 },
];

const hostels: Hostel[] = [
  { id: 'hostel-1', name: 'Nalanda Block', type: 'Boys', total_rooms: 120, occupied: 98, warden_name: 'Mr. Ramesh Nair', contact: '+91 98765 00010', amenities: ['WiFi', 'Power Backup', 'Mess', 'Laundry', 'Hot Water', 'CCTV'], description: 'Premium boys hostel with modern facilities' },
  { id: 'hostel-2', name: 'Gargi Block', type: 'Girls', total_rooms: 110, occupied: 85, warden_name: 'Ms. Kavita Menon', contact: '+91 98765 00011', amenities: ['WiFi', 'Power Backup', 'Mess', 'Laundry', 'Hot Water', 'CCTV'], description: 'Well-maintained girls hostel with 24/7 security' },
];

const hostelAllocations: HostelAllocation[] = [
  { id: 'alloc-1', hostel_id: 'hostel-1', hostel_name: 'Nalanda Block', room_number: '302', student_id: 'stu-001', student_name: 'Aarav Sharma', student_email: 'student@campus.edu', allocated_at: daysFromNow(-30), active: true },
  { id: 'alloc-2', hostel_id: 'hostel-1', hostel_name: 'Nalanda Block', room_number: '105', student_id: 'stu-002', student_name: 'Rohan Mehta', student_email: 'rohan@campus.edu', allocated_at: daysFromNow(-15), active: true },
  { id: 'alloc-3', hostel_id: 'hostel-2', hostel_name: 'Gargi Block', room_number: '201', student_id: 'stu-003', student_name: 'Isha Patel', student_email: 'isha@campus.edu', allocated_at: daysFromNow(-20), active: true },
  { id: 'alloc-4', hostel_id: 'hostel-2', hostel_name: 'Gargi Block', room_number: '410', student_id: 'stu-004', student_name: 'Neha Singh', student_email: 'neha@campus.edu', allocated_at: daysFromNow(-45), active: false },
];

const transportRoutes: TransportRoute[] = [
  { id: 'route-1', route_name: 'Green Line - Central City', vehicle_number: 'VIT BUS 07', driver_name: 'Suresh Kumar', driver_phone: '+91 99880 00001', active: true, stops: [{ name: 'Central Metro', time: '07:35' }, { name: 'River Road', time: '07:50' }, { name: 'Campus Gate', time: '08:15' }] },
  { id: 'route-2', route_name: 'Blue Line - North Campus', vehicle_number: 'VIT BUS 12', driver_name: 'Imran Sheikh', driver_phone: '+91 99880 00002', active: true, stops: [{ name: 'Lake View', time: '07:20' }, { name: 'IT Park', time: '07:45' }, { name: 'Campus Gate', time: '08:10' }] },
];

const grievances: Grievance[] = [
  { id: 'gr-1', student_id: 'stu-001', student_name: 'Aarav Sharma', student_email: 'student@campus.edu', category: 'Facilities', subject: 'Wi-Fi coverage in Lab-3', description: 'Connectivity drops during database lab sessions.', is_anonymous: false, status: 'open', created_at: daysFromNow(-2) },
  { id: 'gr-2', student_id: 'stu-002', student_name: 'Isha Patel', student_email: 'isha@campus.edu', category: 'Academics', subject: 'Need extra doubt class', description: 'Requesting a revision session before mid-sem exams.', is_anonymous: false, status: 'in_review', created_at: daysFromNow(-6) },
];

const exams: Exam[] = [
  { id: 'exam-1', course_id: 'c-102', course_name: 'Database Systems', course_code: 'CS305', exam_type: 'Mid Semester', date: daysFromNow(11).slice(0, 10), start_time: '10:00', end_time: '12:00', venue: 'Hall A', max_marks: 50 },
  { id: 'exam-2', course_id: 'c-103', course_name: 'Applied Machine Learning', course_code: 'AI401', exam_type: 'Quiz 2', date: daysFromNow(4).slice(0, 10), start_time: '14:00', end_time: '15:00', venue: 'AI Studio', max_marks: 20 },
];

const colleges: College[] = [
  { id: 'col-1', name: 'Vishva Institute of Technology', code: 'VIT', students: 1240, faculty: 82, admins: 9 },
  { id: 'col-2', name: 'Vishva School of Management', code: 'VSM', students: 620, faculty: 41, admins: 5 },
];

const classrooms: Classroom[] = [
  { id: 'room-1', name: 'A-204', building: 'Academic Block A', floor: 2, capacity: 72, lat: 19.076, lng: 72.8777, radius_m: 35, beacons: [{ uuid: 'beacon-a204', major: 1, minor: 204, name: 'A204 Door' }], wifi_bssids: ['VIT-A204-01'], wifi_ssid_pattern: 'VIT-Campus', active: true, beacon_count: 1, wifi_count: 1, schedule_count: 2 },
  { id: 'room-2', name: 'Lab-3', building: 'Computing Center', floor: 1, capacity: 48, lat: 19.077, lng: 72.878, radius_m: 25, beacons: [], wifi_bssids: ['VIT-LAB3-01'], wifi_ssid_pattern: 'VIT-Lab', active: true, beacon_count: 0, wifi_count: 1, schedule_count: 2 },
];

const schedules: ClassSchedule[] = [
  { id: 'sch-1', college_id: 'col-1', course_id: 'c-101', course_name: 'Data Structures', course_code: 'CS301', faculty_id: 'fac-001', faculty_name: 'Dr. Meera Iyer', classroom_id: 'room-1', classroom_name: 'A-204', day: 'Mon', start_time: '09:00', end_time: '10:00', attendance_method: 'qr+geo', grace_period_minutes: 10, auto_notify_absent: true, active: true, enrolled_count: 68, classroom: { name: 'A-204', lat: 19.076, lng: 72.8777, radius_m: 35 } },
  { id: 'sch-2', college_id: 'col-1', course_id: 'c-102', course_name: 'Database Systems', course_code: 'CS305', faculty_id: 'fac-001', faculty_name: 'Dr. Meera Iyer', classroom_id: 'room-2', classroom_name: 'Lab-3', day: 'Thu', start_time: '09:00', end_time: '10:30', attendance_method: 'face', grace_period_minutes: 5, auto_notify_absent: true, active: true, enrolled_count: 52, classroom: { name: 'Lab-3', lat: 19.077, lng: 72.878, radius_m: 25 } },
];

const announcements: Announcement[] = [
  { id: 'ann-1', title: 'ERP maintenance window', body: 'Attendance and payments will remain available while reports refresh overnight.', audience: 'all', created_by: 'adm-001', created_at: daysFromNow(-1) },
  { id: 'ann-2', title: 'Faculty development program', body: 'AI-assisted assessment workshop is scheduled for Friday afternoon.', audience: 'faculty', created_by: 'adm-001', created_at: daysFromNow(-5) },
];

const planPrices: Record<string, number> = { basic: 99900, pro: 299900, enterprise: 499900 };
let subscriptionState = {
  active: true,
  plan: 'pro',
  status: 'active',
  renews_at: daysFromNow(48),
  expires_at: daysFromNow(48),
  seats_used: 2321,
  seats_limit: 5000,
};

const paymentReceipts: any[] = [
  { id: 'rcpt-1', type: 'fee', fee_id: 'fee-2', amount: 50000, currency: 'INR', payment_id: 'pay_demo_seed', order_id: 'order_demo_seed', paid_at: daysFromNow(-18), created_at: daysFromNow(-18), status: 'paid', method: 'Razorpay' },
];

const chatUsers: ChatUser[] = users
  .filter(u => ['faculty', 'student', 'college_admin'].includes(u.role))
  .map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role }));

const chatMessages: ChatMessage[] = [
  { id: 'msg-1', from_id: 'fac-001', from_name: 'Dr. Meera Iyer', to_id: 'stu-001', message: 'Please review the DBMS lab feedback before class.', created_at: daysFromNow(-1) },
  { id: 'msg-2', from_id: 'stu-001', from_name: 'Aarav Sharma', to_id: 'fac-001', message: 'Sure maam, I will update the ER diagram tonight.', created_at: daysFromNow(-1) },
];

function studentDashboard(): StudentDashboardData {
  return {
    attendance: 82,
    cgpa: 8.7,
    pending_assignments: assignments.filter(a => !a.submitted).length,
    pending_fees: fees.filter(f => f.status === 'pending').length,
    upcoming_classes: timetable.slice(0, 3),
  };
}

function facultyDashboard(): FacultyDashboardData {
  return {
    courses: courses.filter(c => c.faculty_id === 'fac-001'),
    students: 126,
    today_classes: 3,
    assignments: assignments.length,
  };
}

function parentDashboard(): ParentDashboardData {
  return {
    child: userForRole('student'),
    attendance: 82,
    cgpa: 8.7,
    results: examResults,
    fees,
  };
}

function adminDashboard() {
  return { students: 1240, faculty: 82, parents: 980, courses: courses.length, colleges: colleges.length, pending_fees: 214 };
}

function studentAnalytics() {
  return {
    attendance: 82,
    cgpa: 8.7,
    avg_marks: 84,
    books_issued: issues.length,
    overdue_books: issues.filter(i => i.fine > 0).length,
    open_grievances: grievances.filter(g => g.status !== 'resolved').length,
    attendance_by_course: attendanceData.by_course.map(c => ({ code: c.course_code, course: c.course_name, percentage: c.percentage })),
  };
}

function facultyAnalytics() {
  return {
    total_courses: 2,
    total_students: 126,
    total_assignments: assignments.length,
    total_submissions: 48,
    total_classes: 84,
    courses: courses.filter(c => c.faculty_id === 'fac-001'),
  };
}

function adminAnalytics() {
  return {
    ...adminDashboard(),
    attendance_rate: 84,
    student_faculty_ratio: 15,
    books: books.length,
    books_issued: issues.length,
    hostel_occupants: 436,
    pending_fees: 214,
    open_grievances: grievances.filter(g => g.status !== 'resolved').length,
  };
}

function attendanceReport(): AttendanceReport {
  return {
    period_days: 30,
    total_students: 1240,
    total_sessions: 214,
    overall_percentage: 84,
    by_course: attendanceData.by_course.map(c => ({
      course_id: c.course_id,
      course_name: c.course_name,
      course_code: c.course_code,
      color: c.color,
      enrolled: 68,
      total_records: c.total,
      present: c.present,
      percentage: c.percentage,
    })),
    trends: Array.from({ length: 7 }, (_, i) => ({ date: daysFromNow(i - 7).slice(0, 10), total: 420, present: 330 + i * 8, percentage: 78 + i })),
    low_attendance: [
      { student_id: 'stu-003', student_name: 'Neel Verma', student_code: 'VIT-EC-2027-022', email: 'neel@campus.edu', percentage: 62, total: 34, present: 21 },
    ],
    patterns: [
      { type: 'Friday Dip', description: 'Friday afternoon attendance is 9% lower than weekly average.', severity: 'medium' },
    ],
  };
}

function parseBody(opts: DemoRequest) {
  if (!opts.body || typeof opts.body !== 'string') return {};
  try {
    return JSON.parse(opts.body);
  } catch {
    return {};
  }
}

function ok<T>(data: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(data), 180));
}

export async function demoApi<T = any>(path: string, opts: DemoRequest = {}): Promise<T> {
  const url = new URL(path, 'https://demo.vishva.local');
  const pathname = url.pathname;
  const method = (opts.method || 'GET').toUpperCase();
  const body = parseBody(opts);

  if (pathname === '/auth/login' && method === 'POST') {
    const role = inferRole(body.email);
    return ok({ token: `demo-${role}-token`, user: userForRole(role, body.email) } as AuthResp as T);
  }

  if (pathname === '/auth/register' && method === 'POST') {
    const role = (body.role || 'student') as UserRole;
    return ok({ token: `demo-${role}-token`, user: userForRole(role, body.email, body.name) } as AuthResp as T);
  }

  if (pathname === '/auth/me') return ok(userForRole('student') as T);

  // Data for new admin pages
  const placementDrives = [
    { id: 'drv-1', company: 'TCS', role: 'Software Engineer', sector: 'IT', package_lpa: 7.2, location: 'Bangalore', job_type: 'Full-time', status: 'active', openings: 50, drive_date: daysFromNow(15), min_cgpa: 6.5, min_attendance: 75 },
    { id: 'drv-2', company: 'Infosys', role: 'Systems Engineer', sector: 'IT', package_lpa: 6.5, location: 'Pune', job_type: 'Full-time', status: 'active', openings: 80, drive_date: daysFromNow(20), min_cgpa: 6.0, min_attendance: 75 },
    { id: 'drv-3', company: 'Wipro', role: 'Project Engineer', sector: 'IT', package_lpa: 5.8, location: 'Hyderabad', job_type: 'Full-time', status: 'upcoming', openings: 40, drive_date: daysFromNow(30), min_cgpa: 5.5, min_attendance: 70 },
  ];
  const placementApps = [
    { id: 'app-1', drive_id: 'drv-1', student_id: 'stu-001', student_name: 'Aarav Sharma', company: 'TCS', role: 'Software Engineer', status: 'shortlisted', applied_at: daysFromNow(-5) },
    { id: 'app-2', drive_id: 'drv-1', student_id: 'stu-002', student_name: 'Diya Patel', company: 'TCS', role: 'Software Engineer', status: 'in_process', applied_at: daysFromNow(-3) },
    { id: 'app-3', drive_id: 'drv-2', student_id: 'stu-001', student_name: 'Aarav Sharma', company: 'Infosys', role: 'Systems Engineer', status: 'offered', applied_at: daysFromNow(-10) },
  ];
  const assessmentCatalog = [
    { id: 'assess-1', title: 'Data Structures Mid-Term', description: 'Covers arrays, linked lists, trees', skill_key: 'data_structures', category: 'CS Core', duration_minutes: 60, total_questions: 25, pass_score: 60, difficulty: 'medium', created_at: daysFromNow(-30) },
    { id: 'assess-2', title: 'System Design Challenge', description: 'Design a scalable chat system', skill_key: 'system_design', category: 'Advanced', duration_minutes: 120, total_questions: 10, pass_score: 70, difficulty: 'hard', created_at: daysFromNow(-15) },
    { id: 'assess-3', title: 'Python Basics Quiz', description: 'Fundamentals of Python programming', skill_key: 'python', category: 'Programming', duration_minutes: 30, total_questions: 20, pass_score: 50, difficulty: 'easy', created_at: daysFromNow(-7) },
  ];
  const mentorshipMentors = [
    { id: 'mnt-1', name: 'Dr. Priya Sharma', department: 'Computer Science', expertise: 'AI/ML, Deep Learning', rating: 4.8, mentees_count: 12, max_mentees: 20, bio: '15 years industry + research experience' },
    { id: 'mnt-2', name: 'Prof. Rajesh Kumar', department: 'Electronics', expertise: 'VLSI, Embedded Systems', rating: 4.5, mentees_count: 8, max_mentees: 15, bio: 'Former Qualcomm engineer' },
    { id: 'mnt-3', name: 'Ms. Anita Desai', department: 'Career Services', expertise: 'Placement Prep, Resume', rating: 4.9, mentees_count: 25, max_mentees: 30, bio: 'Helped 500+ students get placed' },
  ];
  const skillsCatalog = [
    { id: 'sk-1', key: 'javascript', name: 'JavaScript', category: 'Programming', description: 'Modern JS/ES6+' },
    { id: 'sk-2', key: 'python', name: 'Python', category: 'Programming', description: 'Python 3.x' },
    { id: 'sk-3', key: 'react', name: 'React', category: 'Frontend', description: 'React + Hooks' },
    { id: 'sk-4', key: 'nodejs', name: 'Node.js', category: 'Backend', description: 'Server-side JS' },
    { id: 'sk-5', key: 'data_structures', name: 'Data Structures', category: 'CS Core', description: 'Arrays, Trees, Graphs' },
    { id: 'sk-6', key: 'system_design', name: 'System Design', category: 'Advanced', description: 'Distributed systems' },
    { id: 'sk-7', key: 'sql', name: 'SQL', category: 'Database', description: 'PostgreSQL/MySQL' },
    { id: 'sk-8', key: 'aws', name: 'AWS', category: 'Cloud', description: 'AWS cloud services' },
  ];

  if (method !== 'GET') {
    if (pathname === '/notes') {
      const note: Note = {
        id: `note-${Date.now()}`,
        course_id: String(body.subject || body.course_name || 'general').toLowerCase().replace(/\s+/g, '-'),
        course_name: body.course_name || body.subject || 'General',
        subject: body.subject || body.course_name || 'General',
        class_name: body.class_name || 'All Classes',
        title: body.title || 'Shared note',
        type: body.type || 'notes',
        url: body.url || '',
        uploaded_by: body.uploaded_by || 'Community Member',
        created_at: new Date().toISOString(),
        description: body.description || '',
        downloads: 0,
        helpful_count: 0,
      };
      notes.unshift(note);
      return ok(note as T);
    }
    if (pathname === '/chat/send') {
      const msg: ChatMessage = {
        id: `msg-${Date.now()}`,
        from_id: 'stu-001',
        from_name: 'Aarav Sharma',
        to_id: body.to_user_id || 'fac-001',
        message: body.message || 'Message sent',
        created_at: new Date().toISOString(),
      };
      chatMessages.push(msg);
      return ok(msg as T);
    }
    if (pathname === '/announcements') {
      const ann: Announcement = {
        id: `ann-${Date.now()}`,
        title: body.title || 'Announcement',
        body: body.body || '',
        audience: body.audience || 'all',
        created_by: 'adm-001',
        created_at: new Date().toISOString(),
      };
      announcements.unshift(ann);
      return ok(ann as T);
    }
    if (pathname === '/subscription/demo-activate') {
      const plan = body.plan_id || body.plan || 'pro';
      subscriptionState = {
        ...subscriptionState,
        active: true,
        plan,
        status: 'active',
        renews_at: daysFromNow(plan === 'enterprise' ? 365 : plan === 'pro' ? 180 : 30),
        expires_at: daysFromNow(plan === 'enterprise' ? 365 : plan === 'pro' ? 180 : 30),
      };
      return ok(subscriptionState as T);
    }
    if (pathname === '/subscription/create-order') {
      const plan = body.plan_id || 'pro';
      return ok({
        demo: true,
        key_id: 'rzp_live_TAEek4gDfBI2gM',
        order_id: `order_sub_${Date.now()}`,
        amount: planPrices[plan] || planPrices.pro,
        currency: 'INR',
        receipt: `subscription_${plan}_${Date.now()}`,
        plan_id: plan,
      } as T);
    }
    if (pathname === '/fees/pay') {
      const fee = fees.find(item => item.id === body.fee_id) || fees.find(item => item.status === 'pending') || fees[0];
      return ok({
        demo: true,
        key_id: 'rzp_live_TAEek4gDfBI2gM',
        order_id: `order_fee_${Date.now()}`,
        amount: fee?.amount || body.amount || 0,
        currency: fee?.currency || 'INR',
        receipt: `fee_${body.fee_id || fee?.id || Date.now()}`,
        fee_id: body.fee_id || fee?.id,
      } as T);
    }
    if (pathname === '/payments/verify') {
      if (body.purpose === 'subscription') {
        const plan = body.plan_id || 'pro';
        subscriptionState = {
          ...subscriptionState,
          active: true,
          plan,
          status: 'active',
          renews_at: daysFromNow(plan === 'enterprise' ? 365 : plan === 'pro' ? 180 : 30),
          expires_at: daysFromNow(plan === 'enterprise' ? 365 : plan === 'pro' ? 180 : 30),
        };
        paymentReceipts.unshift({
          id: `rcpt-${Date.now()}`,
          type: 'subscription',
          amount: planPrices[plan] || planPrices.pro,
          currency: 'INR',
          payment_id: body.razorpay_payment_id || `pay_demo_${Date.now()}`,
          order_id: body.razorpay_order_id || body.order_id,
          plan_id: plan,
          status: 'paid',
          created_at: new Date().toISOString(),
        });
        return ok({ verified: true, receipt_id: paymentReceipts[0].id, subscription: subscriptionState } as T);
      }

      const fee = fees.find(item => item.id === body.fee_id);
      if (fee) {
        fee.status = 'paid';
        fee.paid_at = new Date().toISOString();
      }
      paymentReceipts.unshift({
        id: `rcpt-${Date.now()}`,
        type: 'fee',
        fee_id: body.fee_id,
        amount: fee?.amount || body.amount || 0,
        currency: fee?.currency || 'INR',
        payment_id: body.razorpay_payment_id || `pay_demo_${Date.now()}`,
        order_id: body.razorpay_order_id || body.order_id,
        status: 'paid',
        created_at: new Date().toISOString(),
      });
      return ok({ verified: true, receipt_id: paymentReceipts[0].id } as T);
    }
    if (pathname.startsWith('/fees/') && pathname.endsWith('/remind')) {
      return ok({ ok: true, message: 'Reminder sent' } as T);
    }
    if (pathname === '/fees/create') {
      const newFee: Fee = {
        id: `fee-${Date.now()}`,
        student_id: body.student_id || 'stu-001',
        type: body.type || 'Tuition Fee',
        amount: body.amount || 0,
        currency: 'INR',
        due_date: body.due_date || daysFromNow(30),
        status: 'pending',
        semester: body.semester || 'Semester 5',
      };
      fees.push(newFee);
      return ok(newFee as T);
    }
    if (pathname.startsWith('/timetable/') && method === 'PUT') {
      const id = pathname.split('/').pop();
      const idx = timetable.findIndex(t => t.id === id);
      if (idx >= 0) {
        const course = courses.find(c => c.id === body.courseId);
        timetable[idx] = {
          ...timetable[idx],
          day: body.dayOfWeek || timetable[idx].day,
          start: body.startTime || timetable[idx].start,
          end: body.endTime || timetable[idx].end,
          course_id: body.courseId || timetable[idx].course_id,
          course_name: course?.name || timetable[idx].course_name,
          course_code: course?.code || timetable[idx].course_code,
          room: body.room || timetable[idx].room,
        };
        return ok(timetable[idx] as T);
      }
    }
    if (pathname === '/timetable' && method === 'POST') {
      const course = courses.find(c => c.id === body.courseId);
      const slot: TimetableSlot = {
        id: `tt-${Date.now()}`,
        day: body.dayOfWeek || 'Mon',
        start: body.startTime || '09:00',
        end: body.endTime || '10:00',
        course_id: body.courseId || '',
        course_name: course?.name || '',
        course_code: course?.code || '',
        faculty_name: course?.faculty_name || '',
        room: body.room || '',
      };
      timetable.push(slot);
      return ok(slot as T);
    }
    if (pathname.startsWith('/timetable/') && method === 'DELETE') {
      const id = pathname.split('/').pop();
      const idx = timetable.findIndex(t => t.id === id);
      if (idx >= 0) timetable.splice(idx, 1);
      return ok({ ok: true } as T);
    }
    if (pathname.includes('/notifications/absentees')) return ok({ notifications_sent: 18, date: isoToday } as T);
    if (pathname.includes('/checkin')) return ok({ ok: true, status: 'present', checked_in_at: new Date().toISOString() } as T);
    if (pathname.includes('/close')) return ok({ ok: true, closed_at: new Date().toISOString() } as T);

    // Placement write handlers
    if (pathname.startsWith('/placement/applications/') && pathname.endsWith('/status')) {
      const appId = pathname.split('/')[3];
      const app = placementApps.find(a => a.id === appId);
      if (app) app.status = body.status || app.status;
      return ok(app as T);
    }
    if (pathname.startsWith('/placement/drives/') && method === 'DELETE') return ok({ success: true } as T);
    if (pathname === '/placement/drives' && method === 'POST') {
      const newDrive = { id: 'drv-' + Date.now(), status: 'upcoming', ...body };
      placementDrives.push(newDrive);
      return ok(newDrive as T);
    }
    if (pathname.startsWith('/placement/drives/')) {
      const driveId = pathname.split('/').pop();
      const drive = placementDrives.find(d => d.id === driveId);
      return ok(drive as T);
    }

    // Assessment write handlers
    if (pathname === '/assessments' && method === 'POST') {
      const newAssess = { id: 'assess-' + Date.now(), created_at: new Date().toISOString(), ...body };
      assessmentCatalog.push(newAssess);
      return ok(newAssess as T);
    }

    // Mentorship write handlers
    if (pathname.startsWith('/mentorship/connections/') && method === 'PATCH') {
      const connId = pathname.split('/')[3];
      return ok({ id: connId, status: 'active' } as T);
    }

    // Skills write handlers
    if (pathname === '/skills/endorse' && method === 'POST') return ok({ id: 'end-' + Date.now(), ...body } as T);
    if (pathname === '/skills/certifications' && method === 'POST') return ok({ id: 'cert-' + Date.now(), ...body } as T);
    if (pathname === '/skills/projects' && method === 'POST') return ok({ id: 'proj-' + Date.now(), ...body } as T);

    return ok({ ok: true, id: `demo-${Date.now()}` } as T);
  }

  if (pathname === '/dashboard/student') return ok(studentDashboard() as T);
  if (pathname === '/dashboard/faculty') return ok(facultyDashboard() as T);
  if (pathname === '/dashboard/parent') return ok(parentDashboard() as T);
  if (pathname === '/dashboard/admin') return ok(adminDashboard() as T);

  if (pathname === '/analytics/dashboard/student') return ok(studentAnalytics() as T);
  if (pathname === '/analytics/faculty') return ok(facultyAnalytics() as T);
  if (pathname === '/analytics/admin') return ok(adminAnalytics() as T);

  if (pathname === '/subscription/current') return ok(subscriptionState as T);
  if (pathname === '/announcements') return ok(announcements as T);
  if (pathname === '/notifications') return ok(notifications as T);
  if (pathname === '/reminders') return ok(reminders as T);
  if (pathname === '/ai/study-plans') return ok([{ id: 'plan-1', plan_type: 'weekly', goal: 'Raise attendance and prepare for DBMS mid-sem', created_at: daysFromNow(-1), plan: { title: 'Balanced 7-Day Study Plan', tips: ['Study in 45-minute focus blocks', 'Revise weak course before sleep'], days: [{ day: 'Mon', date: isoToday, focus: 'DBMS joins and indexing', tasks: [{ time: '18:00', task: 'Solve 20 SQL join questions', course: 'CS305', done: false }] }] } }] as T);
  if (pathname === '/ai/sessions') return ok([{ id: 'ai-chat-1', title: 'DBMS revision', created_at: daysFromNow(-1), updated_at: daysFromNow(-1) }] as T);

  if (pathname === '/courses') return ok(courses as T);
  if (pathname === '/timetable') return ok(timetable as T);
  if (pathname === '/assignments') return ok(assignments as T);
  if (pathname === '/notes') return ok(notes as T);
  if (pathname === '/events') return ok(events as T);
  if (pathname === '/exams') return ok(exams as T);
  if (pathname === '/exams/generated') return ok([{ id: 'gen-1', title: 'DBMS Mid-Sem Practice Paper', subject: 'Database Systems', difficulty: 'medium', marks: 50, duration_minutes: 120, created_at: daysFromNow(-2), questions: [] }] as T);
  if (pathname === '/question-bank') return ok([{ id: 'qb-1', subject: 'Database Systems', topic: 'Normalization', difficulty: 'medium', marks: 5, question: 'Explain 3NF with an example.', answer: 'A relation is in 3NF when it is in 2NF and has no transitive dependency.' }] as T);
  if (pathname === '/question-bank/subjects') return ok(['Database Systems', 'Data Structures', 'Applied Machine Learning'] as T);
  if (pathname === '/question-bank/stats') return ok({ total: 86, subjects: 3, easy: 28, medium: 42, hard: 16 } as T);

  if (pathname === '/attendance/me') return ok(attendanceData as T);
  if (pathname === '/attendance/sessions/mine') return ok([{ id: 'sess-1', course_id: 'c-101', course_name: 'Data Structures', started_at: daysFromNow(0), active: true, present_count: 54, total_students: 68 }] as T);
  if (pathname.startsWith('/attendance/sessions/')) return ok({ id: pathname.split('/').pop(), course_name: 'Data Structures', active: true, present_count: 54, total_students: 68, students: [] } as T);
  if (pathname === '/admin/attendance/live') return ok({ total_enrolled: 120, total_present: 98, active_classes: [{ schedule: schedules[0], session_id: 'sess-1', enrolled: 68, checked_in: 54, percentage: 79 }, { schedule: schedules[1], session_id: 'sess-2', enrolled: 52, checked_in: 44, percentage: 85 }] } as T);
  if (pathname === '/admin/attendance/daily') return ok({ date: isoToday, total_sessions: 6, present: 418, absent: 72, percentage: 85 } as T);
  if (pathname === '/admin/attendance/reports') return ok(attendanceReport() as T);
  if (pathname === '/admin/classrooms') return ok(classrooms as T);
  if (pathname === '/admin/schedules') return ok(schedules as T);

  if (pathname === '/fees/me' || pathname === '/fees/my') return ok(fees as T);
  if (pathname === '/fees/all') return ok(fees as T);
  if (pathname === '/attendance/daily') return ok({ date: isoToday, total_sessions: 6, present: 418, absent: 72, percentage: 85 } as T);
  if (pathname === '/attendance/reports') return ok(attendanceReport() as T);
  if (pathname === '/payments/receipts') return ok(paymentReceipts as T);
  if (pathname === '/results/me') return ok(examResults as T);

  if (pathname === '/library/books') return ok(books as T);
  if (pathname === '/library/issues') return ok(issues as T);
  if (pathname === '/hostels') return ok(hostels as T);
  if (pathname === '/hostel/stats') return ok({
    total_hostels: hostels.length,
    total_rooms: hostels.reduce((s, h) => s + h.total_rooms, 0),
    total_occupied: hostels.reduce((s, h) => s + (h.occupied || 0), 0),
    occupancy_rate: Math.round(hostels.reduce((s, h) => s + (h.occupied || 0), 0) / hostels.reduce((s, h) => s + h.total_rooms, 0) * 100),
    active_allocations: hostelAllocations.filter(a => a.active).length,
    boys_hostels: hostels.filter(h => h.type === 'Boys').length,
    girls_hostels: hostels.filter(h => h.type === 'Girls').length,
    boys_occupied: hostels.filter(h => h.type === 'Boys').reduce((s, h) => s + (h.occupied || 0), 0),
    girls_occupied: hostels.filter(h => h.type === 'Girls').reduce((s, h) => s + (h.occupied || 0), 0),
  } as T);
  if (pathname === '/hostel/allocations') return ok(hostelAllocations as T);
  if (pathname === '/transport/routes') return ok(transportRoutes as T);
  if (pathname === '/transport/my-route') return ok({ id: 'enroll-1', route_id: 'route-1', route_name: 'Green Line - Central City', vehicle_number: 'VIT BUS 07', driver_name: 'Suresh Kumar', driver_phone: '+91 99880 00001', stops: [{ name: 'Central Metro', time: '07:35' }, { name: 'River Road', time: '07:50' }, { name: 'Campus Gate', time: '08:15' }], student_id: 'stu-001', student_name: 'Aarav Sharma', active: true } as TransportEnrollment as T);
  if (pathname === '/grievances') return ok(grievances as T);
  if (pathname === '/colleges') return ok(colleges as T);

  if (pathname === '/admin/users') {
    const role = url.searchParams.get('role');
    return ok(users.filter(u => !role || u.role === role) as T);
  }
  if (pathname === '/chat/users') return ok(chatUsers as T);
  if (pathname.startsWith('/chat/')) {
    const otherId = pathname.split('/').pop();
    return ok(chatMessages.filter(m => m.from_id === otherId || m.to_id === otherId) as T);
  }

  // Career Hub
  if (pathname === '/career/dashboard') return ok({
    readiness: { skills: 72, assessments: 65, applications: 45, portfolio: 55, mentorship: 80 },
    skill_gaps: [{ skill: 'System Design', gap: 35, priority: 'high' }, { skill: 'Cloud Computing', gap: 25, priority: 'medium' }],
    top_mentors: [{ id: 'mnt-1', name: 'Dr. Priya Sharma', expertise: 'AI/ML', rating: 4.8 }],
    recommendations: ['Complete System Design assessment', 'Apply to 2 open drives', 'Connect with a mentor'],
  } as T);

  if (pathname === '/placement/drives') return ok(placementDrives as T);
  if (pathname === '/placement/applications') return ok(placementApps as T);
  if (pathname === '/placement/stats') return ok({
    total_drives: 3, active_drives: 2, total_applications: 3, selected: 1, offered: 1, avg_package: 6.5,
    top_companies: [{ name: 'TCS', count: 2 }, { name: 'Infosys', count: 1 }],
    by_status: { applied: 1, shortlisted: 1, in_process: 1, offered: 1, rejected: 0 },
  } as T);

  // Assessments (data declared above)
  if (pathname === '/assessments') return ok(assessmentCatalog as T);
  if (pathname === '/assessments/history') return ok([
    { id: 'h-1', assessment_id: 'assess-1', student_id: 'stu-001', score: 82, total: 100, passed: true, taken_at: daysFromNow(-5) },
    { id: 'h-2', assessment_id: 'assess-3', student_id: 'stu-001', score: 45, total: 100, passed: true, taken_at: daysFromNow(-2) },
  ] as T);
  if (pathname === '/assessments/leaderboard') return ok([
    { student_id: 'stu-001', name: 'Aarav Sharma', total_score: 227, assessments_taken: 2, avg_score: 82 },
    { student_id: 'stu-002', name: 'Diya Patel', total_score: 195, assessments_taken: 2, avg_score: 78 },
    { student_id: 'stu-003', name: 'Rohan Gupta', total_score: 180, assessments_taken: 1, avg_score: 75 },
  ] as T);

  // Mentorship (data declared above)
  if (pathname === '/mentorship/mentors') return ok(mentorshipMentors as T);
  if (pathname === '/mentorship/connections') return ok([
    { id: 'conn-1', mentor_id: 'mnt-1', student_id: 'stu-001', student_name: 'Aarav Sharma', mentor_name: 'Dr. Priya Sharma', status: 'active', connected_at: daysFromNow(-20), goal: 'Prepare for ML roles' },
    { id: 'conn-2', mentor_id: 'mnt-3', student_id: 'stu-002', student_name: 'Diya Patel', mentor_name: 'Ms. Anita Desai', status: 'pending', connected_at: daysFromNow(-3), goal: 'Resume review' },
  ] as T);
  if (pathname === '/mentorship/sessions') return ok([
    { id: 'sess-m1', connection_id: 'conn-1', mentor_id: 'mnt-1', student_id: 'stu-001', title: 'ML Project Review', scheduled_at: daysFromNow(2), duration_minutes: 60, status: 'scheduled' },
    { id: 'sess-m2', connection_id: 'conn-1', mentor_id: 'mnt-1', student_id: 'stu-001', title: 'Intro Meeting', scheduled_at: daysFromNow(-10), duration_minutes: 30, status: 'completed', notes: 'Discussed career goals' },
  ] as T);
  if (pathname === '/mentorship/goals') return ok([
    { id: 'goal-1', connection_id: 'conn-1', title: 'Complete ML certification', target_date: daysFromNow(60), progress: 35, status: 'in_progress' },
    { id: 'goal-2', connection_id: 'conn-1', title: 'Build 2 portfolio projects', target_date: daysFromNow(90), progress: 10, status: 'in_progress' },
  ] as T);
  if (pathname === '/mentorship/overview') return ok({
    total_mentors: 3, active_connections: 1, pending_connections: 1, completed_sessions: 1,
    avg_rating: 4.7, goals_in_progress: 2, goals_completed: 0,
  } as T);

  // Skills (data declared above)
  if (pathname === '/skills/catalog') return ok(skillsCatalog as T);
  if (pathname === '/skills/profile') return ok({
    student_id: 'stu-001', skills: [
      { skill_key: 'javascript', level: 'advanced', score: 85, endorsements: 3 },
      { skill_key: 'python', level: 'intermediate', score: 70, endorsements: 1 },
      { skill_key: 'react', level: 'advanced', score: 80, endorsements: 2 },
      { skill_key: 'data_structures', level: 'intermediate', score: 65, endorsements: 0 },
    ],
    certifications: [{ id: 'cert-1', title: 'AWS Cloud Practitioner', issuer: 'Amazon', credential_id: 'AWS-CP-123', issued_at: daysFromNow(-90) }],
    projects: [{ id: 'proj-1', title: 'E-Commerce App', description: 'Full-stack React + Node.js', url: 'https://github.com/demo/ecommerce', skills_used: ['javascript', 'react', 'nodejs', 'sql'] }],
    endorsements: [{ id: 'end-1', skill_key: 'javascript', endorsed_by: 'Dr. Priya Sharma', note: 'Strong JS fundamentals', created_at: daysFromNow(-10) }],
  } as T);
  if (pathname === '/skills/career-matches') return ok([
    { role: 'Full Stack Developer', match_pct: 78, matching_skills: ['javascript', 'react', 'nodejs', 'sql'], missing_skills: ['aws', 'system_design'] },
    { role: 'Frontend Developer', match_pct: 85, matching_skills: ['javascript', 'react'], missing_skills: ['typescript'] },
    { role: 'Backend Developer', match_pct: 62, matching_skills: ['nodejs', 'sql'], missing_skills: ['aws', 'system_design', 'python'] },
  ] as T);

  return ok([] as T);
}
