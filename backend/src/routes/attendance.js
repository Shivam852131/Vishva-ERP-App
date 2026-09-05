const express = require('express');
const { getDB, oid } = require('../db');
const { authUser, requireRole, collegeFilter, requireCollegeAccess } = require('../auth');
const { serializeUser, sendError, makeCode, nowIso, isoDate, emitToCollege } = require('../utils');
const { verifyFace, encodeFace } = require('../faceVerify');

function createAttendanceRouter(io) {
  const router = express.Router();

  function emitAttendance(session, collegeId) {
    const sid = String(session._id);
    emitToCollege(io, collegeId, 'attendance:session:update', { sessionId: sid });
    emitToCollege(io, collegeId, 'attendance:active-sessions:update', { sessionId: sid, courseId: String(session.courseId) });
    emitToCollege(io, collegeId, 'attendance:live:update', { sessionId: sid, courseId: String(session.courseId) });
  }

  function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const phi1 = (Number(lat1) * Math.PI) / 180;
    const phi2 = (Number(lat2) * Math.PI) / 180;
    const deltaPhi = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
    const deltaLambda = ((Number(lon2) - Number(lon1)) * Math.PI) / 180;
    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async function pushNotification(req, { audience = 'all', title, body, recipientIds = [] }) {
    const db = getDB();
    const doc = { audience, title, body, recipientIds: recipientIds.map(String), readBy: [], createdAt: new Date(), collegeId: oid(req.userCollegeId) };
    const { insertedId } = await db.collection('notifications').insertOne(doc);
    emitToCollege(io, req.userCollegeId, 'notifications:update', { audience, recipientIds });
    return { _id: insertedId, ...doc };
  }

  async function getSessionById(req, sid) {
    const db = getDB();
    const id = oid(sid);
    if (!id) return null;
    return db.collection('attendance_sessions').findOne({ _id: id, ...collegeFilter(req) });
  }

  async function getSessionWithDetails(req, sid) {
    const db = getDB();
    const id = oid(sid);
    if (!id) return null;
    const session = await db.collection('attendance_sessions').findOne({ _id: id, ...collegeFilter(req) });
    if (!session) return null;
    const [entries, course] = await Promise.all([
      db.collection('attendance_roll_entries').find({ sessionId: id, ...collegeFilter(req) }).toArray(),
      db.collection('courses').findOne({ _id: oid(session.courseId), ...collegeFilter(req) }),
    ]);
    const students = await Promise.all(
      entries.map(async (entry) => {
        const student = await db.collection('users').findOne({ _id: oid(entry.studentId), ...collegeFilter(req) });
        return { ...entry, student };
      })
    );
    return { ...session, rollEntries: students, course };
  }

  async function studentsForCourse(req, courseId) {
    const db = getDB();
    const cid = oid(courseId);
    if (!cid) return [];
    const courseIdValues = [cid, String(courseId)];
    const enrollments = await db.collection('course_enrollments').find({ courseId: { $in: courseIdValues }, ...collegeFilter(req) }).toArray();
    const studentIds = enrollments.map((e) => oid(e.studentId)).filter(Boolean);
    const studentStrs = enrollments.map((e) => String(e.studentId)).filter(Boolean);
    if (!studentIds.length && !studentStrs.length) return [];
    return db.collection('users').find({ _id: { $in: [...studentIds, ...studentStrs] }, ...collegeFilter(req) }).toArray();
  }

  async function getEnrolledCourseIds(req, studentId) {
    const db = getDB();
    const sid = oid(studentId);
    if (!sid) return [];
    const studentIdValues = [sid, String(studentId)];
    const enrollments = await db.collection('course_enrollments').find({ studentId: { $in: studentIdValues }, ...collegeFilter(req) }).toArray();
    const oids = enrollments.map((e) => oid(e.courseId)).filter(Boolean);
    const strs = enrollments.map((e) => String(e.courseId)).filter(Boolean);
    return [...oids, ...strs];
  }

  async function getTaughtCourseIds(req, facultyId) {
    const db = getDB();
    const fid = oid(facultyId);
    if (!fid) return [];
    const facultyValues = [fid, String(facultyId)];
    const courses = await db.collection('courses').find({ facultyId: { $in: facultyValues }, ...collegeFilter(req) }).toArray();
    return courses.map((c) => c._id);
  }

  // ── Student routes ──

  router.get('/attendance/me', async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();
    const uid = oid(user._id);
    const userId = String(user._id);
    const { paginationParams: pp } = require('../utils');
    const { skip, limit: pgLimit } = pp(req.query, { defaultSize: 100, maxSize: 500 });
    const filter = { studentId: { $in: [uid, userId] }, ...collegeFilter(req) };
    if (req.query.courseId) filter.courseId = oid(req.query.courseId);
    const total = await db.collection('attendance_records').countDocuments(filter);
    const records = await db.collection('attendance_records').find(filter).sort({ date: -1 }).skip(skip).limit(pgLimit).toArray();
    const courseIdsRaw = [...new Set(records.map((r) => String(r.courseId)))];
    const courseOids = courseIdsRaw.map(oid).filter(Boolean);
    const courses = courseOids.length || courseIdsRaw.length
      ? await db.collection('courses').find({ _id: { $in: [...courseOids, ...courseIdsRaw] }, ...collegeFilter(req) }).toArray()
      : [];
    const courseMap = Object.fromEntries(courses.map((c) => [String(c._id), c]));
    const mappedRecords = records.map((r) => ({
      id: String(r._id),
      courseId: String(r.courseId),
      course_id: String(r.courseId),
      date: r.date,
      status: r.status,
      present: r.status === 'present' || r.status === 'late',
      courseName: courseMap[String(r.courseId)]?.name || '',
      course_name: courseMap[String(r.courseId)]?.name || '',
    }));

    // Aggregate by course
    const courseStats = {};
    for (const r of records) {
      const cid = String(r.courseId);
      if (!courseStats[cid]) courseStats[cid] = { total: 0, present: 0 };
      courseStats[cid].total++;
      if (r.status === 'present' || r.status === 'late') courseStats[cid].present++;
    }
    const byCourse = Object.entries(courseStats).map(([cid, stats]) => ({
      course_id: cid,
      course_name: courseMap[cid]?.name || '',
      total: stats.total,
      present: stats.present,
      percentage: stats.total ? Math.round((stats.present / stats.total) * 100) : 0,
    }));

    res.json({ records: mappedRecords, by_course: byCourse });
  });

  router.get('/attendance/sessions/active', async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();
    const courseIds = await getEnrolledCourseIds(req, user._id);
    if (!courseIds.length) return res.json({ sessions: [], face_enrolled: false });
    const sessions = await db
      .collection('attendance_sessions')
      .find({ courseId: { $in: courseIds }, isActive: true, ...collegeFilter(req) })
      .toArray();
    const enriched = await Promise.all(
      sessions.map(async (session) => {
        const [course, faculty, entries] = await Promise.all([
          db.collection('courses').findOne({ _id: oid(session.courseId), ...collegeFilter(req) }),
          session.facultyId ? db.collection('users').findOne({ _id: oid(session.facultyId), ...collegeFilter(req) }) : null,
          db.collection('attendance_roll_entries').find({ sessionId: session._id, ...collegeFilter(req) }).toArray(),
        ]);
        const checkedIn = entries.some((e) => String(e.studentId) === String(user._id) && e.status !== 'absent');
        const lat = session.location?.lat ?? null;
        const lng = session.location?.lng ?? null;
        const radius_m = session.radius || 150;
        return {
          id: String(session._id),
          course_id: String(session.courseId),
          course_name: course?.name || '',
          course_code: course?.code || '',
          faculty_name: faculty?.name || '',
          starts_at: session.startTime instanceof Date ? session.startTime.toISOString() : session.startTime,
          expires_at: session.endTime instanceof Date ? session.endTime.toISOString() : session.endTime,
          method: session.type,
          checked_in: checkedIn,
          code: session.qrCode,
          lat,
          lng,
          radius_m,
          location: session.location || null,
        };
      })
    );
    const userId = String(user._id);
    const faceProfile = await db.collection('face_profiles').findOne({ userId: { $in: [oid(user._id), userId] }, ...collegeFilter(req) });
    res.json({ sessions: enriched, face_enrolled: !!faceProfile });
  });

  router.get('/attendance/sessions/mine', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const user = await authUser(req);
    const db = getDB();
    const fid = oid(user._id);
    const sessions = await db
      .collection('attendance_sessions')
      .find({ facultyId: fid, ...collegeFilter(req) })
      .sort({ createdAt: -1 })
      .toArray();
    const enriched = await Promise.all(
      sessions.map(async (session) => {
        const course = await db.collection('courses').findOne({ _id: oid(session.courseId), ...collegeFilter(req) });
        const entries = await db.collection('attendance_roll_entries').find({ sessionId: session._id, ...collegeFilter(req) }).toArray();
        const checkins = entries.filter((e) => e.status !== 'absent').length;
        return {
          id: String(session._id),
          course_id: String(session.courseId),
          course_name: course?.name || '',
          course_code: course?.code || '',
          method: session.type,
          code: session.qrCode,
          starts_at: session.startTime instanceof Date ? session.startTime.toISOString() : session.startTime,
          expires_at: session.endTime instanceof Date ? session.endTime.toISOString() : session.endTime,
          active: session.isActive,
          checkins,
          lat: session.location?.lat ?? null,
          lng: session.location?.lng ?? null,
          radius_m: session.radius || 150,
        };
      })
    );
    res.json(enriched);
  });

  router.post('/attendance/sessions', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const user = await authUser(req);
    const db = getDB();
    const courseId = req.body.courseId || req.body.course_id;
    if (!courseId) return sendError(res, 'Course is required.', 400);
    const course = await db.collection('courses').findOne({
      $or: [{ _id: oid(courseId) }, { _id: String(courseId) }],
      ...collegeFilter(req),
    });
    if (!course) return sendError(res, 'Course not found.', 404);

    const type = req.body.type || req.body.method || 'qr';
    const startTime = new Date(req.body.startTime || req.body.starts_at || nowIso());
    let endTime = req.body.endTime || req.body.expires_at || null;
    const durationMin = Number(req.body.duration_min || req.body.durationMin || req.body.duration);
    if (!endTime && durationMin > 0) {
      endTime = new Date(startTime.getTime() + durationMin * 60 * 1000);
    } else if (endTime) {
      endTime = new Date(endTime);
    }

    let location = req.body.location || null;
    if (!location && req.body.lat !== undefined && req.body.lng !== undefined) {
      location = { lat: Number(req.body.lat), lng: Number(req.body.lng) };
    }
    const radius = Number(req.body.radius || req.body.radius_m) || 150;

    const doc = {
      courseId: course._id,
      facultyId: oid(user._id),
      date: req.body.date || isoDate(),
      type,
      qrCode: req.body.qrCode || req.body.code || makeCode(),
      startTime,
      endTime,
      isActive: true,
      location,
      radius,
      createdAt: new Date(),
      collegeId: oid(req.userCollegeId),
    };
    const { insertedId } = await db.collection('attendance_sessions').insertOne(doc);
    const session = { _id: insertedId, ...doc };
    emitAttendance(session, req.userCollegeId);
    res.json({
      id: String(insertedId),
      course_id: String(course._id),
      course_name: course.name,
      method: doc.type,
      code: doc.qrCode,
      starts_at: doc.startTime instanceof Date ? doc.startTime.toISOString() : doc.startTime,
      expires_at: doc.endTime instanceof Date ? doc.endTime.toISOString() : doc.endTime,
      active: true,
      checkins: 0,
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
      radius_m: radius,
    });
  });

  router.get('/attendance/sessions/:id', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const session = await getSessionWithDetails(req, req.params.id);
    if (!session) return sendError(res, 'Session not found.', 404);
    const enrolledStudents = await studentsForCourse(req, session.courseId);
    const roll = session.rollEntries
      .filter((e) => e.status !== 'absent')
      .map((e) => ({
        name: e.student?.name || '',
        student_id: e.student?.studentCode || String(e.studentId),
        student_code: e.student?.studentCode || '',
        check_in: e.checkInTime instanceof Date ? e.checkInTime.toISOString() : e.checkInTime,
        method: e.method,
        status: e.status,
      }));
    res.json({
      session: {
        id: String(session._id),
        course_name: session.course?.name || '',
        course_code: session.course?.code || '',
        method: session.type,
        code: session.qrCode,
        starts_at: session.startTime instanceof Date ? session.startTime.toISOString() : session.startTime,
        expires_at: session.endTime instanceof Date ? session.endTime.toISOString() : session.endTime,
        active: session.isActive,
        lat: session.location?.lat ?? null,
        lng: session.location?.lng ?? null,
        radius_m: session.radius || 150,
      },
      roll,
      enrolled: enrolledStudents.length,
    });
  });

  router.post('/attendance/checkin', requireRole('student'), async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();
    const session = await getSessionById(req, req.body.sessionId || req.body.session_id);
    if (!session) return sendError(res, 'Session not found.', 404);
    if (!session.isActive) return sendError(res, 'This session has ended.');
    const uid = oid(user._id);
    const enrolled = await db.collection('course_enrollments').findOne({
      studentId: { $in: [uid, String(user._id)] },
      courseId: { $in: [oid(session.courseId), String(session.courseId)] },
      ...collegeFilter(req),
    });
    if (!enrolled) return sendError(res, 'You are not enrolled in this class.');
    const existing = await db.collection('attendance_roll_entries').findOne({
      sessionId: session._id,
      studentId: { $in: [uid, String(user._id)] },
      status: { $ne: 'absent' },
      ...collegeFilter(req),
    });
    if (existing) return sendError(res, 'You are already checked in.');

    // Normalize location
    let studentLocation = req.body.location || null;
    if (!studentLocation && req.body.lat !== undefined && req.body.lng !== undefined) {
      studentLocation = { lat: Number(req.body.lat), lng: Number(req.body.lng) };
    }

    const method = req.body.method || session.type || (studentLocation ? 'gps' : 'qr');

    // ── Location / GPS verification ──
    if (method === 'gps' || method === 'auto' || session.type === 'gps' || session.type === 'location') {
      if (session.location?.lat !== undefined && session.location?.lat !== null && session.location?.lng !== undefined && session.location?.lng !== null) {
        if (!studentLocation || studentLocation.lat === undefined || studentLocation.lng === undefined) {
          return sendError(res, 'Location coordinates are required for GPS check-in.', 400);
        }
        const dist = haversineDistanceMeters(
          studentLocation.lat,
          studentLocation.lng,
          session.location.lat,
          session.location.lng
        );
        const allowedRadius = Number(session.radius) || 150;
        if (dist > allowedRadius) {
          return sendError(res, `Outside classroom geofence (${Math.round(dist)}m away, limit is ${allowedRadius}m).`, 400);
        }
      }
    }

    // ── Face verification ──
    if (method === 'face' || req.body.selfie_base64) {
      const selfie = req.body.selfie_base64;
      if (!selfie) return sendError(res, 'Selfie is required for face check-in.', 400);

      // Get enrolled face profile
      const faceProfile = await db.collection('face_profiles').findOne({ userId: { $in: [uid, String(user._id)] }, ...collegeFilter(req) });

      // Run face verification pipeline
      const result = await verifyFace(selfie, faceProfile, req.body.prev_frame_base64 || null);

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
          collegeId: oid(req.userCollegeId),
        };
        if (faceProfile) {
          await db.collection('face_profiles').updateOne({ _id: faceProfile._id, ...collegeFilter(req) }, { $set: faceDoc });
        } else {
          await db.collection('face_profiles').insertOne(faceDoc);
        }
      } else {
        // Update last verified and count
        await db.collection('face_profiles').updateOne(
          { _id: faceProfile._id, ...collegeFilter(req) },
          { $set: { lastVerified: new Date() }, $inc: { verificationCount: 1 } }
        );
      }
    }

    // ── QR verification ──
    const submittedCode = req.body.qrCode || req.body.code;
    const isQrSession = method === 'qr' || session.type === 'qr';
    if (isQrSession && session.qrCode) {
      if (!submittedCode) {
        return sendError(res, 'Attendance code is required.', 400);
      }
      if (String(submittedCode).trim() !== String(session.qrCode).trim()) {
        return sendError(res, 'Attendance code does not match.', 400);
      }
    }

    // ── Calculate status (present vs late based on session startTime and grace period) ──
    const now = new Date();
    const graceMs = (session.graceMinutes ? Number(session.graceMinutes) : 15) * 60 * 1000;
    const startTime = session.startTime instanceof Date ? session.startTime : session.startTime ? new Date(session.startTime) : null;
    let status = 'present';
    if (startTime && !isNaN(startTime.getTime()) && (now.getTime() - startTime.getTime() > graceMs)) {
      status = 'late';
    }

    const isVerified = method === 'face'
      ? true
      : isQrSession
        ? (submittedCode && String(submittedCode).trim() === String(session.qrCode).trim())
        : true;

    // Check if there was an absent roll entry that we are replacing or if new
    const prevRoll = await db.collection('attendance_roll_entries').findOne({
      sessionId: session._id,
      studentId: uid,
      ...collegeFilter(req),
    });
    if (prevRoll) {
      await db.collection('attendance_roll_entries').updateOne(
        { _id: prevRoll._id },
        {
          $set: {
            checkInTime: now,
            method,
            status,
            location: studentLocation,
            verified: isVerified,
          },
        }
      );
    } else {
      await db.collection('attendance_roll_entries').insertOne({
        sessionId: session._id,
        studentId: uid,
        checkInTime: now,
        method,
        status,
        location: studentLocation,
        verified: isVerified,
        collegeId: oid(req.userCollegeId),
      });
    }

    await db.collection('attendance_records').updateOne(
      { studentId: uid, courseId: session.courseId, sessionId: session._id },
      {
        $set: {
          status,
          date: session.date || isoDate(),
          method,
        },
        $setOnInsert: {
          collegeId: oid(req.userCollegeId),
        },
      },
      { upsert: true }
    );

    emitAttendance(session, req.userCollegeId);
    const course = await db.collection('courses').findOne({ _id: oid(session.courseId), ...collegeFilter(req) });
    await pushNotification(req, { audience: 'students', title: 'Attendance confirmed', body: `${course?.name || 'Course'} check-in recorded.` });
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
    const session = await getSessionById(req, req.params.id);
    if (!session) return sendError(res, 'Session not found.', 404);
    const db = getDB();
    const now = new Date();
    if (!session.isActive) {
      return res.json({
        ok: true,
        message: 'Session is already closed.',
        closed_at: session.endTime instanceof Date ? session.endTime.toISOString() : session.endTime,
      });
    }
    await db.collection('attendance_sessions').updateOne({ _id: session._id, ...collegeFilter(req) }, { $set: { isActive: false, endTime: now } });
    const enrolledStudents = await studentsForCourse(req, session.courseId);
    const entries = await db.collection('attendance_roll_entries').find({ sessionId: session._id, ...collegeFilter(req) }).toArray();
    const checkedInIds = new Set(entries.filter((e) => e.status !== 'absent').map((e) => String(e.studentId)));
    const absentStudents = enrolledStudents.filter((s) => !checkedInIds.has(String(s._id)));
    if (absentStudents.length) {
      const ops = absentStudents.map((s) => ({
        updateOne: {
          filter: { studentId: s._id, courseId: session.courseId, sessionId: session._id },
          update: {
            $set: { status: 'absent', date: session.date || isoDate(), method: 'auto-absent' },
            $setOnInsert: { collegeId: oid(req.userCollegeId) },
          },
          upsert: true,
        },
      }));
      await db.collection('attendance_records').bulkWrite(ops);
    }
    emitAttendance({ ...session, isActive: false, endTime: now }, req.userCollegeId);
    res.json({ ok: true, closed_at: now.toISOString() });
  });

  router.post('/attendance/sessions/:id/override', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const session = await getSessionById(req, req.params.id);
    if (!session) return sendError(res, 'Session not found.', 404);
    const db = getDB();
    const studentId = oid(req.body.studentId || req.body.student_id);
    if (!studentId) return sendError(res, 'Student not found.', 404);
    const newStatus = req.body.status || 'present';
    const existing = await db.collection('attendance_roll_entries').findOne({
      sessionId: session._id,
      studentId: { $in: [studentId, String(studentId)] },
      ...collegeFilter(req),
    });
    if (!existing) {
      await db.collection('attendance_roll_entries').insertOne({
        sessionId: session._id,
        studentId,
        checkInTime: newStatus === 'absent' ? null : new Date(),
        method: 'manual',
        status: newStatus,
        location: null,
        verified: true,
        overrideReason: req.body.reason || 'Manual override',
        collegeId: oid(req.userCollegeId),
      });
    } else {
      await db.collection('attendance_roll_entries').updateOne(
        { _id: existing._id },
        {
          $set: {
            status: newStatus,
            checkInTime: newStatus === 'present' && !existing.checkInTime ? new Date() : existing.checkInTime,
            overrideReason: req.body.reason || 'Manual override',
          },
        }
      );
    }
    await db.collection('attendance_records').updateOne(
      { studentId, courseId: session.courseId, sessionId: session._id },
      {
        $set: { status: newStatus, method: 'manual' },
        $setOnInsert: { collegeId: oid(req.userCollegeId), date: session.date || isoDate() },
      },
      { upsert: true }
    );
    emitAttendance(session, req.userCollegeId);
    res.json({ ok: true, status: newStatus });
  });

  // ── Admin routes ──

  router.get('/attendance/live', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const sessions = await db.collection('attendance_sessions').find({ isActive: true, ...collegeFilter(req) }).toArray();
    const activeClasses = await Promise.all(
      sessions.map(async (session) => {
        const course = await db.collection('courses').findOne({ _id: oid(session.courseId), ...collegeFilter(req) });
        const enrolledStudents = await studentsForCourse(req, session.courseId);
        const entries = await db.collection('attendance_roll_entries').find({ sessionId: session._id, ...collegeFilter(req) }).toArray();
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
    const sessions = await db.collection('attendance_sessions').find({ date, isActive: false, ...collegeFilter(req) }).toArray();
    let totalEnrolled = 0;
    let totalPresent = 0;
    for (const session of sessions) {
      const enrolledStudents = await studentsForCourse(req, session.courseId);
      const entries = await db.collection('attendance_roll_entries').find({ sessionId: session._id, ...collegeFilter(req) }).toArray();
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

  router.get('/attendance/reports', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const days = parseInt(req.query.days) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];

    const sessions = await db.collection('attendance_sessions')
      .find({ date: { $gte: sinceStr }, ...collegeFilter(req) })
      .limit(500)
      .toArray();

    const sessionIds = sessions.map(s => s._id);
    const entries = sessionIds.length
      ? await db.collection('attendance_roll_entries')
          .find({ sessionId: { $in: sessionIds }, ...collegeFilter(req) })
          .limit(5000)
          .toArray()
      : [];

    const records = await db.collection('attendance_records')
      .find({ date: { $gte: sinceStr }, ...collegeFilter(req) })
      .limit(5000)
      .toArray();

    const totalSessions = sessions.length;
    const totalPresent = entries.filter(e => e.status !== 'absent').length;
    const totalAbsent = entries.filter(e => e.status === 'absent').length;
    const totalStudentRecords = records.length;
    const totalStudentPresent = records.filter(r => r.status === 'present' || r.status === 'late').length;

    const courseStats = {};
    for (const session of sessions) {
      const cid = String(session.courseId);
      if (!courseStats[cid]) courseStats[cid] = { course_id: cid, sessions: 0, present: 0, absent: 0 };
      courseStats[cid].sessions++;
      const sessionEntries = entries.filter(e => String(e.sessionId) === String(session._id));
      courseStats[cid].present += sessionEntries.filter(e => e.status !== 'absent').length;
      courseStats[cid].absent += sessionEntries.filter(e => e.status === 'absent').length;
    }

    res.json({
      period_days: days,
      total_sessions: totalSessions,
      overall: {
        present: totalPresent,
        absent: totalAbsent,
        percentage: (totalPresent + totalAbsent) > 0 ? Math.round((totalPresent / (totalPresent + totalAbsent)) * 100) : 0,
      },
      student_records: {
        total: totalStudentRecords,
        present: totalStudentPresent,
        percentage: totalStudentRecords > 0 ? Math.round((totalStudentPresent / totalStudentRecords) * 100) : 0,
      },
      by_course: Object.values(courseStats),
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
      .find({ courseId, date: { $gte: startDate, $lte: endDate }, ...collegeFilter(req) })
      .toArray();
    const course = await db.collection('courses').findOne({ _id: courseId, ...collegeFilter(req) });
    const enrollments = await db.collection('course_enrollments').find({ courseId, ...collegeFilter(req) }).toArray();
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
      sessions = await db.collection('attendance_sessions').find({ courseId: oid(req.body.courseId), isActive: true, ...collegeFilter(req) }).toArray();
      if (!sessions.length) {
        const session = await db.collection('attendance_sessions').findOne({ courseId: oid(req.body.courseId), ...collegeFilter(req) }, { sort: { createdAt: -1 } });
        sessions = session ? [session] : [];
      }
    } else {
      sessions = await db.collection('attendance_sessions').find({ isActive: true, ...collegeFilter(req) }).toArray();
      if (!sessions.length) {
        const session = await db.collection('attendance_sessions').findOne({ ...collegeFilter(req) }, { sort: { createdAt: -1 } });
        sessions = session ? [session] : [];
      }
    }
    let notificationsSent = 0;
    for (const session of sessions) {
      const enrolledStudents = await studentsForCourse(req, session.courseId);
      const entries = await db.collection('attendance_roll_entries').find({ sessionId: session._id, ...collegeFilter(req) }).toArray();
      const checkedInIds = new Set(entries.filter((e) => e.status !== 'absent').map((e) => String(e.studentId)));
      const absentStudents = enrolledStudents.filter((s) => !checkedInIds.has(String(s._id)));
      const course = await db.collection('courses').findOne({ _id: oid(session.courseId), ...collegeFilter(req) });
      for (const student of absentStudents) {
        await pushNotification(req, {
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

  router.get('/classrooms', async (req, res) => {
    const db = getDB();
    const classrooms = await db.collection('classrooms').find({ ...collegeFilter(req) }).toArray();
    const results = await Promise.all(
      classrooms.map(async (c) => {
        const scheduleCount = await db.collection('schedules').countDocuments({ classroomId: c._id, ...collegeFilter(req) });
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
      collegeId: oid(req.userCollegeId),
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
    const { matchedCount } = await db.collection('classrooms').updateOne({ _id: id, ...collegeFilter(req) }, { $set: update });
    if (!matchedCount) return sendError(res, 'Classroom not found.', 404);
    const updated = await db.collection('classrooms').findOne({ _id: id, ...collegeFilter(req) });
    res.json({ id: String(updated._id), ...updated });
  });

  router.delete('/classrooms/:id', requireRole('college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const id = oid(req.params.id);
    if (!id) return sendError(res, 'Classroom not found.', 404);
    const { deletedCount } = await db.collection('classrooms').deleteOne({ _id: id, ...collegeFilter(req) });
    if (!deletedCount) return sendError(res, 'Classroom not found.', 404);
    res.json({ ok: true });
  });

  // ── Schedule CRUD ──

  router.get('/schedules', async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();
    let filter = { ...collegeFilter(req) };
    if (user.role === 'student') {
      const courseIds = await getEnrolledCourseIds(req, user._id);
      filter.courseId = { $in: courseIds };
    } else if (user.role === 'faculty') {
      const courseIds = await getTaughtCourseIds(req, user._id);
      filter.courseId = { $in: courseIds };
    }
    const schedules = await db.collection('schedules').find(filter).toArray();
    const enriched = await Promise.all(
      schedules.map(async (s) => {
        const [course, classroom] = await Promise.all([
          db.collection('courses').findOne({ _id: oid(s.courseId), ...collegeFilter(req) }),
          db.collection('classrooms').findOne({ _id: oid(s.classroomId), ...collegeFilter(req) }),
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
      collegeId: oid(req.userCollegeId),
    };
    const { insertedId } = await db.collection('schedules').insertOne(doc);
    const course = await db.collection('courses').findOne({ _id: doc.courseId, ...collegeFilter(req) });
    const classroom = await db.collection('classrooms').findOne({ _id: doc.classroomId, ...collegeFilter(req) });
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
    const { deletedCount } = await db.collection('schedules').deleteOne({ _id: id, ...collegeFilter(req) });
    if (!deletedCount) return sendError(res, 'Schedule not found.', 404);
    res.json({ ok: true });
  });

  // ── Face Profile Routes ──

  router.get('/face/profile', requireRole('student'), async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();
    const profile = await db.collection('face_profiles').findOne({ userId: oid(user._id), ...collegeFilter(req) });
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
    const existing = await db.collection('face_profiles').findOne({ userId: oid(user._id), ...collegeFilter(req) });

    // Run full encode pipeline (ML or fallback + liveness)
    const encodeResult = await encodeFace(selfie);
    if (!encodeResult.ok) {
      return sendError(res, 'Could not detect face. Please ensure your face is clearly visible.', 400);
    }
    if (encodeResult.liveness && !encodeResult.liveness.isLive) {
      return sendError(res, `Liveness check failed: ${encodeResult.liveness.reasons?.join('; ') || 'Motion required'}`, 400);
    }

    const faceDoc = {
      userId: oid(user._id),
      encoding: encodeResult.encoding,
      enrolledAt: new Date(),
      lastVerified: new Date(),
      verificationCount: 0,
      livenessHistory: [],
      collegeId: oid(req.userCollegeId),
    };

    if (existing) {
      await db.collection('face_profiles').updateOne({ _id: existing._id, ...collegeFilter(req) }, { $set: faceDoc });
    } else {
      await db.collection('face_profiles').insertOne(faceDoc);
    }

    res.json({
      ok: true,
      message: 'Face enrolled successfully',
      enrolled_at: faceDoc.enrolledAt,
      ml_used: encodeResult.ml,
    });
  });

  router.post('/face/blink-report', requireRole('student'), async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();
    const { eyeAspectRatio, frameIndex } = req.body;
    if (eyeAspectRatio === undefined) return sendError(res, 'eyeAspectRatio is required.', 400);

    const profile = await db.collection('face_profiles').findOne({ userId: oid(user._id), ...collegeFilter(req) });
    if (!profile) return sendError(res, 'No face profile enrolled.', 400);

    const history = Array.isArray(profile.livenessHistory) ? profile.livenessHistory : [];
    history.push({ ear: Number(eyeAspectRatio), ts: Date.now(), fi: frameIndex || 0 });
    // Keep last 60 entries (~2 seconds at 30fps)
    if (history.length > 60) history.splice(0, history.length - 60);

    await db.collection('face_profiles').updateOne(
      { _id: profile._id, ...collegeFilter(req) },
      { $set: { livenessHistory: history } }
    );

    res.json({ ok: true, history_length: history.length });
  });

  router.post('/face/verify', requireRole('student'), async (req, res) => {
    const user = await authUser(req);
    if (!user) return sendError(res, 'Unauthorized.', 401);
    const db = getDB();
    const selfie = req.body.selfie_base64;
    if (!selfie) return sendError(res, 'Selfie is required.', 400);

    const profile = await db.collection('face_profiles').findOne({ userId: oid(user._id), ...collegeFilter(req) });
    if (!profile) return sendError(res, 'No face profile enrolled. Please enroll first.', 400);

    const result = await verifyFace(selfie, profile);
    if (!result.ok) {
      return sendError(res, result.message, 400);
    }

    // Update verification stats
    await db.collection('face_profiles').updateOne(
      { _id: profile._id, ...collegeFilter(req) },
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
    await db.collection('face_profiles').deleteOne({ userId: oid(user._id), ...collegeFilter(req) });
    res.json({ ok: true, message: 'Face profile deleted' });
  });

  return router;
}

module.exports = { createAttendanceRouter };
