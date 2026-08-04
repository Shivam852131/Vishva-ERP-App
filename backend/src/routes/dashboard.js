const express = require('express');
const { getDB, oid } = require('../db');
const { authUser, requireRole, collegeFilter, requireCollegeAccess } = require('../auth');
const { serializeUserWithCollege, sendError, nowIso } = require('../utils');

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

async function buildStudentDashboard(studentId, req) {
  const db = getDB();
  const sid = oid(studentId);
  const cf = collegeFilter(req);

  const enrollments = await db.collection('course_enrollments').find({ ...cf, studentId: sid }).toArray();
  const courseIds = enrollments.map(e => e.courseId);

  const courses = courseIds.length
    ? await db.collection('courses').find({ ...cf, _id: { $in: courseIds } }).toArray()
    : [];

  const attendance = await buildStudentAttendance(studentId);

  const submittedAssignmentIds = (
    await db.collection('submissions').find({ ...cf, $or: [{ studentId: sid }, { studentId: studentId }] }).toArray()
  ).map(s => s.assignmentId);

  const pendingAssignments = courseIds.length
    ? await db.collection('assignments')
        .find({
          ...cf,
          courseId: { $in: courseIds },
          _id: { $nin: submittedAssignmentIds },
        })
        .toArray()
    : [];

  const pendingFees = await db.collection('fees')
    .find({ ...cf, $or: [{ userId: sid }, { userId: studentId }], status: { $ne: 'paid' } })
    .toArray();

  const upcomingClasses = courseIds.length
    ? await db.collection('timetable_slots').find({ ...cf, $or: [{ courseId: { $in: courseIds } }, { courseId: { $in: courseIds.map(String) } }] }).toArray()
    : [];

  const results = await db.collection('exam_results').find({ ...cf, $or: [{ studentId: sid }, { studentId: studentId }] }).toArray();
  const cgpa = results.length
    ? Number((results.reduce((sum, r) => sum + (r.marks || 0), 0) / results.length).toFixed(2))
    : null;

  const faceProfile = await db.collection('face_profiles').findOne({ ...cf, userId: sid });

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

async function buildFacultyDashboard(facultyId, req) {
  const db = getDB();
  const fid = oid(facultyId);
  const cf = collegeFilter(req);

  const courses = await db.collection('courses').find({ ...cf, $or: [{ facultyId: fid }, { facultyId: facultyId }] }).toArray();
  const courseIds = courses.map(c => c._id);

  const totalStudents = courseIds.length
    ? await db.collection('course_enrollments').countDocuments({ ...cf, $or: [{ courseId: { $in: courseIds } }, { courseId: { $in: courseIds.map(String) } }] })
    : 0;

  const assignments = courseIds.length
    ? await db.collection('assignments').find({ ...cf, courseId: { $in: courseIds } }).toArray()
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

async function buildParentDashboard(parentId, req) {
  const db = getDB();
  const pid = oid(parentId);
  const cf = collegeFilter(req);

  const children = await db.collection('users').find({ ...cf, parentId: pid }).toArray();
  if (!children.length) return { children: [] };

  const results = [];
  for (const child of children) {
    const cid = child._id;
    const attendance = await buildStudentAttendance(cid);

    const enrollments = await db.collection('course_enrollments').find({ ...cf, studentId: cid }).toArray();
    const courseIds = enrollments.map(e => e.courseId);

    const examResults = courseIds.length
      ? await db.collection('exam_results')
          .find({ ...cf, studentId: cid, courseId: { $in: courseIds } })
          .toArray()
      : [];

    const fees = await db.collection('fees').find({ ...cf, userId: cid }).toArray();

    const cgpa = examResults.length
      ? Number((examResults.reduce((sum, r) => sum + (r.marks || 0), 0) / examResults.length).toFixed(2))
      : null;

    results.push({
      user: await serializeUserWithCollege(db, child),
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

async function buildAdminDashboard(req) {
  const db = getDB();
  const cf = collegeFilter(req);

  const [students, faculty, parents, courses, pendingFees] = await Promise.all([
    db.collection('users').countDocuments({ ...cf, role: 'student' }),
    db.collection('users').countDocuments({ ...cf, role: 'faculty' }),
    db.collection('users').countDocuments({ ...cf, role: 'parent' }),
    db.collection('courses').countDocuments(cf),
    db.collection('fees').countDocuments({ ...cf, status: { $ne: 'paid' } }),
  ]);

  const colleges = req.isSuperAdmin
    ? await db.collection('colleges').countDocuments()
    : 1;

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
    const data = await buildStudentDashboard(String(user._id), req);
    res.json(data);
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.get('/dashboard/faculty', requireRole('faculty'), async (req, res) => {
  try {
    const user = await authUser(req);
    const data = await buildFacultyDashboard(String(user._id), req);
    res.json(data);
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.get('/dashboard/parent', requireRole('parent'), async (req, res) => {
  try {
    const user = await authUser(req);
    const data = await buildParentDashboard(String(user._id), req);
    res.json(data);
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.get('/dashboard/admin', requireRole('college_admin', 'super_admin'), requireCollegeAccess, async (req, res) => {
  try {
    const data = await buildAdminDashboard(req);
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
    const cf = collegeFilter(req);

    const attendance = await buildStudentAttendance(sid);

    const enrollments = await db.collection('course_enrollments').find({ ...cf, studentId: oid(sid) }).toArray();
    const courseIds = enrollments.map(e => e.courseId);

    const attendanceByCourse = [];
    for (const cid of courseIds) {
      const records = await db.collection('attendance_records')
        .find({ ...cf, studentId: oid(sid), courseId: cid })
        .toArray();
      const total = records.length || 0;
      const present = records.filter(r => r.status === 'present').length;
      const course = await db.collection('courses').findOne({ ...cf, _id: cid });
      attendanceByCourse.push({
        course_id: String(cid),
        course_name: course ? course.name : null,
        course_code: course ? course.code : null,
        percentage: total ? Math.round((present / total) * 100) : 0,
      });
    }

    const results = await db.collection('exam_results').find({ ...cf, studentId: oid(sid) }).toArray();
    const avgMarks = results.length
      ? Math.round(results.reduce((sum, r) => sum + (r.marks || 0), 0) / results.length)
      : 0;

    const bookIssues = await db.collection('book_issues').find({ ...cf, userId: oid(sid) }).toArray();

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
    const cf = collegeFilter(req);

  const courses = await db.collection('courses').find({ ...cf, facultyId: fid }).toArray();
    const courseIds = courses.map(c => c._id);

    const totalStudents = courseIds.length
      ? await db.collection('course_enrollments').countDocuments({ ...cf, courseId: { $in: courseIds } })
      : 0;

    const totalAssignments = courseIds.length
      ? await db.collection('assignments').countDocuments({ ...cf, courseId: { $in: courseIds } })
      : 0;

    const totalSubmissions = courseIds.length
      ? await db.collection('submissions')
          .countDocuments({
            ...cf,
            assignmentId: {
              $in: (
                await db.collection('assignments')
                  .find({ ...cf, courseId: { $in: courseIds } })
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

router.get('/analytics/admin', requireRole('college_admin', 'super_admin'), requireCollegeAccess, async (req, res) => {
  try {
    const base = await buildAdminDashboard(req);
    const db = getDB();
    const cf = collegeFilter(req);

    const [totalStudents, totalFaculty, allRecords, presentRecords] = await Promise.all([
      db.collection('users').countDocuments({ ...cf, role: 'student' }),
      db.collection('users').countDocuments({ ...cf, role: 'faculty' }),
      db.collection('attendance_records').countDocuments(cf),
      db.collection('attendance_records').countDocuments({ ...cf, status: 'present' }),
    ]);

    const totalBooks = await db.collection('books').countDocuments(cf);
    const totalBookIssues = await db.collection('book_issues').countDocuments(cf);

    const departmentBreakdown = await db.collection('courses')
      .aggregate([
        { $match: cf },
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
    const cf = collegeFilter(req);
    const reminders = await db.collection('reminders')
      .find({ ...cf, userId: oid(String(user._id)) })
      .sort({ priority: 1 })
      .toArray();
    res.json(reminders);
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

module.exports = { router, buildStudentAttendance };
