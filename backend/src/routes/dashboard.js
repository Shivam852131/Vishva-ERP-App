const express = require('express');
const { prisma } = require('../db');
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

async function buildStudentDashboard() {
  const [assignments, pendingFees, timetable] = await Promise.all([
    prisma.assignment.count({ where: { submissions: { none: { studentId: 'stu-001' } } } }),
    prisma.fee.count({ where: { status: 'pending', studentId: 'stu-001' } }),
    prisma.timetableSlot.findMany({ take: 3, include: { course: true } }),
  ]);
  return {
    attendance: 82,
    cgpa: 8.7,
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

async function buildFacultyDashboard() {
  const [courses, assignmentCount] = await Promise.all([
    prisma.course.findMany({ where: { facultyId: 'fac-001' } }),
    prisma.assignment.count(),
  ]);
  return {
    courses,
    students: 126,
    today_classes: 3,
    assignments: assignmentCount,
  };
}

async function buildParentDashboard() {
  const [child, results, fees] = await Promise.all([
    prisma.user.findUnique({ where: { id: 'stu-001' } }),
    prisma.examResult.findMany({ where: { studentId: 'stu-001' }, include: { course: true } }),
    prisma.fee.findMany({ where: { studentId: 'stu-001' } }),
  ]);
  return {
    child: serializeUser(child),
    attendance: 82,
    cgpa: 8.7,
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

router.get('/dashboard/student', async (_req, res) => res.json(await buildStudentDashboard()));
router.get('/dashboard/faculty', async (_req, res) => res.json(await buildFacultyDashboard()));
router.get('/dashboard/parent', async (_req, res) => res.json(await buildParentDashboard()));
router.get('/dashboard/admin', async (_req, res) => res.json(await buildAdminDashboard()));

router.get('/analytics/dashboard/student', async (_req, res) => {
  const attendance = await buildStudentAttendance('stu-001');
  const [issueCount, overdueCount, openGrievances] = await Promise.all([
    prisma.bookIssue.count({ where: { studentId: 'stu-001' } }),
    prisma.bookIssue.count({ where: { studentId: 'stu-001', fine: { gt: 0 } } }),
    prisma.grievance.count({ where: { status: { not: 'resolved' } } }),
  ]);
  res.json({
    attendance: 82,
    cgpa: 8.7,
    avg_marks: 84,
    books_issued: issueCount,
    overdue_books: overdueCount,
    open_grievances: openGrievances,
    attendance_by_course: attendance.by_course.map(item => ({ code: item.course_code, course: item.course_name, percentage: item.percentage })),
  });
});

router.get('/analytics/faculty', async (_req, res) => {
  const [courses, submissions, assignmentCount] = await Promise.all([
    prisma.course.findMany({ where: { facultyId: 'fac-001' } }),
    prisma.submission.count(),
    prisma.assignment.count(),
  ]);
  res.json({
    total_courses: courses.length,
    total_students: 126,
    total_assignments: assignmentCount,
    total_submissions: submissions,
    total_classes: 84,
    courses,
  });
});

router.get('/analytics/admin', async (_req, res) => {
  const base = await buildAdminDashboard();
  const [books, booksIssued, pendingFees, openGrievances] = await Promise.all([
    prisma.book.count(),
    prisma.bookIssue.count(),
    prisma.fee.count({ where: { status: 'pending' } }),
    prisma.grievance.count({ where: { status: { not: 'resolved' } } }),
  ]);
  res.json({
    ...base,
    attendance_rate: 84,
    student_faculty_ratio: 15,
    books,
    books_issued: booksIssued,
    hostel_occupants: 436,
    pending_fees: pendingFees,
    open_grievances: openGrievances,
  });
});

router.get('/reminders', async (_req, res) => {
  const reminders = await prisma.reminder.findMany({ orderBy: { priority: 'asc' } });
  res.json(reminders);
});

module.exports = { router, buildStudentAttendance };
