const express = require('express');
const { prisma } = require('../db');
const { authUser, requireRole } = require('../auth');
const { serializeUser } = require('../utils');

const router = express.Router();

async function buildStudentAttendance(studentId) {
  const enrollments = await prisma.courseEnrollment.findMany({ where: { studentId }, include: { course: true } });
  const byCourse = await Promise.all(enrollments.map(async enrollment => {
    const course = enrollment.course;
    const records = await prisma.attendanceRecord.findMany({ where: { studentId, courseId: course.id } });
    const total = records.length || 1;
    const present = records.filter(record => record.present).length;
    const percentage = Math.round((present / total) * 100);
    return {
      course_id: course.id,
      course_name: course.name,
      course_code: course.code,
      color: course.color || '#059669',
      total,
      present,
      percentage,
    };
  }));
  const records = await prisma.attendanceRecord.findMany({ where: { studentId }, orderBy: { date: 'desc' } });
  return {
    by_course: byCourse,
    records: records.map(record => ({
      id: record.id,
      student_id: record.studentId,
      course_id: record.courseId,
      date: record.date.toISOString().slice(0, 10),
      present: record.present,
      method: record.method,
    })),
  };
}

async function buildStudentDashboard(studentId) {
  const [assignments, pendingFees, timetable] = await Promise.all([
    prisma.assignment.count({ where: { submissions: { none: { studentId } } } }),
    prisma.fee.count({ where: { status: 'pending', studentId } }),
    prisma.timetableSlot.findMany({ take: 3, include: { course: true } }),
  ]);
  const results = await prisma.examResult.findMany({ where: { studentId } });
  const avgCgpa = results.length
    ? Number((results.reduce((sum, r) => sum + (r.marks / r.maxMarks) * 10, 0) / results.length).toFixed(2))
    : null;
  const attendance = await buildStudentAttendance(studentId);
  const overallAttendance = attendance.by_course.length
    ? Math.round(attendance.by_course.reduce((sum, c) => sum + c.percentage, 0) / attendance.by_course.length)
    : 0;
  return {
    attendance: overallAttendance,
    cgpa: avgCgpa,
    pending_assignments: assignments,
    pending_fees: pendingFees,
    upcoming_classes: timetable.map(slot => ({
      id: slot.id,
      day: slot.day,
      start: slot.start,
      end: slot.end,
      course_id: slot.courseId,
      course_name: slot.course.name,
      course_code: slot.course.code,
      faculty_name: null,
      room: slot.room,
    })),
  };
}

async function buildFacultyDashboard(facultyId) {
  const [courses, assignmentCount] = await Promise.all([
    prisma.course.findMany({ where: { facultyId } }),
    prisma.assignment.count({ where: { course: { facultyId } } }),
  ]);
  const courseIds = courses.map(c => c.id);
  const students = courseIds.length
    ? await prisma.courseEnrollment.count({ where: { courseId: { in: courseIds } } })
    : 0;
  return {
    courses,
    students,
    today_classes: courses.length,
    assignments: assignmentCount,
  };
}

async function buildParentDashboard(parentId) {
  const child = await prisma.user.findFirst({ where: { parentUserId: parentId } });
  if (!child) {
    return { child: null, attendance: 0, cgpa: null, results: [], fees: [] };
  }
  const [results, fees, attendance] = await Promise.all([
    prisma.examResult.findMany({ where: { studentId: child.id }, include: { course: true } }),
    prisma.fee.findMany({ where: { studentId: child.id } }),
    buildStudentAttendance(child.id),
  ]);
  const overallAttendance = attendance.by_course.length
    ? Math.round(attendance.by_course.reduce((sum, c) => sum + c.percentage, 0) / attendance.by_course.length)
    : 0;
  const avgCgpa = results.length
    ? Number((results.reduce((sum, r) => sum + (r.marks / r.maxMarks) * 10, 0) / results.length).toFixed(2))
    : null;
  return {
    child: serializeUser(child),
    attendance: overallAttendance,
    cgpa: avgCgpa,
    results: results.map(result => ({
      id: result.id,
      course_id: result.courseId,
      course_name: result.course.name,
      course_code: result.course.code,
      marks: result.marks,
      max_marks: result.maxMarks,
      grade: result.grade,
      semester: result.semester,
    })),
    fees: fees.map(fee => ({
      id: fee.id,
      student_id: fee.studentId,
      type: fee.type,
      amount: fee.amount,
      currency: fee.currency,
      due_date: fee.dueDate.toISOString(),
      status: fee.status,
      paid_at: fee.paidAt ? fee.paidAt.toISOString() : undefined,
      semester: fee.semester,
    })),
  };
}

