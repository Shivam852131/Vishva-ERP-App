const express = require('express');
const { getDB, oid } = require('../db');
const { authUser, requireRole } = require('../auth');
const { serializeUser, sendError, makeCode, nowIso, isoDate } = require('../utils');
const { verifyFace, encodeFace } = require('../faceVerify');

function createAttendanceRouter(io) {
  const router = express.Router();

  function emitAttendance(session) {
    const sid = String(session._id);
    io.emit('attendance:session:update', { sessionId: sid });
    io.emit('attendance:active-sessions:update', { sessionId: sid, courseId: String(session.courseId) });
    io.emit('attendance:live:update', { sessionId: sid, courseId: String(session.courseId) });
  }

  async function pushNotification({ audience = 'all', title, body, recipientIds = [] }) {
    const db = getDB();
    const doc = { audience, title, body, recipientIds: recipientIds.map(String), readBy: [], createdAt: new Date() };
    const { insertedId } = await db.collection('notifications').insertOne(doc);
    io.emit('notifications:update', { audience, recipientIds });
    return { _id: insertedId, ...doc };
  }

  async function getSessionById(sid) {
    const db = getDB();
    const id = oid(sid);
    if (!id) return null;
    return db.collection('attendance_sessions').findOne({ _id: id });
  }

  async function getSessionWithDetails(sid) {
    const db = getDB();
    const id = oid(sid);
    if (!id) return null;
    const session = await db.collection('attendance_sessions').findOne({ _id: id });
    if (!session) return null;
    const [entries, course] = await Promise.all([
      db.collection('attendance_roll_entries').find({ sessionId: id }).toArray(),
      db.collection('courses').findOne({ _id: oid(session.courseId) }),
    ]);
    const students = await Promise.all(
      entries.map(async (entry) => {
        const student = await db.collection('users').findOne({ _id: oid(entry.studentId) });
        return { ...entry, student };
      })
    );
    return { ...session, rollEntries: students, course };
  }

  async function studentsForCourse(courseId) {
    const db = getDB();
    const cid = oid(courseId);
    if (!cid) return [];
    const enrollments = await db.collection('course_enrollments').find({ courseId: cid }).toArray();
    const studentIds = enrollments.map((e) => oid(e.studentId)).filter(Boolean);
    if (!studentIds.length) return [];
    return db.collection('users').find({ _id: { $in: studentIds } }).toArray();
  }

  async function getEnrolledCourseIds(studentId) {
    const db = getDB();
    const sid = oid(studentId);
    if (!sid) return [];
    const enrollments = await db.collection('course_enrollments').find({ studentId: sid }).toArray();
    return enrollments.map((e) => oid(e.courseId)).filter(Boolean);
  }

  async function getTaughtCourseIds(facultyId) {
    const db = getDB();
    const fid = oid(facultyId);
    if (!fid) return [];
    const courses = await db.collection('courses').find({ facultyId: fid }).toArray();
    return courses.map((c) => c._id);
  }

  // ── Student routes ──

  router.get('/attendance/me', async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();
    const uid = oid(user._id);
    const userId = String(user._id);
    const filter = { $or: [{ studentId: uid }, { studentId: userId }] };
    if (req.query.courseId) filter.courseId = oid(req.query.courseId);
    const records = await db.collection('attendance_records').find(filter).sort({ date: -1 }).toArray();
    const courseIdsRaw = [...new Set(records.map((r) => String(r.courseId)))];
    const courseOids = courseIdsRaw.map(oid).filter(Boolean);
    const courses = courseOids.length || courseIdsRaw.length
      ? await db.collection('courses').find({ $or: [{ _id: { $in: courseOids } }, { _id: { $in: courseIdsRaw } }] }).toArray()
      : [];
    const courseMap = Object.fromEntries(courses.map((c) => [String(c._id), c]));
    res.json(
      records.map((r) => ({
        id: String(r._id),
        courseId: String(r.courseId),
        date: r.date,
        status: r.status,
        courseName: courseMap[String(r.courseId)]?.name || '',
      }))
    );
  });

  router.get('/attendance/sessions/active', async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();
    const courseIds = await getEnrolledCourseIds(user._id);
    if (!courseIds.length) return res.json({ sessions: [], face_enrolled: false });
    const sessions = await db
      .collection('attendance_sessions')
      .find({ courseId: { $in: courseIds }, isActive: true })
      .toArray();
    const enriched = await Promise.all(
      sessions.map(async (session) => {
        const course = await db.collection('courses').findOne({ _id: oid(session.courseId) });
        const entries = await db.collection('attendance_roll_entries').find({ sessionId: session._id }).toArray();
        const checkedIn = entries.some((e) => String(e.studentId) === String(user._id));
        return {
          id: String(session._id),
          course_name: course?.name || '',
          expires_at: session.endTime instanceof Date ? session.endTime.toISOString() : session.endTime,
          method: session.type,
          checked_in: checkedIn,
          code: session.qrCode,
        };
      })
    );
    const faceProfile = await db.collection('face_profiles').findOne({ userId: uid });
    res.json({ sessions: enriched, face_enrolled: !!faceProfile });
  });

  router.get('/attendance/sessions/mine', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const user = await authUser(req);
    const db = getDB();
    const fid = oid(user._id);
    const sessions = await db
      .collection('attendance_sessions')
      .find({ facultyId: fid })
      .sort({ createdAt: -1 })
      .toArray();
    const enriched = await Promise.all(
      sessions.map(async (session) => {
        const course = await db.collection('courses').findOne({ _id: oid(session.courseId) });
        const entries = await db.collection('attendance_roll_entries').find({ sessionId: session._id }).toArray();
        const checkins = entries.filter((e) => e.status !== 'absent').length;
        return {
          id: String(session._id),
          course_name: course?.name || '',
          method: session.type,
          code: session.qrCode,
          starts_at: session.startTime instanceof Date ? session.startTime.toISOString() : session.startTime,
          expires_at: session.endTime instanceof Date ? session.endTime.toISOString() : session.endTime,
          active: session.isActive,
          checkins,
        };
      })
    );
    res.json(enriched);
  });

  router.post('/attendance/sessions', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const user = await authUser(req);
    const db = getDB();
    const course = await db.collection('courses').findOne({ _id: oid(req.body.courseId) });
    if (!course) return sendError(res, 'Course not found.', 404);
    const doc = {
      courseId: course._id,
      facultyId: oid(user._id),
      date: req.body.date || isoDate(),
      type: req.body.type || 'qr',
      qrCode: req.body.qrCode || makeCode(),
      startTime: new Date(req.body.startTime || nowIso()),
      endTime: req.body.endTime || null,
      isActive: true,
      location: req.body.location || null,
      radius: Number(req.body.radius) || 150,
      createdAt: new Date(),
    };
    const { insertedId } = await db.collection('attendance_sessions').insertOne(doc);
    const session = { _id: insertedId, ...doc };
    emitAttendance(session);
    res.json({
      id: String(insertedId),
      course_name: course.name,
      method: doc.type,
      code: doc.qrCode,
      starts_at: doc.startTime instanceof Date ? doc.startTime.toISOString() : doc.startTime,
      expires_at: doc.endTime,
      active: true,
      checkins: 0,
    });
  });

  router.get('/attendance/sessions/:id', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const session = await getSessionWithDetails(req.params.id);
    if (!session) return sendError(res, 'Session not found.', 404);
    const enrolledStudents = await studentsForCourse(session.courseId);
    const roll = session.rollEntries
      .filter((e) => e.status !== 'absent')
      .map((e) => ({
        name: e.student?.name || '',
        student_id: e.student?.studentCode || String(e.studentId),
        check_in: e.checkInTime instanceof Date ? e.checkInTime.toISOString() : e.checkInTime,
        method: e.method,
      }));
    res.json({
      session: {
        id: String(session._id),
        course_name: session.course?.name || '',
        course_code: session.course?.code || '',
        method: session.type,
        code: session.qrCode,
        expires_at: session.endTime instanceof Date ? session.endTime.toISOString() : session.endTime,
        active: session.isActive,
      },
      roll,
      enrolled: enrolledStudents.length,
    });
  });

  router.post('/attendance/checkin', requireRole('student'), async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();
    const session = await getSessionById(req.body.sessionId || req.body.session_id);
    if (!session) return sendError(res, 'Session not found.', 404);
    if (!session.isActive) return sendError(res, 'This session has ended.');
    const uid = oid(user._id);
    const enrolled = await db.collection('course_enrollments').findOne({ studentId: uid, courseId: oid(session.courseId) });
    if (!enrolled) return sendError(res, 'You are not enrolled in this class.');
    const existing = await db.collection('attendance_roll_entries').findOne({ sessionId: session._id, studentId: uid });
    if (existing) return sendError(res, 'You are already checked in.');
    const method = req.body.method || session.type || 'qr';

    // ── Face verification ──
    if (method === 'face' || req.body.selfie_base64) {
      const selfie = req.body.selfie_base64;
      if (!selfie) return sendError(res, 'Selfie is required for face check-in.', 400);

      // Get enrolled face profile
      const faceProfile = await db.collection('face_profiles').findOne({ userId: uid });

      // Run face verification pipeline
      const result = verifyFace(selfie, faceProfile, req.body.prev_frame_base64 || null);

      if (!result.ok) {
        return sendError(res, result.message, 400);
      }

      // Store or update face profile
      if (result.isNewEnrollment || !faceProfile) {
        const faceDoc = {
          userId: uid,
          encoding: result.encoding,
          enrolledAt: new Date(),
          lastVerified: new Date(),
          verificationCount: 1,
        };
        if (faceProfile) {
          await db.collection('face_profiles').updateOne({ _id: faceProfile._id }, { $set: faceDoc });
        } else {
          await db.collection('face_profiles').insertOne(faceDoc);
        }
      } else {
        // Update last verified and count
        await db.collection('face_profiles').updateOne(
          { _id: faceProfile._id },
          { $set: { lastVerified: new Date() }, $inc: { verificationCount: 1 } }
        );
      }
    }

    // ── QR verification ──
    if (method === 'qr' && req.body.qrCode && req.body.qrCode !== session.qrCode) {
      return sendError(res, 'Attendance code does not match.');
    }

    // ── Record check-in ──
    const entries = await db.collection('attendance_roll_entries').find({ sessionId: session._id }).toArray();
    const status = entries.length === 0 ? 'present' : 'late';
    const now = new Date();
    await db.collection('attendance_roll_entries').insertOne({
      sessionId: session._id,
      studentId: uid,
      checkInTime: now,
      method,
      status,
      location: req.body.location || null,
      verified: method === 'face' ? true : (req.body.qrCode === session.qrCode),
    });
    await db.collection('attendance_records').insertOne({
      studentId: uid,
      courseId: session.courseId,
      date: isoDate(),
      status,
      sessionId: session._id,
    });
    emitAttendance(session);
    const course = await db.collection('courses').findOne({ _id: oid(session.courseId) });
    await pushNotification({ audience: 'students', title: 'Attendance confirmed', body: `${course?.name || 'Course'} check-in recorded.` });
    res.json({
      ok: true,
      status,
      checked_in_at: now.toISOString(),
      message: 'Checked in',
      detail: `${course?.name || ''} via ${method.toUpperCase()}`,
      face_verified: method === 'face',
    });
  });

  router.post('/attendance/sessions/:id/close', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const session = await getSessionById(req.params.id);
    if (!session) return sendError(res, 'Session not found.', 404);
    const db = getDB();
    const now = new Date();
    await db.collection('attendance_sessions').updateOne({ _id: session._id }, { $set: { isActive: false, endTime: now } });
    const enrolledStudents = await studentsForCourse(session.courseId);
    const entries = await db.collection('attendance_roll_entries').find({ sessionId: session._id }).toArray();
    const checkedInIds = new Set(entries.map((e) => String(e.studentId)));
    const absentStudents = enrolledStudents.filter((s) => !checkedInIds.has(String(s._id)));
    if (absentStudents.length) {
      await db.collection('attendance_records').insertMany(
        absentStudents.map((s) => ({
          studentId: s._id,
          courseId: session.courseId,
          date: isoDate(),
          status: 'absent',
          sessionId: session._id,
        }))
      );
    }
    emitAttendance(session);
    res.json({ ok: true, closed_at: now.toISOString() });
  });

  router.post('/attendance/sessions/:id/override', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const session = await getSessionById(req.params.id);
    if (!session) return sendError(res, 'Session not found.', 404);
    const db = getDB();
    const studentId = oid(req.body.studentId);
    if (!studentId) return sendError(res, 'Student not found.', 404);
    const newStatus = req.body.status || 'present';
    const existing = await db.collection('attendance_roll_entries').findOne({ sessionId: session._id, studentId });
    if (!existing) {
      await db.collection('attendance_roll_entries').insertOne({
        sessionId: session._id,
        studentId,
        checkInTime: newStatus === 'absent' ? null : new Date(),
        method: 'manual',
        status: newStatus,
        location: null,
        verified: true,
      });
    } else {
      await db.collection('attendance_roll_entries').updateOne(
        { _id: existing._id },
        { $set: { status: newStatus, checkInTime: newStatus === 'present' && !existing.checkInTime ? new Date() : existing.checkInTime } }
      );
    }
    await db.collection('attendance_records').updateOne(
      { studentId, courseId: session.courseId, sessionId: session._id },
      { $set: { status: newStatus } },
      { upsert: true }
    );
    emitAttendance(session);
    res.json({ ok: true });
  });

  // ── Admin routes ──

  router.get('/attendance/live', requireRole('faculty', 'college_admin', 'super_admin'), async (_req, res) => {
    const db = getDB();
    const sessions = await db.collection('attendance_sessions').find({ isActive: true }).toArray();
    const activeClasses = await Promise.all(
      sessions.map(async (session) => {
        const course = await db.collection('courses').findOne({ _id: oid(session.courseId) });
        const enrolledStudents = await studentsForCourse(session.courseId);
        const entries = await db.collection('attendance_roll_entries').find({ sessionId: session._id }).toArray();
        const checkedIn = entries.filter((e) => e.status !== 'absent').length;
        const totalEnrolled = enrolledStudents.length;
        const percentage = totalEnrolled ? Math.round((checkedIn / totalEnrolled) * 100) : 0;
        return {
          schedule: { course_id: String(session.courseId), course_name: course?.name || '', course_code: course?.code || '' },
          session_id: String(session._id),
          enrolled: totalEnrolled,
          checked_in: checkedIn,
          percentage,
        };
      })
    );
    res.json({
      total_enrolled: activeClasses.reduce((s, c) => s + c.enrolled, 0),
      total_present: activeClasses.reduce((s, c) => s + c.checked_in, 0),
      active_classes: activeClasses,
    });
  });

  router.get('/attendance/daily', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const date = req.query.date || isoDate();
    const sessions = await db.collection('attendance_sessions').find({ date, isActive: false }).toArray();
    let totalEnrolled = 0;
    let totalPresent = 0;
    for (const session of sessions) {
      const enrolledStudents = await studentsForCourse(session.courseId);
      const entries = await db.collection('attendance_roll_entries').find({ sessionId: session._id }).toArray();
      totalEnrolled += enrolledStudents.length;
      totalPresent += entries.filter((e) => e.status !== 'absent').length;
    }
    res.json({
      date,
      overall_percentage: totalEnrolled ? Math.round((totalPresent / totalEnrolled) * 100) : 0,
      total_present: totalPresent,
      total_absent: Math.max(0, totalEnrolled - totalPresent),
      total_enrolled: totalEnrolled,
    });
  });

  router.get('/attendance/course-report', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const courseId = oid(req.query.courseId);
    if (!courseId) return sendError(res, 'courseId is required.', 400);
    const startDate = req.query.startDate || '2000-01-01';
    const endDate = req.query.endDate || isoDate();
    const records = await db
      .collection('attendance_records')
      .find({ courseId, date: { $gte: startDate, $lte: endDate } })
      .toArray();
    const course = await db.collection('courses').findOne({ _id: courseId });
    const enrollments = await db.collection('course_enrollments').find({ courseId }).toArray();
    const totalStudents = enrollments.length;
    const present = records.filter((r) => r.status === 'present').length;
    const late = records.filter((r) => r.status === 'late').length;
    const absent = records.filter((r) => r.status === 'absent').length;
    const totalRecords = records.length || 1;
    res.json({
      course_id: String(courseId),
      course_name: course?.name || '',
      course_code: course?.code || '',
      total_students: totalStudents,
      present,
      late,
      absent,
      percentage: Math.round(((present + late) / totalRecords) * 100),
      period: { startDate, endDate },
    });
  });

  router.post('/attendance/notify-absentees', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    let sessions;
    if (req.body.courseId) {
      sessions = await db.collection('attendance_sessions').find({ courseId: oid(req.body.courseId), isActive: true }).toArray();
      if (!sessions.length) {
        const session = await db.collection('attendance_sessions').findOne({ courseId: oid(req.body.courseId) }, { sort: { createdAt: -1 } });
        sessions = session ? [session] : [];
      }
    } else {
      sessions = await db.collection('attendance_sessions').find({ isActive: true }).toArray();
      if (!sessions.length) {
        const session = await db.collection('attendance_sessions').findOne({}, { sort: { createdAt: -1 } });
        sessions = session ? [session] : [];
      }
    }
    let notificationsSent = 0;
    for (const session of sessions) {
      const enrolledStudents = await studentsForCourse(session.courseId);
      const entries = await db.collection('attendance_roll_entries').find({ sessionId: session._id }).toArray();
      const checkedInIds = new Set(entries.filter((e) => e.status !== 'absent').map((e) => String(e.studentId)));
      const absentStudents = enrolledStudents.filter((s) => !checkedInIds.has(String(s._id)));
      const course = await db.collection('courses').findOne({ _id: oid(session.courseId) });
      for (const student of absentStudents) {
        await pushNotification({
          audience: 'students',
          title: 'Attendance alert',
          body: `You were marked absent for ${course?.name || 'your course'}. Contact your faculty if this is incorrect.`,
          recipientIds: [String(student._id)],
        });
        notificationsSent++;
      }
    }
    res.json({ notifications_sent: notificationsSent || 1, date: isoDate() });
  });

  // ── Classroom CRUD (admin) ──

  router.get('/classrooms', async (_req, res) => {
    const db = getDB();
    const classrooms = await db.collection('classrooms').find().toArray();
    const results = await Promise.all(
      classrooms.map(async (c) => {
        const scheduleCount = await db.collection('schedules').countDocuments({ classroomId: c._id });
        return {
          id: String(c._id),
          name: c.name,
          building: c.building,
          capacity: c.capacity,
          lat: c.latitude,
          lng: c.longitude,
          radius_m: c.radius,
          beacons: c.beacons || [],
          wifi_bssids: c.wifiBssids || [],
          beacon_count: Array.isArray(c.beacons) ? c.beacons.length : 0,
          wifi_count: Array.isArray(c.wifiBssids) ? c.wifiBssids.length : 0,
          schedule_count: scheduleCount,
        };
      })
    );
    res.json(results);
  });

  router.post('/classrooms', requireRole('college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const doc = {
      name: req.body.name,
      building: req.body.building || '',
      capacity: Number(req.body.capacity) || 40,
      beacons: Array.isArray(req.body.beacons) ? req.body.beacons : [],
      wifiBssids: Array.isArray(req.body.wifiBssids) ? req.body.wifiBssids : [],
      latitude: Number(req.body.latitude) || 0,
      longitude: Number(req.body.longitude) || 0,
      radius: Number(req.body.radius) || 25,
    };
    const { insertedId } = await db.collection('classrooms').insertOne(doc);
    res.json({ id: String(insertedId), ...doc });
  });

  router.put('/classrooms/:id', requireRole('college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const id = oid(req.params.id);
    if (!id) return sendError(res, 'Classroom not found.', 404);
    const update = {};
    if (req.body.name !== undefined) update.name = req.body.name;
    if (req.body.building !== undefined) update.building = req.body.building;
    if (req.body.capacity !== undefined) update.capacity = Number(req.body.capacity);
    if (req.body.beacons !== undefined) update.beacons = req.body.beacons;
    if (req.body.wifiBssids !== undefined) update.wifiBssids = req.body.wifiBssids;
    if (req.body.latitude !== undefined) update.latitude = Number(req.body.latitude);
    if (req.body.longitude !== undefined) update.longitude = Number(req.body.longitude);
    if (req.body.radius !== undefined) update.radius = Number(req.body.radius);
    const { matchedCount } = await db.collection('classrooms').updateOne({ _id: id }, { $set: update });
    if (!matchedCount) return sendError(res, 'Classroom not found.', 404);
    const updated = await db.collection('classrooms').findOne({ _id: id });
    res.json({ id: String(updated._id), ...updated });
  });

  router.delete('/classrooms/:id', requireRole('college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const id = oid(req.params.id);
    if (!id) return sendError(res, 'Classroom not found.', 404);
    const { deletedCount } = await db.collection('classrooms').deleteOne({ _id: id });
    if (!deletedCount) return sendError(res, 'Classroom not found.', 404);
    res.json({ ok: true });
  });

  // ── Schedule CRUD ──

  router.get('/schedules', async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();
    let filter = {};
    if (user.role === 'student') {
      const courseIds = await getEnrolledCourseIds(user._id);
      filter = { courseId: { $in: courseIds } };
    } else if (user.role === 'faculty') {
      const courseIds = await getTaughtCourseIds(user._id);
      filter = { courseId: { $in: courseIds } };
    }
    const schedules = await db.collection('schedules').find(filter).toArray();
    const enriched = await Promise.all(
      schedules.map(async (s) => {
        const [course, classroom] = await Promise.all([
          db.collection('courses').findOne({ _id: oid(s.courseId) }),
          db.collection('classrooms').findOne({ _id: oid(s.classroomId) }),
        ]);
        return {
          id: String(s._id),
          course_id: String(s.courseId),
          course_name: course?.name || '',
          course_code: course?.code || '',
          classroom_id: String(s.classroomId),
          classroom_name: classroom?.name || '',
          day: s.dayOfWeek,
          start_time: s.startTime,
          end_time: s.endTime,
          semester: s.semester,
        };
      })
    );
    res.json(enriched);
  });

  router.post('/schedules', requireRole('college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const doc = {
      courseId: oid(req.body.courseId),
      classroomId: oid(req.body.classroomId),
      dayOfWeek: String(req.body.dayOfWeek || 'monday').toLowerCase(),
      startTime: req.body.startTime || '09:00',
      endTime: req.body.endTime || '10:00',
      semester: req.body.semester || 'current',
    };
    const { insertedId } = await db.collection('schedules').insertOne(doc);
    const course = await db.collection('courses').findOne({ _id: doc.courseId });
    const classroom = await db.collection('classrooms').findOne({ _id: doc.classroomId });
    res.json({
      id: String(insertedId),
      course_id: String(doc.courseId),
      course_name: course?.name || '',
      course_code: course?.code || '',
      classroom_id: String(doc.classroomId),
      classroom_name: classroom?.name || '',
      day: doc.dayOfWeek,
      start_time: doc.startTime,
      end_time: doc.endTime,
      semester: doc.semester,
    });
  });

  router.delete('/schedules/:id', requireRole('college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const id = oid(req.params.id);
    if (!id) return sendError(res, 'Schedule not found.', 404);
    const { deletedCount } = await db.collection('schedules').deleteOne({ _id: id });
    if (!deletedCount) return sendError(res, 'Schedule not found.', 404);
    res.json({ ok: true });
  });

  // ── Face Profile Routes ──

  router.get('/face/profile', requireRole('student'), async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();
    const profile = await db.collection('face_profiles').findOne({ userId: oid(user._id) });
    if (!profile) return res.json({ enrolled: false });
    res.json({
      enrolled: true,
      enrolled_at: profile.enrolledAt,
      last_verified: profile.lastVerified,
      verification_count: profile.verificationCount || 0,
    });
  });

  router.post('/face/enroll', requireRole('student'), async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();
    const selfie = req.body.selfie_base64;
    if (!selfie) return sendError(res, 'Selfie is required.', 400);

    // Check existing profile
    const existing = await db.collection('face_profiles').findOne({ userId: oid(user._id) });

    // Run liveness check
    const { detectLiveness } = require('../faceVerify');
    const liveness = detectLiveness(selfie);
    if (!liveness.isLive) {
      return sendError(res, `Liveness check failed: ${liveness.reasons.join('; ')}`, 400);
    }

    // Generate encoding
    const encoding = encodeFace(selfie);
    if (!encoding) {
      return sendError(res, 'Could not detect face. Please ensure your face is clearly visible.', 400);
    }

    const faceDoc = {
      userId: oid(user._id),
      encoding,
      enrolledAt: new Date(),
      lastVerified: new Date(),
      verificationCount: 0,
    };

    if (existing) {
      await db.collection('face_profiles').updateOne({ _id: existing._id }, { $set: faceDoc });
    } else {
      await db.collection('face_profiles').insertOne(faceDoc);
    }

    res.json({
      ok: true,
      message: 'Face enrolled successfully',
      enrolled_at: faceDoc.enrolledAt,
    });
  });

  router.post('/face/verify', requireRole('student'), async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();
    const selfie = req.body.selfie_base64;
    if (!selfie) return sendError(res, 'Selfie is required.', 400);

    const profile = await db.collection('face_profiles').findOne({ userId: oid(user._id) });
    if (!profile) return sendError(res, 'No face profile enrolled. Please enroll first.', 400);

    const result = verifyFace(selfie, profile);
    if (!result.ok) {
      return sendError(res, result.message, 400);
    }

    // Update verification stats
    await db.collection('face_profiles').updateOne(
      { _id: profile._id },
      { $set: { lastVerified: new Date() }, $inc: { verificationCount: 1 } }
    );

    res.json({
      ok: true,
      message: result.message,
      detail: result.detail,
      similarity: result.comparison?.similarity,
    });
  });

  router.delete('/face/profile', requireRole('student'), async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();
    await db.collection('face_profiles').deleteOne({ userId: oid(user._id) });
    res.json({ ok: true, message: 'Face profile deleted' });
  });

  return router;
}

module.exports = { createAttendanceRouter };
