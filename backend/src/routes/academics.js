const express = require('express');
const { getDB, oid } = require('../db');
const { authUser, requireRole } = require('../auth');
const { sendError, paginationParams, sendPaginated, nowIso } = require('../utils');

const router = express.Router();

function serializeCourse(course, facultyMap) {
  const faculty = facultyMap && course.facultyId ? facultyMap.get(String(course.facultyId)) : null;
  return {
    id: String(course._id),
    code: course.code,
    name: course.name,
    department: course.department || undefined,
    credits: course.credits,
    faculty_id: course.facultyId ? String(course.facultyId) : undefined,
    faculty_name: faculty ? faculty.name : undefined,
    semester: course.semester || undefined,
    college: course.college || undefined,
  };
}

function serializeTimetableSlot(slot, courseMap, facultyMap) {
  const course = courseMap ? courseMap.get(String(slot.courseId)) : null;
  const faculty = facultyMap && slot.facultyId ? facultyMap.get(String(slot.facultyId)) : null;
  return {
    id: String(slot._id),
    day: slot.dayOfWeek,
    start: slot.startTime,
    end: slot.endTime,
    course_id: String(slot.courseId),
    course_name: course ? course.name : undefined,
    course_code: course ? course.code : undefined,
    faculty_name: faculty ? faculty.name : undefined,
    room: slot.room,
  };
}

function serializeAssignment(assignment, courseMap, submission) {
  const course = courseMap ? courseMap.get(String(assignment.courseId)) : null;
  return {
    id: String(assignment._id),
    course_id: String(assignment.courseId),
    course_name: course ? course.name : undefined,
    title: assignment.title,
    description: assignment.description,
    due_date: assignment.dueDate,
    max_marks: assignment.maxMarks,
    created_at: assignment.createdAt,
    submitted: !!submission,
    submission: submission
      ? {
          id: String(submission._id),
          assignment_id: String(submission.assignmentId),
          student_id: String(submission.studentId),
          content: submission.content,
          submitted_at: submission.submittedAt,
        }
      : null,
  };
}

function serializeNote(note, courseMap) {
  const course = courseMap ? courseMap.get(String(note.courseId)) : null;
  return {
    id: String(note._id),
    course_id: note.courseId ? String(note.courseId) : undefined,
    course_name: course ? course.name : undefined,
    title: note.title,
    content: note.content,
    created_by: note.createdById ? String(note.createdById) : undefined,
    created_at: note.createdAt,
  };
}

async function getCourseMap(db, courseIds) {
  if (!courseIds.length) return new Map();
  const oids = courseIds.map(id => oid(id)).filter(Boolean);
  const rawIds = courseIds.filter(id => typeof id === 'string');
  const conditions = [];
  if (oids.length) conditions.push({ _id: { $in: oids } });
  if (rawIds.length) conditions.push({ _id: { $in: rawIds } });
  const query = conditions.length === 1 ? conditions[0] : { $or: conditions };
  const courses = await db.collection('courses').find(query).toArray();
  const map = new Map();
  for (const c of courses) map.set(String(c._id), c);
  return map;
}

async function getUserCourseIds(db, userId, role) {
  const uid = oid(userId);
  if (role === 'student') {
    const filter = uid ? { $or: [{ studentId: uid }, { studentId: userId }] } : { studentId: userId };
    const enrollments = await db.collection('course_enrollments').find(filter).toArray();
    return enrollments.map(e => e.courseId);
  }
  if (role === 'faculty') {
    const filter = uid ? { $or: [{ facultyId: uid }, { facultyId: userId }] } : { facultyId: userId };
    const courses = await db.collection('courses').find(filter).toArray();
    return courses.map(c => c._id);
  }
  return null;
}

