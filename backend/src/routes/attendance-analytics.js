const express = require('express');
const { getDB, oid } = require('../db');
const { authUser, requireRole, collegeFilter } = require('../auth');
const { sendError, isoDate } = require('../utils');

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function createAttendanceAnalyticsRouter(io) {
  const router = express.Router();

  // ── Get attendance analytics for a student ──
  router.get('/attendance/analytics', requireRole('student'), async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();
    const uid = oid(user._id);

    // Get all attendance records for the student
    const records = await db.collection('attendance_records')
      .find({ studentId: uid, ...collegeFilter(req) })
      .sort({ date: -1 })
      .toArray();

    // Calculate streak
    let streak = 0;
    let maxStreak = 0;
    let currentStreak = 0;
    const today = new Date();
    const dates = [...new Set(records.map(r => r.date))].sort().reverse();

    for (let i = 0; i < dates.length; i++) {
      const recordDate = new Date(dates[i]);
      const diffDays = Math.floor((today.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= i + 1) {
        const dayRecords = records.filter(r => r.date === dates[i]);
        const present = dayRecords.some(r => r.status === 'present' || r.status === 'late');
        if (present) {
          currentStreak++;
          maxStreak = Math.max(maxStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      } else {
        break;
      }
    }
    streak = currentStreak;

    // Calculate weekly trend
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const thisWeekRecords = records.filter(r => new Date(r.date) >= thisWeekStart);
    const lastWeekRecords = records.filter(r => {
      const d = new Date(r.date);
      return d >= lastWeekStart && d < thisWeekStart;
    });

    const thisWeekPct = thisWeekRecords.length > 0
      ? (thisWeekRecords.filter(r => r.status === 'present' || r.status === 'late').length / thisWeekRecords.length) * 100
      : 0;
    const lastWeekPct = lastWeekRecords.length > 0
      ? (lastWeekRecords.filter(r => r.status === 'present' || r.status === 'late').length / lastWeekRecords.length) * 100
      : 0;
    const weeklyTrend = Math.round(thisWeekPct - lastWeekPct);

    // Calculate monthly trend
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

    const thisMonthRecords = records.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    const lastMonthRecords = records.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    });

    const thisMonthPct = thisMonthRecords.length > 0
      ? (thisMonthRecords.filter(r => r.status === 'present' || r.status === 'late').length / thisMonthRecords.length) * 100
      : 0;
    const lastMonthPct = lastMonthRecords.length > 0
      ? (lastMonthRecords.filter(r => r.status === 'present' || r.status === 'late').length / lastMonthRecords.length) * 100
      : 0;
    const monthlyTrend = Math.round(thisMonthPct - lastMonthPct);

    // Method distribution
    const methodCounts = {};
    records.forEach(r => {
      const method = r.method || 'unknown';
      methodCounts[method] = (methodCounts[method] || 0) + 1;
    });

    // Weekly data (last 5 weekdays)
    const weeklyData = [];
    for (let i = 0; i < 5; i++) {
      const dayDate = new Date(today);
      dayDate.setDate(today.getDate() - (today.getDay() - i));
      const dayStr = dayDate.toISOString().split('T')[0];
      const dayRecords = records.filter(r => r.date === dayStr);
      const present = dayRecords.filter(r => r.status === 'present' || r.status === 'late').length;
      const total = dayRecords.length || 1;
      weeklyData.push(Math.round((present / total) * 100));
    }

    // Course-wise analytics
    const courseIds = [...new Set(records.map(r => String(r.courseId)))];
    const courseAnalytics = [];
    for (const courseId of courseIds) {
      const courseRecords = records.filter(r => String(r.courseId) === courseId);
      const present = courseRecords.filter(r => r.status === 'present' || r.status === 'late').length;
      const total = courseRecords.length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
      courseAnalytics.push({ courseId, present, total, percentage });
    }

    // Predictions
    const overallPct = records.length > 0
      ? (records.filter(r => r.status === 'present' || r.status === 'late').length / records.length) * 100
      : 0;
    const classesNeeded = overallPct < 75
      ? Math.ceil((75 - overallPct) * records.length * 0.01)
      : 0;

    res.json({
      streak,
      max_streak: maxStreak,
      weekly_trend: weeklyTrend,
      monthly_trend: monthlyTrend,
      method_counts: methodCounts,
      weekly_data: weeklyData,
      course_analytics: courseAnalytics,
      predictions: {
        overall_percentage: Math.round(overallPct),
        classes_needed_for_75: classesNeeded,
        exam_eligible: overallPct >= 75,
      },
      total_records: records.length,
      overall_percentage: Math.round(overallPct),
    });
  });

  // ── Get attendance heatmap data ──
  router.get('/attendance/heatmap', requireRole('student'), async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();
    const uid = oid(user._id);

    const startDate = req.query.startDate || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = req.query.endDate || isoDate();

    const records = await db.collection('attendance_records')
      .find({
        studentId: uid,
        date: { $gte: startDate, $lte: endDate },
        ...collegeFilter(req)
      })
      .toArray();

    // Group by date
    const heatmapData = {};
    records.forEach(r => {
      if (!heatmapData[r.date]) {
        heatmapData[r.date] = { present: 0, total: 0 };
      }
      heatmapData[r.date].total++;
      if (r.status === 'present' || r.status === 'late') {
        heatmapData[r.date].present++;
      }
    });

    // Calculate percentages
    const heatmap = Object.entries(heatmapData).map(([date, data]) => ({
      date,
      percentage: Math.round((data.present / data.total) * 100),
      present: data.present,
      total: data.total,
    }));

    res.json({ heatmap, start_date: startDate, end_date: endDate });
  });

  // ── Get attendance trends ──
  router.get('/attendance/trends', requireRole('student'), async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();
    const uid = oid(user._id);

    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const records = await db.collection('attendance_records')
      .find({
        studentId: uid,
        date: { $gte: startDateStr },
        ...collegeFilter(req)
      })
      .sort({ date: 1 })
      .toArray();

    // Daily trends
    const dailyTrends = [];
    const currentDate = new Date(startDate);
    const today = new Date();

    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayRecords = records.filter(r => r.date === dateStr);
      const present = dayRecords.filter(r => r.status === 'present' || r.status === 'late').length;
      const total = dayRecords.length;

      dailyTrends.push({
        date: dateStr,
        day: DAYS[currentDate.getDay()],
        percentage: total > 0 ? Math.round((present / total) * 100) : null,
        present,
        total,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Weekly aggregation
    const weeklyTrends = [];
    for (let i = 0; i < Math.ceil(days / 7); i++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(startDate.getDate() + i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const weekRecords = records.filter(r => {
        const d = new Date(r.date);
        return d >= weekStart && d <= weekEnd;
      });

      const present = weekRecords.filter(r => r.status === 'present' || r.status === 'late').length;
      const total = weekRecords.length;

      weeklyTrends.push({
        week: `Week ${i + 1}`,
        start_date: weekStart.toISOString().split('T')[0],
        end_date: weekEnd.toISOString().split('T')[0],
        percentage: total > 0 ? Math.round((present / total) * 100) : null,
        present,
        total,
      });
    }

    res.json({ daily: dailyTrends, weekly: weeklyTrends, period_days: days });
  });

  // ── Leave request submission ──
  router.post('/attendance/leave-request', requireRole('student'), async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();
    const uid = oid(user._id);

    const { date, reason, course_id } = req.body;
    if (!date || !reason) {
      return sendError(res, 'Date and reason are required.', 400);
    }

    const leaveRequest = {
      studentId: uid,
      studentName: user.name,
      studentEmail: user.email,
      date,
      reason,
      courseId: course_id ? oid(course_id) : null,
      collegeId: oid(req.userCollegeId),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { insertedId } = await db.collection('leave_requests').insertOne(leaveRequest);

    // Notify faculty if course specified
    if (course_id) {
      const course = await db.collection('courses').findOne({ _id: oid(course_id), ...collegeFilter(req) });
      if (course) {
        const faculty = await db.collection('users').findOne({ _id: course.facultyId, ...collegeFilter(req) });
        if (faculty) {
          await db.collection('notifications').insertOne({
            audience: 'faculty',
            title: 'Leave Request',
            body: `${user.name} has requested leave for ${date}. Reason: ${reason}`,
            recipientIds: [String(faculty._id)],
            readBy: [],
            collegeId: oid(req.userCollegeId),
            createdAt: new Date(),
          });
          io.emit('notifications:update', { audience: 'faculty', recipientIds: [String(faculty._id)] });
        }
      }
    }

    res.json({
      ok: true,
      id: String(insertedId),
      message: 'Leave request submitted successfully',
    });
  });

  // ── Get leave requests ──
  router.get('/attendance/leave-requests', requireRole('student', 'faculty', 'college_admin'), async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();

    let filter = {};
    if (user.role === 'student') {
      filter = { studentId: oid(user._id) };
    } else if (user.role === 'faculty') {
      // Get requests for faculty's courses
      const courses = await db.collection('courses').find({ facultyId: oid(user._id), ...collegeFilter(req) }).toArray();
      const courseIds = courses.map(c => c._id);
      filter = { courseId: { $in: courseIds } };
    }

    const requests = await db.collection('leave_requests')
      .find({ ...filter, ...collegeFilter(req) })
      .sort({ createdAt: -1 })
      .toArray();

    const enriched = await Promise.all(requests.map(async (leaveReq) => {
      let courseName = '';
      if (leaveReq.courseId) {
        const course = await db.collection('courses').findOne({ _id: leaveReq.courseId, ...collegeFilter(req) });
        courseName = course?.name || '';
      }
      return {
        id: String(leaveReq._id),
        student_name: leaveReq.studentName,
        student_email: leaveReq.studentEmail,
        date: leaveReq.date,
        reason: leaveReq.reason,
        course_id: leaveReq.courseId ? String(leaveReq.courseId) : null,
        course_name: courseName,
        status: leaveReq.status,
        created_at: leaveReq.createdAt,
        updated_at: leaveReq.updatedAt,
        comment: leaveReq.comment || undefined,
      };
    }));

    res.json(enriched);
  });

  // ── Approve/reject leave request ──
  router.post('/attendance/leave-request/:id/action', requireRole('faculty', 'college_admin'), async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();
    const requestId = oid(req.params.id);
    if (!requestId) return sendError(res, 'Request not found.', 404);

    const { action, comment } = req.body;
    if (!['approved', 'rejected'].includes(action)) {
      return sendError(res, 'Invalid action.', 400);
    }

    const request = await db.collection('leave_requests').findOne({ _id: requestId, ...collegeFilter(req) });
    if (!request) return sendError(res, 'Request not found.', 404);

    await db.collection('leave_requests').updateOne(
      { _id: requestId },
      { $set: { status: action, comment, updatedAt: new Date() } }
    );

    // Notify student
    await db.collection('notifications').insertOne({
      audience: 'students',
      title: `Leave Request ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      body: `Your leave request for ${request.date} has been ${action}.${comment ? ` Comment: ${comment}` : ''}`,
      recipientIds: [String(request.studentId)],
      readBy: [],
      collegeId: oid(req.userCollegeId),
      createdAt: new Date(),
    });
    io.emit('notifications:update', { audience: 'students', recipientIds: [String(request.studentId)] });

    res.json({ ok: true, message: `Leave request ${action}` });
  });

  // ── Batch attendance upload ──
  router.post('/attendance/batch-upload', requireRole('faculty', 'college_admin'), async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();

    const { course_id, date, records: attendanceRecords } = req.body;
    if (!course_id || !date || !Array.isArray(attendanceRecords)) {
      return sendError(res, 'course_id, date, and records array are required.', 400);
    }

    const courseId = oid(course_id);
    if (!courseId) return sendError(res, 'Invalid course ID.', 400);

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const record of attendanceRecords) {
      try {
        const studentId = oid(record.student_id);
        if (!studentId) { errors++; continue; }

        const existing = await db.collection('attendance_records').findOne({
          studentId,
          courseId,
          date,
          ...collegeFilter(req)
        });

        if (existing) {
          await db.collection('attendance_records').updateOne(
            { _id: existing._id },
            { $set: { status: record.status || 'present' } }
          );
          updated++;
        } else {
          await db.collection('attendance_records').insertOne({
            studentId,
            courseId,
            date,
            status: record.status || 'present',
            sessionId: null,
            method: 'batch',
            collegeId: oid(req.userCollegeId),
          });
          created++;
        }
      } catch (e) {
        errors++;
      }
    }

    res.json({
      ok: true,
      created,
      updated,
      errors,
      total: attendanceRecords.length,
    });
  });

  // ── Generate attendance certificate ──
  router.get('/attendance/certificate', requireRole('student'), async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();
    const uid = oid(user._id);

    // Get all attendance records
    const records = await db.collection('attendance_records')
      .find({ studentId: uid, ...collegeFilter(req) })
      .toArray();

    if (records.length === 0) {
      return sendError(res, 'No attendance records found.', 404);
    }

    // Calculate stats
    const totalClasses = records.length;
    const presentClasses = records.filter(r => r.status === 'present' || r.status === 'late').length;
    const percentage = Math.round((presentClasses / totalClasses) * 100);

    // Get course-wise breakdown
    const courseIds = [...new Set(records.map(r => String(r.courseId)))];
    const courseBreakdown = [];
    for (const courseId of courseIds) {
      const courseRecords = records.filter(r => String(r.courseId) === courseId);
      const course = await db.collection('courses').findOne({ _id: oid(courseId), ...collegeFilter(req) });
      const present = courseRecords.filter(r => r.status === 'present' || r.status === 'late').length;
      courseBreakdown.push({
        course_name: course?.name || 'Unknown',
        course_code: course?.code || '',
        total: courseRecords.length,
        present,
        percentage: Math.round((present / courseRecords.length) * 100),
      });
    }

    // Get date range
    const dates = records.map(r => r.date).sort();
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    // Generate certificate ID
    const certId = `CERT-${user.studentCode || user.id}-${Date.now()}`;

    res.json({
      ok: true,
      certificate: {
        id: certId,
        student_name: user.name,
        student_code: user.studentCode || '',
        college: user.college || '',
        department: user.department || '',
        start_date: startDate,
        end_date: endDate,
        total_classes: totalClasses,
        present_classes: presentClasses,
        overall_percentage: percentage,
        course_breakdown: courseBreakdown,
        issued_at: new Date().toISOString(),
      },
    });
  });

  // ── Export attendance report ──
  router.get('/attendance/export', requireRole('student', 'faculty', 'college_admin'), async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();

    let filter = {};
    if (user.role === 'student') {
      filter = { studentId: oid(user._id) };
    } else if (req.query.courseId) {
      filter = { courseId: oid(req.query.courseId) };
    }

    if (req.query.startDate) filter.date = { ...filter.date, $gte: req.query.startDate };
    if (req.query.endDate) filter.date = { ...filter.date, $lte: req.query.endDate };

    const records = await db.collection('attendance_records')
      .find({ ...filter, ...collegeFilter(req) })
      .sort({ date: -1 })
      .toArray();

    // Enrich with student and course info
    const enriched = await Promise.all(records.map(async (r) => {
      const student = await db.collection('users').findOne({ _id: r.studentId, ...collegeFilter(req) });
      const course = await db.collection('courses').findOne({ _id: r.courseId, ...collegeFilter(req) });
      return {
        date: r.date,
        student_name: student?.name || '',
        student_code: student?.studentCode || '',
        course_name: course?.name || '',
        course_code: course?.code || '',
        status: r.status,
        method: r.method || '',
      };
    }));

    // Convert to CSV
    const headers = ['Date', 'Student Name', 'Student Code', 'Course', 'Code', 'Status', 'Method'];
    const csv = [headers.join(',')];
    enriched.forEach(r => {
      csv.push([
        r.date,
        `"${r.student_name}"`,
        r.student_code,
        `"${r.course_name}"`,
        r.course_code,
        r.status,
        r.method,
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=attendance-report-${isoDate()}.csv`);
    res.send(csv.join('\n'));
  });

  // ── Live roster for one session (admin/faculty live screens) ──
  router.get('/admin/attendance/live/:sid', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const id = oid(req.params.sid);
    if (!id) return sendError(res, 'Session not found.', 404);

    const session = await db.collection('attendance_sessions').findOne({ _id: id, ...collegeFilter(req) });
    if (!session) return sendError(res, 'Session not found.', 404);

    const [course, entries, classroom] = await Promise.all([
      db.collection('courses').findOne({ _id: oid(session.courseId), ...collegeFilter(req) }),
      db.collection('attendance_roll_entries').find({ sessionId: id, ...collegeFilter(req) }).toArray(),
      session.classroomId
        ? db.collection('classrooms').findOne({ _id: oid(session.classroomId), ...collegeFilter(req) })
        : null,
    ]);

    const enrollments = await db
      .collection('course_enrollments')
      .find({ courseId: oid(session.courseId), ...collegeFilter(req) })
      .toArray();
    const studentIds = enrollments.map((e) => oid(e.studentId)).filter(Boolean);
    const enrolled = studentIds.length
      ? await db.collection('users').find({ _id: { $in: studentIds }, ...collegeFilter(req) }).toArray()
      : [];

    const byStudent = new Map(entries.map((e) => [String(e.studentId), e]));
    const graceMs = 10 * 60 * 1000;
    const startTime = session.startTime instanceof Date ? session.startTime : null;

    const students = enrolled.map((s) => {
      const entry = byStudent.get(String(s._id));
      const checkIn = entry?.checkInTime instanceof Date ? entry.checkInTime : null;
      let status = 'absent';
      if (entry && entry.status !== 'absent') {
        // A manual override is authoritative — never re-derive it from the clock.
        status =
          entry.method === 'manual'
            ? entry.status
            : startTime && checkIn && checkIn - startTime > graceMs
              ? 'late'
              : 'present';
      }
      return {
        student_id: String(s._id),
        student_code: s.studentCode || '',
        name: s.name || '',
        student_name: s.name || '',
        email: s.email || '',
        status,
        method: entry?.method || null,
        check_in: checkIn ? checkIn.toISOString() : null,
        check_in_time: checkIn ? checkIn.toISOString() : null,
        verified: entry?.verified ?? false,
      };
    });

    const present = students.filter((s) => s.status === 'present').length;
    const late = students.filter((s) => s.status === 'late').length;
    const absent = students.filter((s) => s.status === 'absent').length;
    const totalEnrolled = students.length;

    res.json({
      session_id: String(session._id),
      active: !!session.isActive,
      schedule: {
        course_id: String(session.courseId),
        course_name: course?.name || '',
        course_code: course?.code || '',
        classroom_name: classroom?.name || '',
        day: session.day || '',
        start_time: session.startTime instanceof Date ? session.startTime.toISOString() : session.startTime || '',
        end_time: session.endTime instanceof Date ? session.endTime.toISOString() : session.endTime || '',
      },
      students,
      present,
      late,
      absent,
      total_enrolled: totalEnrolled,
      percentage: totalEnrolled ? Math.round(((present + late) / totalEnrolled) * 100) : 0,
    });
  });

  // ── Manual attendance override ──
  router.post('/admin/attendance/override/:sid', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const id = oid(req.params.sid);
    if (!id) return sendError(res, 'Session not found.', 404);

    const session = await db.collection('attendance_sessions').findOne({ _id: id, ...collegeFilter(req) });
    if (!session) return sendError(res, 'Session not found.', 404);

    const studentId = oid(req.body.student_id || req.body.studentId);
    if (!studentId) return sendError(res, 'Student not found.', 404);

    const status = req.body.status === 'absent' ? 'absent' : 'present';
    const existing = await db
      .collection('attendance_roll_entries')
      .findOne({ sessionId: id, studentId, ...collegeFilter(req) });

    if (!existing) {
      await db.collection('attendance_roll_entries').insertOne({
        sessionId: id,
        studentId,
        checkInTime: status === 'absent' ? null : new Date(),
        method: 'manual',
        status,
        location: null,
        verified: true,
        overrideReason: req.body.reason || null,
        collegeId: oid(req.userCollegeId),
      });
    } else {
      await db.collection('attendance_roll_entries').updateOne(
        { _id: existing._id },
        {
          $set: {
            status,
            checkInTime: status === 'present' && !existing.checkInTime ? new Date() : existing.checkInTime,
            overrideReason: req.body.reason || null,
          },
        }
      );
    }

    await db.collection('attendance_records').updateOne(
      { studentId, courseId: session.courseId, sessionId: id, ...collegeFilter(req) },
      { $set: { status }, $setOnInsert: { collegeId: oid(req.userCollegeId) } },
      { upsert: true }
    );

    const sidStr = String(session._id);
    io.emit('attendance:session:update', { sessionId: sidStr });
    io.emit('attendance:live:update', { sessionId: sidStr, courseId: String(session.courseId) });

    res.json({ ok: true, status });
  });

  // ── Notify absent students ──
  router.post('/admin/notifications/absentees', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const courseId = oid(req.body.course_id || req.body.courseId);

    const query = courseId ? { courseId, isActive: true, ...collegeFilter(req) } : { isActive: true, ...collegeFilter(req) };
    let sessions = await db.collection('attendance_sessions').find(query).toArray();
    if (!sessions.length) {
      const latest = await db
        .collection('attendance_sessions')
        .findOne(courseId ? { courseId, ...collegeFilter(req) } : collegeFilter(req), { sort: { createdAt: -1 } });
      sessions = latest ? [latest] : [];
    }

    let notificationsSent = 0;
    const recipientIds = [];

    for (const session of sessions) {
      const course = await db.collection('courses').findOne({ _id: oid(session.courseId), ...collegeFilter(req) });
      const enrollments = await db
        .collection('course_enrollments')
        .find({ courseId: oid(session.courseId), ...collegeFilter(req) })
        .toArray();
      const studentIds = enrollments.map((e) => oid(e.studentId)).filter(Boolean);
      if (!studentIds.length) continue;

      const [enrolled, entries] = await Promise.all([
        db.collection('users').find({ _id: { $in: studentIds }, ...collegeFilter(req) }).toArray(),
        db.collection('attendance_roll_entries').find({ sessionId: session._id, ...collegeFilter(req) }).toArray(),
      ]);

      const present = new Set(
        entries.filter((e) => e.status !== 'absent').map((e) => String(e.studentId))
      );
      const absentees = enrolled.filter((s) => !present.has(String(s._id)));
      if (!absentees.length) continue;

      const ids = absentees.map((s) => String(s._id));
      await db.collection('notifications').insertOne({
        audience: 'students',
        title: 'Attendance alert',
        body: `You were marked absent for ${course?.name || 'your course'}. Contact your faculty if this is incorrect.`,
        recipientIds: ids,
        readBy: [],
        collegeId: oid(req.userCollegeId),
        createdAt: new Date(),
      });
      notificationsSent += ids.length;
      recipientIds.push(...ids);
    }

    if (recipientIds.length) {
      io.emit('notifications:update', { audience: 'students', recipientIds });
    }

    res.json({ ok: true, notifications_sent: notificationsSent });
  });

  return router;
}

module.exports = { createAttendanceAnalyticsRouter };
