const express = require('express');
const { getDB, oid } = require('../db');
const { authUser, requireRole } = require('../auth');
const { serializeUser, sendError, nowIso } = require('../utils');

const router = express.Router();

async function buildStudentAttendance(studentId) {
  const db = getDB();
  const uid = oid(studentId);
  const filter = uid ? { $or: [{ studentId: uid }, { studentId: studentId }] } : { studentId: studentId };
  const records = await db.collection('attendance_records').find(filter).toArray();
  const total = records.length || 0;
  const present = records.filter(r => r.status === 'present').length;
  const rate = total ? Math.round((present / total) * 100) : 0;
  return { rate, total, present };
}

async function buildStudentDashboard(studentId) {
  const db = getDB();
  const sid = oid(studentId);

  const enrollments = await db.collection('course_enrollments').find({ studentId: sid }).toArray();
  const courseIds = enrollments.map(e => e.courseId);

  const courses = courseIds.length
    ? await db.collection('courses').find({ _id: { $in: courseIds } }).toArray()
    : [];

  const attendance = await buildStudentAttendance(studentId);

  const submittedAssignmentIds = (
    await db.collection('submissions').find({ $or: [{ studentId: sid }, { studentId: studentId }] }).toArray()
  ).map(s => s.assignmentId);

  const pendingAssignments = courseIds.length
    ? await db.collection('assignments')
        .find({
          courseId: { $in: courseIds },
          _id: { $nin: submittedAssignmentIds },
        })
        .toArray()
    : [];

  const pendingFees = await db.collection('fees')
    .find({ $or: [{ userId: sid }, { userId: studentId }], status: { $ne: 'paid' } })
    .toArray();

  const upcomingClasses = courseIds.length
    ? await db.collection('timetable_slots').find({ $or: [{ courseId: { $in: courseIds } }, { courseId: { $in: courseIds.map(String) } }] }).toArray()
    : [];

  const results = await db.collection('exam_results').find({ $or: [{ studentId: sid }, { studentId: studentId }] }).toArray();
  const cgpa = results.length
    ? Number((results.reduce((sum, r) => sum + (r.marks || 0), 0) / results.length).toFixed(2))
    : null;

  const faceProfile = await db.collection('face_profiles').findOne({ userId: sid });

  return {
    attendance: attendance.rate,
    cgpa,
    face_enrolled: !!faceProfile,
    pending_assignments: pendingAssignments.length,
    pending_fees: pendingFees.length,
    upcoming_classes: upcomingClasses.map(s => ({
      id: String(s._id),
      day: s.dayOfWeek,
      start: s.startTime,
      end: s.endTime,
      course_id: String(s.courseId),
      room: s.room,
    })),
    courses: courses.map(c => ({
      id: String(c._id),
      code: c.code,
      name: c.name,
      credits: c.credits,
    })),
  };
}

async function buildFacultyDashboard(facultyId) {
  const db = getDB();
  const fid = oid(facultyId);

  const courses = await db.collection('courses').find({ $or: [{ facultyId: fid }, { facultyId: facultyId }] }).toArray();
  const courseIds = courses.map(c => c._id);

  const totalStudents = courseIds.length
    ? await db.collection('course_enrollments').countDocuments({ $or: [{ courseId: { $in: courseIds } }, { courseId: { $in: courseIds.map(String) } }] })
    : 0;

  const assignments = courseIds.length
    ? await db.collection('assignments').find({ courseId: { $in: courseIds } }).toArray()
    : [];

  return {
    courses: courses.map(c => ({
      id: String(c._id),
      code: c.code,
      name: c.name,
      credits: c.credits,
    })),
    total_students: totalStudents,
    assignments: assignments.length,
  };
}

async function buildParentDashboard(parentId) {
  const db = getDB();
  const pid = oid(parentId);

  const children = await db.collection('users').find({ parentId: pid }).toArray();
  if (!children.length) return { children: [] };

  const results = [];
  for (const child of children) {
    const cid = child._id;
    const attendance = await buildStudentAttendance(cid);

    const enrollments = await db.collection('course_enrollments').find({ studentId: cid }).toArray();
    const courseIds = enrollments.map(e => e.courseId);

    const examResults = courseIds.length
      ? await db.collection('exam_results')
          .find({ studentId: cid, courseId: { $in: courseIds } })
          .toArray()
      : [];

    const fees = await db.collection('fees').find({ userId: cid }).toArray();

    const cgpa = examResults.length
      ? Number((examResults.reduce((sum, r) => sum + (r.marks || 0), 0) / examResults.length).toFixed(2))
      : null;

    results.push({
      user: serializeUser(child),
      attendance: attendance.rate,
      cgpa,
      results: examResults.map(r => ({
        id: String(r._id),
        course_id: String(r.courseId),
        marks: r.marks,
        grade: r.grade,
        semester: r.semester,
      })),
      fees: fees.map(f => ({
        id: String(f._id),
        type: f.type,
        amount: f.amount,
        due_date: f.dueDate,
        status: f.status,
        semester: f.semester,
      })),
    });
  }

  return { children: results };
}

async function buildAdminDashboard() {
  const db = getDB();

  const [students, faculty, parents, courses, colleges, pendingFees] = await Promise.all([
    db.collection('users').countDocuments({ role: 'student' }),
    db.collection('users').countDocuments({ role: 'faculty' }),
    db.collection('users').countDocuments({ role: 'parent' }),
    db.collection('courses').countDocuments(),
    db.collection('colleges').countDocuments(),
    db.collection('fees').countDocuments({ status: { $ne: 'paid' } }),
  ]);

  return {
    students,
    faculty,
    parents,
    courses,
    colleges,
    pending_fees: pendingFees,
  };
}