router.get('/courses', async (req, res) => {
  try {
    const db = getDB();
    const user = await authUser(req);
    let filter = {};

    const deptFilter = req.query.department;
    if (deptFilter) filter.department = deptFilter;

    if (user.role === 'student') {
      const courseIds = await getUserCourseIds(db, String(user._id), 'student');
      const oids = courseIds.map(id => oid(id)).filter(Boolean);
      if (oids.length) filter._id = { $in: oids };
      else filter._id = { $in: courseIds };
    } else if (user.role === 'faculty') {
      const courseIds = await getUserCourseIds(db, String(user._id), 'faculty');
      const oids = courseIds.map(id => oid(id)).filter(Boolean);
      if (oids.length) filter._id = { $in: oids };
      else filter._id = { $in: courseIds };
    }

    const courses = await db.collection('courses').find(filter).toArray();
    const facultyIds = [...new Set(courses.map(c => c.facultyId).filter(Boolean))];
    const facultyMap = new Map();
    if (facultyIds.length) {
      const facultyUsers = await db.collection('users').find({ _id: { $in: facultyIds } }).toArray();
      for (const u of facultyUsers) facultyMap.set(String(u._id), u);
    }
    res.json(courses.map(c => serializeCourse(c, facultyMap)));
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.post('/courses', requireRole('college_admin', 'super_admin', 'faculty'), async (req, res) => {
  try {
    const db = getDB();
    const { code, name, department, credits, semester, college } = req.body;
    if (!code || !name) return sendError(res, 'code and name are required.');

    const doc = {
      code,
      name,
      department: department || '',
      credits: Number(credits || 3),
      semester: semester || null,
      college: college || '',
      facultyId: req.body.faculty_id ? oid(req.body.faculty_id) : null,
      createdAt: nowIso(),
    };

    const result = await db.collection('courses').insertOne(doc);
    doc._id = result.insertedId;
    const facultyMap = new Map();
    if (doc.facultyId) {
      const facultyUser = await db.collection('users').findOne({ _id: doc.facultyId });
      if (facultyUser) facultyMap.set(String(doc.facultyId), facultyUser);
    }
    res.json(serializeCourse(doc, facultyMap));
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.put('/courses/:id', requireRole('college_admin', 'super_admin', 'faculty'), async (req, res) => {
  try {
    const db = getDB();
    const _id = oid(req.params.id);
    if (!_id) return sendError(res, 'Invalid course id.', 404);

    const existing = await db.collection('courses').findOne({ _id });
    if (!existing) return sendError(res, 'Course not found.', 404);

    const update = {};
    if (req.body.code) update.code = req.body.code;
    if (req.body.name) update.name = req.body.name;
    if (req.body.department) update.department = req.body.department;
    if (req.body.credits) update.credits = Number(req.body.credits);
    if (req.body.semester) update.semester = req.body.semester;
    if (req.body.college) update.college = req.body.college;
    if (req.body.faculty_id) update.facultyId = oid(req.body.faculty_id);

    await db.collection('courses').updateOne({ _id }, { $set: update });
    const updated = await db.collection('courses').findOne({ _id });
    const facultyMap = new Map();
    if (updated.facultyId) {
      const facultyUser = await db.collection('users').findOne({ _id: updated.facultyId });
      if (facultyUser) facultyMap.set(String(updated.facultyId), facultyUser);
    }
    res.json(serializeCourse(updated, facultyMap));
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.delete('/courses/:id', requireRole('college_admin', 'super_admin'), async (req, res) => {
  try {
    const db = getDB();
    const _id = oid(req.params.id);
    if (!_id) return sendError(res, 'Invalid course id.', 404);

    const result = await db.collection('courses').deleteOne({ _id });
    if (!result.deletedCount) return sendError(res, 'Course not found.', 404);
    res.json({ ok: true });
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.get('/timetable', async (req, res) => {
  try {
    const db = getDB();
    const user = await authUser(req);
    let filter = {};

    if (user.role === 'student' || user.role === 'faculty') {
      const courseIds = await getUserCourseIds(db, String(user._id), user.role);
      filter.courseId = { $in: courseIds.length ? courseIds : [] };
    }

    const slots = await db.collection('timetable_slots').find(filter).toArray();
    const courseIds = [...new Set(slots.map(s => s.courseId))];
    const courseMap = await getCourseMap(db, courseIds);
    const facultyIds = [...new Set(slots.map(s => s.facultyId).filter(Boolean))];
    const facultyMap = new Map();
    if (facultyIds.length) {
      const facultyUsers = await db.collection('users').find({ _id: { $in: facultyIds } }).toArray();
      for (const u of facultyUsers) facultyMap.set(String(u._id), u);
    }
    res.json(slots.map(s => serializeTimetableSlot(s, courseMap, facultyMap)));
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.post('/timetable', requireRole('college_admin', 'super_admin'), async (req, res) => {
  try {
    const db = getDB();
    const { courseId, dayOfWeek, startTime, endTime, room, facultyId } = req.body;
    if (!courseId) return sendError(res, 'courseId is required.');

    const course = await db.collection('courses').findOne({ _id: oid(courseId) });
    if (!course) return sendError(res, 'Course not found.', 404);

    const doc = {
      courseId: oid(courseId),
      dayOfWeek: dayOfWeek || 'Mon',
      startTime: startTime || '09:00',
      endTime: endTime || '10:00',
      room: room || 'TBD',
      facultyId: facultyId ? oid(facultyId) : course.facultyId || null,
    };

    const result = await db.collection('timetable_slots').insertOne(doc);
    doc._id = result.insertedId;
    const courseMap = await getCourseMap(db, [doc.courseId]);
    const facultyMap = new Map();
    if (doc.facultyId) {
      const facultyUser = await db.collection('users').findOne({ _id: doc.facultyId });
      if (facultyUser) facultyMap.set(String(doc.facultyId), facultyUser);
    }
    res.json(serializeTimetableSlot(doc, courseMap, facultyMap));
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.put('/timetable/:id', requireRole('college_admin', 'super_admin', 'faculty'), async (req, res) => {
  try {
    const db = getDB();
    const _id = oid(req.params.id);
    if (!_id) return sendError(res, 'Invalid slot id.', 404);

    const existing = await db.collection('timetable_slots').findOne({ _id });
    if (!existing) return sendError(res, 'Slot not found.', 404);

    const { courseId, dayOfWeek, startTime, endTime, room } = req.body;
    const update = {};
    if (courseId) {
      const course = await db.collection('courses').findOne({ _id: oid(courseId) });
      if (!course) return sendError(res, 'Course not found.', 404);
      update.courseId = oid(courseId);
    }
    if (dayOfWeek) update.dayOfWeek = dayOfWeek;
    if (startTime) update.startTime = startTime;
    if (endTime) update.endTime = endTime;
    if (room !== undefined) update.room = room;

    await db.collection('timetable_slots').updateOne({ _id }, { $set: update });
    const updated = await db.collection('timetable_slots').findOne({ _id });
    const courseMap = await getCourseMap(db, [updated.courseId]);
    const facultyMap = new Map();
    if (updated.facultyId) {
      const facultyUser = await db.collection('users').findOne({ _id: updated.facultyId });
      if (facultyUser) facultyMap.set(String(updated.facultyId), facultyUser);
    }
    res.json(serializeTimetableSlot(updated, courseMap, facultyMap));
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.delete('/timetable/:id', requireRole('college_admin', 'super_admin'), async (req, res) => {
  try {
    const db = getDB();
    const _id = oid(req.params.id);
    if (!_id) return sendError(res, 'Invalid slot id.', 404);

    const result = await db.collection('timetable_slots').deleteOne({ _id });
    if (!result.deletedCount) return sendError(res, 'Slot not found.', 404);
    res.json({ ok: true });
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.get('/assignments', async (req, res) => {
  try {
    const db = getDB();
    const user = await authUser(req);
    let filter = {};

    if (user.role === 'student') {
      const courseIds = await getUserCourseIds(db, String(user._id), 'student');
      filter.courseId = { $in: courseIds.length ? courseIds : [] };
    } else if (user.role === 'faculty') {
      const courseIds = await getUserCourseIds(db, String(user._id), 'faculty');
      filter.courseId = { $in: courseIds.length ? courseIds : [] };
    }

    const assignments = await db.collection('assignments').find(filter).toArray();
    const courseIds = [...new Set(assignments.map(a => a.courseId))];
    const courseMap = await getCourseMap(db, courseIds);

    let submissions = [];
    if (user.role === 'student') {
      submissions = await db.collection('submissions')
        .find({ studentId: oid(String(user._id)) })
        .toArray();
    }

    const submissionMap = new Map();
    for (const s of submissions) {
      const key = String(s.assignmentId);
      if (!submissionMap.has(key)) submissionMap.set(key, s);
    }

    res.json(
      assignments.map(a =>
        serializeAssignment(a, courseMap, submissionMap.get(String(a._id)) || null)
      )
    );
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.post('/assignments', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
  try {
    const db = getDB();
    const user = await authUser(req);
    const { courseId, title, description, dueDate, maxMarks } = req.body;
    if (!courseId || !title) return sendError(res, 'courseId and title are required.');

    const course = await db.collection('courses').findOne({ _id: oid(courseId) });
    if (!course) return sendError(res, 'Course not found.', 404);

    const doc = {
      courseId: oid(courseId),
      title,
      description: description || '',
      dueDate: dueDate || new Date(Date.now() + 7 * 86400000).toISOString(),
      maxMarks: Number(maxMarks || 20),
      createdById: oid(String(user._id)),
      createdAt: nowIso(),
    };

    const result = await db.collection('assignments').insertOne(doc);
    doc._id = result.insertedId;
    const courseMap = await getCourseMap(db, [doc.courseId]);
    res.json(serializeAssignment(doc, courseMap, null));
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.put('/assignments/:id', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
  try {
    const db = getDB();
    const _id = oid(req.params.id);
    if (!_id) return sendError(res, 'Invalid assignment id.', 404);

    const existing = await db.collection('assignments').findOne({ _id });
    if (!existing) return sendError(res, 'Assignment not found.', 404);

    const update = {};
    if (req.body.title) update.title = req.body.title;
    if (req.body.description !== undefined) update.description = req.body.description;
    if (req.body.dueDate) update.dueDate = req.body.dueDate;
    if (req.body.maxMarks) update.maxMarks = Number(req.body.maxMarks);
    if (req.body.courseId) update.courseId = oid(req.body.courseId);

    await db.collection('assignments').updateOne({ _id }, { $set: update });
    const updated = await db.collection('assignments').findOne({ _id });
    const courseMap = await getCourseMap(db, [updated.courseId]);
    res.json(serializeAssignment(updated, courseMap, null));
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.delete('/assignments/:id', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
  try {
    const db = getDB();
    const _id = oid(req.params.id);
    if (!_id) return sendError(res, 'Invalid assignment id.', 404);

    const result = await db.collection('assignments').deleteOne({ _id });
    if (!result.deletedCount) return sendError(res, 'Assignment not found.', 404);
    res.json({ ok: true });
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.post('/assignments/:id/submit', requireRole('student'), async (req, res) => {
  try {
    const db = getDB();
    const user = await authUser(req);
    const aid = oid(req.params.id);
    if (!aid) return sendError(res, 'Invalid assignment id.', 404);

    const assignment = await db.collection('assignments').findOne({ _id: aid });
    if (!assignment) return sendError(res, 'Assignment not found.', 404);

    const sid = oid(String(user._id));
    const existing = await db.collection('submissions').findOne({
      assignmentId: aid,
      studentId: sid,
    });

    const now = nowIso();
    if (existing) {
      await db.collection('submissions').updateOne(
        { _id: existing._id },
        { $set: { content: req.body.content || '', submittedAt: now } }
      );
      const updated = await db.collection('submissions').findOne({ _id: existing._id });
      res.json({ ok: true, submission: updated });
    } else {
      const doc = {
        assignmentId: aid,
        studentId: sid,
        content: req.body.content || '',
        submittedAt: now,
        marks: null,
        feedback: null,
      };
      const result = await db.collection('submissions').insertOne(doc);
      doc._id = result.insertedId;
      res.json({ ok: true, submission: doc });
    }
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.get('/assignments/:id/submissions', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
  try {
    const db = getDB();
    const aid = oid(req.params.id);
    if (!aid) return sendError(res, 'Invalid assignment id.', 404);

    const assignment = await db.collection('assignments').findOne({ _id: aid });
    if (!assignment) return sendError(res, 'Assignment not found.', 404);

    const submissions = await db.collection('submissions')
      .find({ assignmentId: aid })
      .toArray();

    const studentIds = [...new Set(submissions.map(s => s.studentId))];
    const students = studentIds.length
      ? await db.collection('users').find({ _id: { $in: studentIds } }).toArray()
      : [];
    const studentMap = new Map();
    for (const s of students) studentMap.set(String(s._id), s);

    res.json(
      submissions.map(sub => ({
        id: String(sub._id),
        assignment_id: String(sub.assignmentId),
        student_id: String(sub.studentId),
        student_name: studentMap.get(String(sub.studentId))?.name || '',
        content: sub.content,
        submitted_at: sub.submittedAt,
        marks: sub.marks,
        feedback: sub.feedback,
      }))
    );
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.put('/submissions/:id/grade', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
  try {
    const db = getDB();
    const _id = oid(req.params.id);
    if (!_id) return sendError(res, 'Invalid submission id.', 404);

    const existing = await db.collection('submissions').findOne({ _id });
    if (!existing) return sendError(res, 'Submission not found.', 404);

    const update = {};
    if (req.body.marks !== undefined) update.marks = Number(req.body.marks);
    if (req.body.feedback !== undefined) update.feedback = req.body.feedback;

    await db.collection('submissions').updateOne({ _id }, { $set: update });
    const updated = await db.collection('submissions').findOne({ _id });
    res.json({ ok: true, submission: updated });
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.get('/notes', async (req, res) => {
  try {
    const db = getDB();
    const user = await authUser(req);
    let filter = {};

    if (user.role === 'student' || user.role === 'faculty') {
      const courseIds = await getUserCourseIds(db, String(user._id), user.role);
      filter.courseId = { $in: courseIds.length ? courseIds : [] };
    }

    const notes = await db.collection('notes').find(filter).sort({ createdAt: -1 }).toArray();
    const courseIds = [...new Set(notes.map(n => n.courseId).filter(Boolean))];
    const courseMap = await getCourseMap(db, courseIds);
    res.json(notes.map(n => serializeNote(n, courseMap)));
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.post('/notes', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
  try {
    const db = getDB();
    const user = await authUser(req);
    const { courseId, title, content } = req.body;

    const doc = {
      courseId: courseId ? oid(courseId) : null,
      title: title || 'Untitled',
      content: content || '',
      createdById: oid(String(user._id)),
      createdAt: nowIso(),
    };

    const result = await db.collection('notes').insertOne(doc);
    doc._id = result.insertedId;
    const courseMap = doc.courseId ? await getCourseMap(db, [doc.courseId]) : new Map();
    res.json(serializeNote(doc, courseMap));
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.put('/notes/:id', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
  try {
    const db = getDB();
    const _id = oid(req.params.id);
    if (!_id) return sendError(res, 'Invalid note id.', 404);

    const existing = await db.collection('notes').findOne({ _id });
    if (!existing) return sendError(res, 'Note not found.', 404);

    const update = {};
    if (req.body.title) update.title = req.body.title;
    if (req.body.content !== undefined) update.content = req.body.content;
    if (req.body.courseId) update.courseId = oid(req.body.courseId);

    await db.collection('notes').updateOne({ _id }, { $set: update });
    const updated = await db.collection('notes').findOne({ _id });
    const courseMap = updated.courseId ? await getCourseMap(db, [updated.courseId]) : new Map();
    res.json(serializeNote(updated, courseMap));
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.delete('/notes/:id', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
  try {
    const db = getDB();
    const _id = oid(req.params.id);
    if (!_id) return sendError(res, 'Invalid note id.', 404);

    const result = await db.collection('notes').deleteOne({ _id });
    if (!result.deletedCount) return sendError(res, 'Note not found.', 404);
    res.json({ ok: true });
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.get('/exams', async (req, res) => {
  try {
    const db = getDB();
    const user = await authUser(req);
    let filter = {};

    if (user.role === 'student' || user.role === 'faculty') {
      const courseIds = await getUserCourseIds(db, String(user._id), user.role);
      filter.courseId = { $in: courseIds.length ? courseIds : [] };
    }

    const exams = await db.collection('exams').find(filter).toArray();
    const courseIds = [...new Set(exams.map(e => e.courseId))];
    const courseMap = await getCourseMap(db, courseIds);

    res.json(
      exams.map(exam => {
        const course = courseMap.get(String(exam.courseId));
        return {
          id: String(exam._id),
          course_id: String(exam.courseId),
          course_name: course ? course.name : undefined,
          course_code: course ? course.code : undefined,
          title: exam.title,
          type: exam.type,
          date: exam.date,
          duration: exam.duration,
          total_marks: exam.totalMarks,
        };
      })
    );
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.put('/exams/:id', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
  try {
    const db = getDB();
    const _id = oid(req.params.id);
    if (!_id) return sendError(res, 'Invalid exam id.', 404);

    const existing = await db.collection('exams').findOne({ _id });
    if (!existing) return sendError(res, 'Exam not found.', 404);

    const update = {};
    if (req.body.title) update.title = req.body.title;
    if (req.body.type) update.type = req.body.type;
    if (req.body.date) update.date = req.body.date;
    if (req.body.duration) update.duration = req.body.duration;
    if (req.body.totalMarks) update.totalMarks = Number(req.body.totalMarks);
    if (req.body.courseId) update.courseId = oid(req.body.courseId);

    await db.collection('exams').updateOne({ _id }, { $set: update });
    const updated = await db.collection('exams').findOne({ _id });
    const courseMap = updated.courseId ? await getCourseMap(db, [updated.courseId]) : new Map();
    const course = courseMap.get(String(updated.courseId));
    res.json({
      id: String(updated._id),
      course_id: String(updated.courseId),
      course_name: course ? course.name : undefined,
      course_code: course ? course.code : undefined,
      title: updated.title,
      type: updated.type,
      date: updated.date,
      duration: updated.duration,
      total_marks: updated.totalMarks,
    });
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.delete('/exams/:id', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
  try {
    const db = getDB();
    const _id = oid(req.params.id);
    if (!_id) return sendError(res, 'Invalid exam id.', 404);

    const result = await db.collection('exams').deleteOne({ _id });
    if (!result.deletedCount) return sendError(res, 'Exam not found.', 404);
    res.json({ ok: true });
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.get('/exams/:id/hall-ticket', requireRole('student'), async (req, res) => {
  try {
    const db = getDB();
    const user = await authUser(req);
    const eid = oid(req.params.id);
    if (!eid) return sendError(res, 'Invalid exam id.', 404);

    const exam = await db.collection('exams').findOne({ _id: eid });
    if (!exam) return sendError(res, 'Exam not found.', 404);

    const course = await db.collection('courses').findOne({ _id: exam.courseId });

    res.json({
      student_name: user.name,
      student_code: user.studentCode,
      exam_id: String(exam._id),
      exam_title: exam.title,
      course_name: course ? course.name : '',
      course_code: course ? course.code : '',
      date: exam.date,
      duration: exam.duration,
      total_marks: exam.totalMarks,
    });
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.post('/exams/generate', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
  try {
    const db = getDB();
    const user = await authUser(req);
    const { courseId, title, type, questionCount, totalMarks } = req.body;

    const examDoc = {
      courseId: courseId ? oid(courseId) : null,
      title: title || 'Generated Exam',
      type: type || 'practice',
      date: nowIso(),
      duration: req.body.duration || '60 minutes',
      totalMarks: Number(totalMarks || 50),
    };

    const examResult = await db.collection('exams').insertOne(examDoc);
    examDoc._id = examResult.insertedId;

    const generatedDoc = {
      examId: examDoc._id,
      courseId: examDoc.courseId,
      title: examDoc.title,
      type: examDoc.type,
      questionCount: Number(questionCount || 20),
      totalMarks: examDoc.totalMarks,
      createdById: oid(String(user._id)),
      createdAt: nowIso(),
    };

    const genResult = await db.collection('generated_exams').insertOne(generatedDoc);
    generatedDoc._id = genResult.insertedId;

    res.json({
      id: String(generatedDoc._id),
      exam_id: String(examDoc._id),
      title: generatedDoc.title,
      type: generatedDoc.type,
      question_count: generatedDoc.questionCount,
      total_marks: generatedDoc.totalMarks,
      created_at: generatedDoc.createdAt,
    });
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.get('/generated-exams', async (req, res) => {
  try {
    const db = getDB();
    const generated = await db.collection('generated_exams').find().sort({ createdAt: -1 }).toArray();

    const creatorIds = [...new Set(generated.map(g => g.createdById).filter(Boolean))];
    const creators = creatorIds.length
      ? await db.collection('users').find({ _id: { $in: creatorIds } }).toArray()
      : [];
    const creatorMap = new Map();
    for (const c of creators) creatorMap.set(String(c._id), c);

    res.json(
      generated.map(g => ({
        id: String(g._id),
        title: g.title,
        type: g.type,
        question_count: g.questionCount,
        total_marks: g.totalMarks,
        created_at: g.createdAt,
        created_by_name: creatorMap.get(String(g.createdById))?.name || '',
      }))
    );
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.get('/question-bank/subjects', async (_req, res) => {
  try {
    const db = getDB();
    const subjects = await db.collection('question_bank_items').distinct('subject');
    res.json(subjects);
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.get('/question-bank/stats', async (_req, res) => {
  try {
    const db = getDB();
    const [total, subjects, easy, medium, hard] = await Promise.all([
      db.collection('question_bank_items').countDocuments(),
      db.collection('question_bank_items').distinct('subject'),
      db.collection('question_bank_items').countDocuments({ difficulty: 'easy' }),
      db.collection('question_bank_items').countDocuments({ difficulty: 'medium' }),
      db.collection('question_bank_items').countDocuments({ difficulty: 'hard' }),
    ]);
    res.json({ total, subjects, easy, medium, hard });
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.get('/question-bank', async (req, res) => {
  try {
    const db = getDB();
    const { skip, limit } = paginationParams(req.query);
    const filter = {};
    if (req.query.subject) filter.subject = req.query.subject;

    const [questions, total] = await Promise.all([
      db.collection('question_bank_items').find(filter).skip(skip).limit(limit).toArray(),
      db.collection('question_bank_items').countDocuments(filter),
    ]);

    sendPaginated(
      res,
      questions.map(q => ({
        id: String(q._id),
        subject: q.subject,
        topic: q.topic,
        question: q.question,
        options: q.options,
        correct_answer: q.correctAnswer,
        difficulty: q.difficulty,
        marks: q.marks,
        type: q.type,
      })),
      total
    );
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.post('/question-bank', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
  try {
    const db = getDB();
    const { subject, topic, question, options, correctAnswer, difficulty, marks, type } = req.body;
    if (!question) return sendError(res, 'question is required.');

    const doc = {
      subject: subject || 'General',
      topic: topic || '',
      question,
      options: Array.isArray(options) ? options : [],
      correctAnswer: correctAnswer || '',
      difficulty: difficulty || 'medium',
      marks: Number(marks || 1),
      type: type || 'mcq',
    };

    const result = await db.collection('question_bank_items').insertOne(doc);
    doc._id = result.insertedId;
    res.json({
      id: String(doc._id),
      subject: doc.subject,
      topic: doc.topic,
      question: doc.question,
      options: doc.options,
      correct_answer: doc.correctAnswer,
      difficulty: doc.difficulty,
      marks: doc.marks,
      type: doc.type,
    });
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.delete('/question-bank/:id', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
  try {
    const db = getDB();
    const _id = oid(req.params.id);
    if (!_id) return sendError(res, 'Invalid question id.', 404);

    const result = await db.collection('question_bank_items').deleteOne({ _id });
    if (!result.deletedCount) return sendError(res, 'Question not found.', 404);
    res.json({ ok: true });
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.get('/results/me', requireRole('student'), async (req, res) => {
  try {
    const db = getDB();
    const user = await authUser(req);
    const sid = oid(String(user._id));

    const results = await db.collection('exam_results').find({ studentId: sid }).toArray();
    const courseIds = [...new Set(results.map(r => r.courseId).filter(Boolean))];
    const courseMap = await getCourseMap(db, courseIds);

    res.json(
      results.map(r => {
        const course = courseMap.get(String(r.courseId));
        return {
          id: String(r._id),
          course_id: r.courseId ? String(r.courseId) : undefined,
          course_name: course ? course.name : undefined,
          course_code: course ? course.code : undefined,
          marks: r.marks,
          grade: r.grade,
          semester: r.semester,
        };
      })
    );
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

router.get('/events', async (_req, res) => {
  try {
    const db = getDB();
    const events = await db.collection('events').find().sort({ date: -1 }).toArray();
    res.json(
      events.map(e => ({
        id: String(e._id),
        title: e.title,
        description: e.description,
        date: e.date,
        type: e.type,
        audience: e.audience,
      }))
    );
  } catch (e) {
    sendError(res, e.message, 500);
  }
});

module.exports = router;