async function buildAdminDashboard() {
  const [students, faculty, parents, courses, colleges, pendingFees] = await Promise.all([
    prisma.user.count({ where: { role: 'student' } }),
    prisma.user.count({ where: { role: 'faculty' } }),
    prisma.user.count({ where: { role: 'parent' } }),
    prisma.course.count(),
    prisma.college.count(),
    prisma.fee.count({ where: { status: 'pending' } }),
  ]);
  return { students, faculty, parents, courses, colleges, pending_fees: pendingFees };
}

router.get('/dashboard/student', requireRole('student'), async (req, res) => {
  const user = await authUser(req);
  res.json(await buildStudentDashboard(user.id));
});
router.get('/dashboard/faculty', requireRole('faculty'), async (req, res) => {
  const user = await authUser(req);
  res.json(await buildFacultyDashboard(user.id));
});
router.get('/dashboard/parent', requireRole('parent'), async (req, res) => {
  const user = await authUser(req);
  res.json(await buildParentDashboard(user.id));
});
router.get('/dashboard/admin', requireRole('college_admin', 'super_admin'), async (_req, res) => res.json(await buildAdminDashboard()));

router.get('/analytics/dashboard/student', requireRole('student'), async (req, res) => {
  const user = await authUser(req);
  const attendance = await buildStudentAttendance(user.id);
  const results = await prisma.examResult.findMany({ where: { studentId: user.id } });
  const avgMarks = results.length ? Math.round(results.reduce((sum, r) => sum + (r.marks / r.maxMarks) * 100, 0) / results.length) : 0;
  const avgCgpa = results.length
    ? Number((results.reduce((sum, r) => sum + (r.marks / r.maxMarks) * 10, 0) / results.length).toFixed(2))
    : null;
  const overallAttendance = attendance.by_course.length
    ? Math.round(attendance.by_course.reduce((sum, c) => sum + c.percentage, 0) / attendance.by_course.length)
    : 0;
  const [issueCount, overdueCount, openGrievances] = await Promise.all([
    prisma.bookIssue.count({ where: { studentId: user.id } }),
    prisma.bookIssue.count({ where: { studentId: user.id, fine: { gt: 0 } } }),
    prisma.grievance.count({ where: { studentId: user.id, status: { not: 'resolved' } } }),
  ]);
  res.json({
    attendance: overallAttendance,
    cgpa: avgCgpa,
    avg_marks: avgMarks,
    books_issued: issueCount,
    overdue_books: overdueCount,
    open_grievances: openGrievances,
    attendance_by_course: attendance.by_course.map(item => ({ code: item.course_code, course: item.course_name, percentage: item.percentage })),
  });
});

router.get('/analytics/faculty', requireRole('faculty'), async (req, res) => {
  const user = await authUser(req);
  const [courses, submissions, assignmentCount] = await Promise.all([
    prisma.course.findMany({ where: { facultyId: user.id } }),
    prisma.submission.count({ where: { assignment: { course: { facultyId: user.id } } } }),
    prisma.assignment.count({ where: { course: { facultyId: user.id } } }),
  ]);
  const courseIds = courses.map(c => c.id);
  const totalStudents = courseIds.length
    ? await prisma.courseEnrollment.count({ where: { courseId: { in: courseIds } } })
    : 0;
  const totalClasses = courseIds.length
    ? await prisma.attendanceSession.count({ where: { courseId: { in: courseIds } } })
    : 0;
  res.json({
    total_courses: courses.length,
    total_students: totalStudents,
    total_assignments: assignmentCount,
    total_submissions: submissions,
    total_classes: totalClasses,
    courses,
  });
});

router.get('/analytics/admin', requireRole('college_admin', 'super_admin'), async (_req, res) => {
  const base = await buildAdminDashboard();
  const [books, booksIssued, pendingFees, openGrievances, hostelOccupants] = await Promise.all([
    prisma.book.count(),
    prisma.bookIssue.count(),
    prisma.fee.count({ where: { status: 'pending' } }),
    prisma.grievance.count({ where: { status: { not: 'resolved' } } }),
    prisma.hostelAllocation.count({ where: { active: true } }),
  ]);
  const [totalStudents, allRecords] = await Promise.all([
    prisma.user.count({ where: { role: 'student' } }),
    prisma.attendanceRecord.count(),
  ]);
  const presentRecords = await prisma.attendanceRecord.count({ where: { present: true } });
  res.json({
    ...base,
    attendance_rate: allRecords ? Math.round((presentRecords / allRecords) * 100) : 0,
    student_faculty_ratio: base.faculty ? Number((totalStudents / base.faculty).toFixed(1)) : 0,
    books,
    books_issued: booksIssued,
    hostel_occupants: hostelOccupants,
    pending_fees: pendingFees,
    open_grievances: openGrievances,
  });
});

router.get('/reminders', async (_req, res) => {
  const reminders = await prisma.reminder.findMany({ orderBy: { priority: 'asc' } });
  res.json(reminders);
});

module.exports = { router, buildStudentAttendance };