router.get('/dashboard/student', requireRole('student'), async (req, res) => {
  try {
    const user = await authUser(req);
    const data = await buildStudentDashboard(String(user._id));
    res.json(data);
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.get('/dashboard/faculty', requireRole('faculty'), async (req, res) => {
  try {
    const user = await authUser(req);
    const data = await buildFacultyDashboard(String(user._id));
    res.json(data);
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.get('/dashboard/parent', requireRole('parent'), async (req, res) => {
  try {
    const user = await authUser(req);
    const data = await buildParentDashboard(String(user._id));
    res.json(data);
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.get('/dashboard/admin', requireRole('college_admin', 'super_admin'), async (_req, res) => {
  try {
    const data = await buildAdminDashboard();
    res.json(data);
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.get('/analytics/student', requireRole('student'), async (req, res) => {
  try {
    const user = await authUser(req);
    const db = getDB();
    const sid = String(user._id);

    const attendance = await buildStudentAttendance(sid);

    const enrollments = await db.collection('course_enrollments').find({ studentId: oid(sid) }).toArray();
    const courseIds = enrollments.map(e => e.courseId);

    const attendanceByCourse = [];
    for (const cid of courseIds) {
      const records = await db.collection('attendance_records')
        .find({ studentId: oid(sid), courseId: cid })
        .toArray();
      const total = records.length || 0;
      const present = records.filter(r => r.status === 'present').length;
      const course = await db.collection('courses').findOne({ _id: cid });
      attendanceByCourse.push({
        course_id: String(cid),
        course_name: course ? course.name : null,
        course_code: course ? course.code : null,
        percentage: total ? Math.round((present / total) * 100) : 0,
      });
    }

    const results = await db.collection('exam_results').find({ studentId: oid(sid) }).toArray();
    const avgMarks = results.length
      ? Math.round(results.reduce((sum, r) => sum + (r.marks || 0), 0) / results.length)
      : 0;

    const bookIssues = await db.collection('book_issues').find({ userId: oid(sid) }).toArray();

    res.json({
      attendance: attendance.rate,
      avg_marks: avgMarks,
      books_issued: bookIssues.length,
      overdue_books: bookIssues.filter(b => !b.returnDate && new Date(b.dueDate) < new Date()).length,
      attendance_by_course: attendanceByCourse,
    });
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.get('/analytics/faculty', requireRole('faculty'), async (req, res) => {
  try {
    const user = await authUser(req);
    const db = getDB();
    const fid = oid(String(user._id));

  const courses = await db.collection('courses').find({ $or: [{ facultyId: fid }, { facultyId: facultyId }] }).toArray();
    const courseIds = courses.map(c => c._id);

    const totalStudents = courseIds.length
      ? await db.collection('course_enrollments').countDocuments({ courseId: { $in: courseIds } })
      : 0;

    const totalAssignments = courseIds.length
      ? await db.collection('assignments').countDocuments({ courseId: { $in: courseIds } })
      : 0;

    const totalSubmissions = courseIds.length
      ? await db.collection('submissions')
          .countDocuments({
            assignmentId: {
              $in: (
                await db.collection('assignments')
                  .find({ courseId: { $in: courseIds } })
                  .toArray()
              ).map(a => a._id),
            },
          })
      : 0;

    res.json({
      total_courses: courses.length,
      total_students: totalStudents,
      total_assignments: totalAssignments,
      total_submissions: totalSubmissions,
      courses: courses.map(c => ({
        id: String(c._id),
        code: c.code,
        name: c.name,
      })),
    });
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.get('/analytics/admin', requireRole('college_admin', 'super_admin'), async (_req, res) => {
  try {
    const base = await buildAdminDashboard();
    const db = getDB();

    const [totalStudents, totalFaculty, allRecords, presentRecords] = await Promise.all([
      db.collection('users').countDocuments({ role: 'student' }),
      db.collection('users').countDocuments({ role: 'faculty' }),
      db.collection('attendance_records').countDocuments(),
      db.collection('attendance_records').countDocuments({ status: 'present' }),
    ]);

    const totalBooks = await db.collection('books').countDocuments();
    const totalBookIssues = await db.collection('book_issues').countDocuments();

    const departmentBreakdown = await db.collection('courses')
      .aggregate([
        { $group: { _id: '$department', count: { $sum: 1 } } },
      ])
      .toArray();

    res.json({
      ...base,
      attendance_rate: allRecords ? Math.round((presentRecords / allRecords) * 100) : 0,
      student_faculty_ratio: totalFaculty ? Number((totalStudents / totalFaculty).toFixed(1)) : 0,
      total_books: totalBooks,
      total_book_issues: totalBookIssues,
      department_breakdown: departmentBreakdown.map(d => ({
        department: d._id,
        count: d.count,
      })),
    });
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.get('/reminders', async (req, res) => {
  try {
    const db = getDB();
    const user = await authUser(req);
    const reminders = await db.collection('reminders')
      .find({ userId: oid(String(user._id)) })
      .sort({ priority: 1 })
      .toArray();
    res.json(reminders);
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

module.exports = { router, buildStudentAttendance };
