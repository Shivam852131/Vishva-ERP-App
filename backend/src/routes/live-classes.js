const express = require('express');
const { getDB, oid } = require('../db');
const { sendError, nowIso, roomForUser } = require('../utils');
const { requireRole } = require('../auth');

function roomForLive(sessionId) {
  return `live:${String(sessionId)}`;
}

function serializeSession(doc, extra = {}) {
  return {
    id: String(doc._id),
    title: doc.title,
    description: doc.description || '',
    course_id: doc.courseId ? String(doc.courseId) : null,
    course_name: doc.courseName || null,
    host_id: String(doc.hostId),
    host_name: doc.hostName,
    scheduled_at: doc.scheduledAt,
    started_at: doc.startedAt || null,
    ended_at: doc.endedAt || null,
    duration_minutes: doc.durationMinutes,
    status: doc.status,
    meeting_url: doc.meetingUrl || null,
    recording_url: doc.recordingUrl || null,
    allow_chat: doc.allowChat !== false,
    allow_questions: doc.allowQuestions !== false,
    department: doc.department || null,
    year: doc.year ?? null,
    tags: doc.tags || [],
    materials: doc.materials || [],
    created_at: doc.createdAt,
    ...extra,
  };
}

function serializeParticipant(doc) {
  return {
    id: String(doc._id),
    student_id: String(doc.studentId),
    student_name: doc.studentName,
    joined_at: doc.joinedAt,
    left_at: doc.leftAt || null,
    active: !doc.leftAt,
    hand_raised: !!doc.handRaised,
    attention_seconds: doc.attentionSeconds || 0,
    present: !!doc.present,
  };
}

function createLiveClassesRouter(io) {
  const router = express.Router();
  const isHostRole = user => ['faculty', 'college_admin', 'super_admin', 'collegeAdmin', 'superadmin'].includes(user.role);

  async function loadSession(id) {
    const db = getDB();
    const session = await db.collection('live_sessions').findOne({ _id: oid(id) });
    return session;
  }

  function ensureHost(session, user) {
    return String(session.hostId) === String(user._id) || ['college_admin', 'super_admin', 'collegeAdmin', 'superadmin'].includes(user.role);
  }

  // ── Sessions ───────────────────────────────────────────────────────────────
  router.get('/', async (req, res) => {
    const db = getDB();
    const { status, courseId, scope } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (courseId) filter.courseId = oid(courseId);
    if (scope === 'mine' && isHostRole(req.user)) filter.hostId = oid(req.user._id);

    const sessions = await db.collection('live_sessions')
      .find(filter)
      .sort({ status: 1, scheduledAt: 1 })
      .limit(100)
      .toArray();

    const ids = sessions.map(s => s._id);
    const [participants, myEnrollments] = await Promise.all([
      ids.length
        ? db.collection('live_participants').aggregate([
            { $match: { sessionId: { $in: ids } } },
            { $group: { _id: '$sessionId', total: { $sum: 1 }, active: { $sum: { $cond: [{ $ifNull: ['$leftAt', false] }, 0, 1] } } } },
          ]).toArray()
        : [],
      ids.length
        ? db.collection('live_participants').find({ sessionId: { $in: ids }, studentId: oid(req.user._id) }).toArray()
        : [],
    ]);

    const countMap = new Map(participants.map(p => [String(p._id), p]));
    const joinedSet = new Set(myEnrollments.map(p => String(p.sessionId)));

    res.json(sessions.map(s => serializeSession(s, {
      participant_count: countMap.get(String(s._id))?.total || 0,
      active_count: countMap.get(String(s._id))?.active || 0,
      joined: joinedSet.has(String(s._id)),
    })));
  });

  router.post('/', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const { title, description, courseId, scheduledAt, durationMinutes, meetingUrl, department, year, tags, allowChat, allowQuestions, materials } = req.body || {};
    if (!title) return sendError(res, 'title is required.', 400);
    if (!scheduledAt) return sendError(res, 'scheduledAt is required.', 400);

    let courseName = null;
    if (courseId) {
      const course = await db.collection('courses').findOne({ _id: oid(courseId) });
      courseName = course?.name || null;
    }

    const doc = {
      title,
      description: description || '',
      courseId: courseId ? oid(courseId) : null,
      courseName,
      hostId: oid(req.user._id),
      hostName: req.user.name,
      scheduledAt,
      durationMinutes: Number(durationMinutes) || 60,
      status: 'scheduled',
      meetingUrl: meetingUrl || null,
      recordingUrl: null,
      allowChat: allowChat !== false,
      allowQuestions: allowQuestions !== false,
      department: department || req.user.department || null,
      year: year ?? null,
      tags: Array.isArray(tags) ? tags : [],
      materials: Array.isArray(materials) ? materials : [],
      createdAt: nowIso(),
    };

    const { insertedId } = await db.collection('live_sessions').insertOne(doc);
    const payload = serializeSession({ ...doc, _id: insertedId }, { participant_count: 0, active_count: 0, joined: false });
    io.emit('live:scheduled', payload);
    res.status(201).json(payload);
  });

  router.get('/:id', async (req, res) => {
    const db = getDB();
    const session = await loadSession(req.params.id);
    if (!session) return sendError(res, 'Live class not found.', 404);

    const [participants, questions, polls, mine] = await Promise.all([
      db.collection('live_participants').find({ sessionId: session._id }).sort({ joinedAt: 1 }).toArray(),
      db.collection('live_questions').find({ sessionId: session._id }).sort({ upvotes: -1, createdAt: -1 }).toArray(),
      db.collection('live_polls').find({ sessionId: session._id }).sort({ createdAt: -1 }).toArray(),
      db.collection('live_participants').findOne({ sessionId: session._id, studentId: oid(req.user._id) }),
    ]);

    res.json({
      ...serializeSession(session, {
        participant_count: participants.length,
        active_count: participants.filter(p => !p.leftAt).length,
        joined: !!mine && !mine.leftAt,
        is_host: ensureHost(session, req.user),
      }),
      participants: participants.map(serializeParticipant),
      questions: questions.map(q => ({
        id: String(q._id),
        text: q.text,
        author_id: String(q.authorId),
        author_name: q.anonymous ? 'Anonymous' : q.authorName,
        anonymous: !!q.anonymous,
        upvotes: (q.upvoters || []).length,
        upvoted: (q.upvoters || []).some(u => String(u) === String(req.user._id)),
        answered: !!q.answeredAt,
        answer: q.answer || null,
        created_at: q.createdAt,
      })),
      polls: polls.map(p => ({
        id: String(p._id),
        question: p.question,
        options: p.options,
        votes: p.options.map((_, i) => (p.votes || []).filter(v => v.optionIndex === i).length),
        total_votes: (p.votes || []).length,
        my_vote: (p.votes || []).find(v => String(v.userId) === String(req.user._id))?.optionIndex ?? null,
        status: p.status,
        created_at: p.createdAt,
      })),
    });
  });

  router.patch('/:id', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const session = await loadSession(req.params.id);
    if (!session) return sendError(res, 'Live class not found.', 404);
    if (!ensureHost(session, req.user)) return sendError(res, 'Only the host can edit this class.', 403);

    const allowed = ['title', 'description', 'scheduledAt', 'durationMinutes', 'meetingUrl', 'recordingUrl', 'allowChat', 'allowQuestions', 'tags', 'materials'];
    const patch = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }
    if (!Object.keys(patch).length) return sendError(res, 'Nothing to update.', 400);

    await db.collection('live_sessions').updateOne({ _id: session._id }, { $set: patch });
    const updated = await loadSession(req.params.id);
    const payload = serializeSession(updated);
    io.to(roomForLive(session._id)).emit('live:updated', payload);
    res.json(payload);
  });

  router.post('/:id/start', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const session = await loadSession(req.params.id);
    if (!session) return sendError(res, 'Live class not found.', 404);
    if (!ensureHost(session, req.user)) return sendError(res, 'Only the host can start this class.', 403);
    if (session.status === 'live') return sendError(res, 'This class is already live.', 409);
    if (session.status === 'ended') return sendError(res, 'This class has already ended.', 409);

    await db.collection('live_sessions').updateOne(
      { _id: session._id },
      { $set: { status: 'live', startedAt: nowIso() } },
    );

    const payload = serializeSession({ ...session, status: 'live', startedAt: nowIso() });
    io.emit('live:started', payload);
    io.to(roomForLive(session._id)).emit('live:status', { sessionId: String(session._id), status: 'live' });
    res.json(payload);
  });

  router.post('/:id/end', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const session = await loadSession(req.params.id);
    if (!session) return sendError(res, 'Live class not found.', 404);
    if (!ensureHost(session, req.user)) return sendError(res, 'Only the host can end this class.', 403);

    const endedAt = nowIso();
    await db.collection('live_sessions').updateOne(
      { _id: session._id },
      { $set: { status: 'ended', endedAt, recordingUrl: req.body?.recordingUrl || session.recordingUrl || null } },
    );
    await db.collection('live_participants').updateMany(
      { sessionId: session._id, leftAt: null },
      { $set: { leftAt: endedAt } },
    );
    await db.collection('live_polls').updateMany(
      { sessionId: session._id, status: 'open' },
      { $set: { status: 'closed' } },
    );

    io.to(roomForLive(session._id)).emit('live:status', { sessionId: String(session._id), status: 'ended' });
    io.emit('live:ended', { sessionId: String(session._id) });
    res.json(serializeSession({ ...session, status: 'ended', endedAt }));
  });

  router.delete('/:id', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const session = await loadSession(req.params.id);
    if (!session) return sendError(res, 'Live class not found.', 404);
    if (!ensureHost(session, req.user)) return sendError(res, 'Only the host can delete this class.', 403);
    if (session.status === 'live') return sendError(res, 'End the class before deleting it.', 409);

    await Promise.all([
      db.collection('live_sessions').deleteOne({ _id: session._id }),
      db.collection('live_participants').deleteMany({ sessionId: session._id }),
      db.collection('live_messages').deleteMany({ sessionId: session._id }),
      db.collection('live_questions').deleteMany({ sessionId: session._id }),
      db.collection('live_polls').deleteMany({ sessionId: session._id }),
    ]);
    res.json({ success: true });
  });

  // ── Join / leave ───────────────────────────────────────────────────────────
  router.post('/:id/join', async (req, res) => {
    const db = getDB();
    const session = await loadSession(req.params.id);
    if (!session) return sendError(res, 'Live class not found.', 404);
    if (session.status === 'ended') return sendError(res, 'This class has ended.', 409);

    const existing = await db.collection('live_participants').findOne({
      sessionId: session._id,
      studentId: oid(req.user._id),
    });

    let participant;
    if (existing) {
      await db.collection('live_participants').updateOne(
        { _id: existing._id },
        { $set: { leftAt: null, rejoinedAt: nowIso() } },
      );
      participant = { ...existing, leftAt: null };
    } else {
      const doc = {
        sessionId: session._id,
        studentId: oid(req.user._id),
        studentName: req.user.name,
        joinedAt: nowIso(),
        leftAt: null,
        handRaised: false,
        attentionSeconds: 0,
        // Joining while the class is live counts as attendance.
        present: session.status === 'live',
      };
      const { insertedId } = await db.collection('live_participants').insertOne(doc);
      participant = { ...doc, _id: insertedId };
    }

    const payload = serializeParticipant(participant);
    io.to(roomForLive(session._id)).emit('live:participant-joined', payload);
    res.json(payload);
  });

  router.post('/:id/leave', async (req, res) => {
    const db = getDB();
    const session = await loadSession(req.params.id);
    if (!session) return sendError(res, 'Live class not found.', 404);

    const leftAt = nowIso();
    const result = await db.collection('live_participants').findOneAndUpdate(
      { sessionId: session._id, studentId: oid(req.user._id) },
      { $set: { leftAt, handRaised: false }, $inc: { attentionSeconds: Number(req.body?.attentionSeconds) || 0 } },
      { returnDocument: 'after' },
    );
    const doc = result?.value || result;
    if (!doc) return sendError(res, 'You are not in this class.', 404);

    io.to(roomForLive(session._id)).emit('live:participant-left', { student_id: String(req.user._id), left_at: leftAt });
    res.json({ success: true });
  });

  router.post('/:id/hand', async (req, res) => {
    const db = getDB();
    const session = await loadSession(req.params.id);
    if (!session) return sendError(res, 'Live class not found.', 404);

    const raised = !!req.body?.raised;
    const result = await db.collection('live_participants').updateOne(
      { sessionId: session._id, studentId: oid(req.user._id), leftAt: null },
      { $set: { handRaised: raised, handRaisedAt: raised ? nowIso() : null } },
    );
    if (!result.matchedCount) return sendError(res, 'Join the class before raising your hand.', 409);

    io.to(roomForLive(session._id)).emit('live:hand', {
      student_id: String(req.user._id),
      student_name: req.user.name,
      raised,
    });
    res.json({ raised });
  });

  // ── Chat ───────────────────────────────────────────────────────────────────
  router.get('/:id/messages', async (req, res) => {
    const db = getDB();
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const messages = await db.collection('live_messages')
      .find({ sessionId: oid(req.params.id) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    res.json(messages.reverse().map(m => ({
      id: String(m._id),
      text: m.text,
      author_id: String(m.authorId),
      author_name: m.authorName,
      author_role: m.authorRole,
      created_at: m.createdAt,
    })));
  });

  router.post('/:id/messages', async (req, res) => {
    const db = getDB();
    const session = await loadSession(req.params.id);
    if (!session) return sendError(res, 'Live class not found.', 404);
    if (session.allowChat === false && !ensureHost(session, req.user)) {
      return sendError(res, 'Chat is disabled for this class.', 403);
    }

    const text = String(req.body?.text || '').trim();
    if (!text) return sendError(res, 'Message text is required.', 400);
    if (text.length > 1000) return sendError(res, 'Message is too long.', 400);

    const doc = {
      sessionId: session._id,
      text,
      authorId: oid(req.user._id),
      authorName: req.user.name,
      authorRole: req.user.role,
      createdAt: nowIso(),
    };
    const { insertedId } = await db.collection('live_messages').insertOne(doc);

    const payload = {
      id: String(insertedId),
      text,
      author_id: String(req.user._id),
      author_name: req.user.name,
      author_role: req.user.role,
      created_at: doc.createdAt,
    };
    io.to(roomForLive(session._id)).emit('live:message', payload);
    res.status(201).json(payload);
  });

  // ── Q&A ────────────────────────────────────────────────────────────────────
  router.post('/:id/questions', async (req, res) => {
    const db = getDB();
    const session = await loadSession(req.params.id);
    if (!session) return sendError(res, 'Live class not found.', 404);
    if (session.allowQuestions === false) return sendError(res, 'Q&A is disabled for this class.', 403);

    const text = String(req.body?.text || '').trim();
    if (!text) return sendError(res, 'Question text is required.', 400);

    const doc = {
      sessionId: session._id,
      text,
      authorId: oid(req.user._id),
      authorName: req.user.name,
      anonymous: !!req.body?.anonymous,
      upvoters: [],
      answer: null,
      answeredAt: null,
      createdAt: nowIso(),
    };
    const { insertedId } = await db.collection('live_questions').insertOne(doc);

    const payload = {
      id: String(insertedId),
      text,
      author_id: String(req.user._id),
      author_name: doc.anonymous ? 'Anonymous' : req.user.name,
      anonymous: doc.anonymous,
      upvotes: 0,
      upvoted: false,
      answered: false,
      answer: null,
      created_at: doc.createdAt,
    };
    io.to(roomForLive(session._id)).emit('live:question', payload);
    res.status(201).json(payload);
  });

  router.post('/:id/questions/:questionId/upvote', async (req, res) => {
    const db = getDB();
    const question = await db.collection('live_questions').findOne({ _id: oid(req.params.questionId) });
    if (!question) return sendError(res, 'Question not found.', 404);

    const already = (question.upvoters || []).some(u => String(u) === String(req.user._id));
    await db.collection('live_questions').updateOne(
      { _id: question._id },
      already
        ? { $pull: { upvoters: oid(req.user._id) } }
        : { $addToSet: { upvoters: oid(req.user._id) } },
    );

    const upvotes = already ? (question.upvoters || []).length - 1 : (question.upvoters || []).length + 1;
    io.to(roomForLive(req.params.id)).emit('live:question-upvote', {
      question_id: String(question._id),
      upvotes,
    });
    res.json({ upvotes, upvoted: !already });
  });

  router.post('/:id/questions/:questionId/answer', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const session = await loadSession(req.params.id);
    if (!session) return sendError(res, 'Live class not found.', 404);
    if (!ensureHost(session, req.user)) return sendError(res, 'Only the host can answer questions.', 403);

    const answer = String(req.body?.answer || '').trim();
    if (!answer) return sendError(res, 'Answer text is required.', 400);

    const answeredAt = nowIso();
    const result = await db.collection('live_questions').updateOne(
      { _id: oid(req.params.questionId), sessionId: session._id },
      { $set: { answer, answeredAt } },
    );
    if (!result.matchedCount) return sendError(res, 'Question not found.', 404);

    io.to(roomForLive(session._id)).emit('live:question-answered', {
      question_id: req.params.questionId,
      answer,
      answered_at: answeredAt,
    });
    res.json({ success: true, answer, answered_at: answeredAt });
  });

  // ── Polls ──────────────────────────────────────────────────────────────────
  router.post('/:id/polls', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const session = await loadSession(req.params.id);
    if (!session) return sendError(res, 'Live class not found.', 404);
    if (!ensureHost(session, req.user)) return sendError(res, 'Only the host can create polls.', 403);

    const { question, options } = req.body || {};
    if (!question) return sendError(res, 'Poll question is required.', 400);
    if (!Array.isArray(options) || options.length < 2) return sendError(res, 'Provide at least two options.', 400);

    const doc = {
      sessionId: session._id,
      question,
      options: options.slice(0, 6).map(String),
      votes: [],
      status: 'open',
      createdBy: oid(req.user._id),
      createdAt: nowIso(),
    };
    const { insertedId } = await db.collection('live_polls').insertOne(doc);

    const payload = {
      id: String(insertedId),
      question: doc.question,
      options: doc.options,
      votes: doc.options.map(() => 0),
      total_votes: 0,
      my_vote: null,
      status: 'open',
      created_at: doc.createdAt,
    };
    io.to(roomForLive(session._id)).emit('live:poll', payload);
    res.status(201).json(payload);
  });

  router.post('/:id/polls/:pollId/vote', async (req, res) => {
    const db = getDB();
    const poll = await db.collection('live_polls').findOne({ _id: oid(req.params.pollId) });
    if (!poll) return sendError(res, 'Poll not found.', 404);
    if (poll.status !== 'open') return sendError(res, 'This poll is closed.', 409);

    const optionIndex = Number(req.body?.optionIndex);
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= poll.options.length) {
      return sendError(res, 'Invalid option.', 400);
    }

    // One vote per user — replace any previous choice.
    await db.collection('live_polls').updateOne(
      { _id: poll._id },
      { $pull: { votes: { userId: oid(req.user._id) } } },
    );
    await db.collection('live_polls').updateOne(
      { _id: poll._id },
      { $push: { votes: { userId: oid(req.user._id), optionIndex, at: nowIso() } } },
    );

    const updated = await db.collection('live_polls').findOne({ _id: poll._id });
    const counts = updated.options.map((_, i) => updated.votes.filter(v => v.optionIndex === i).length);

    io.to(roomForLive(req.params.id)).emit('live:poll-update', {
      poll_id: String(poll._id),
      votes: counts,
      total_votes: updated.votes.length,
    });
    res.json({ votes: counts, total_votes: updated.votes.length, my_vote: optionIndex });
  });

  router.post('/:id/polls/:pollId/close', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const result = await db.collection('live_polls').updateOne(
      { _id: oid(req.params.pollId), sessionId: oid(req.params.id) },
      { $set: { status: 'closed' } },
    );
    if (!result.matchedCount) return sendError(res, 'Poll not found.', 404);

    io.to(roomForLive(req.params.id)).emit('live:poll-closed', { poll_id: req.params.pollId });
    res.json({ success: true });
  });

  // ── Attendance ─────────────────────────────────────────────────────────────
  router.get('/:id/attendance', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const session = await loadSession(req.params.id);
    if (!session) return sendError(res, 'Live class not found.', 404);
    if (!ensureHost(session, req.user)) return sendError(res, 'Only the host can view attendance.', 403);

    const participants = await db.collection('live_participants')
      .find({ sessionId: session._id })
      .sort({ joinedAt: 1 })
      .toArray();

    const durationMs = session.durationMinutes * 60000;
    const start = session.startedAt ? new Date(session.startedAt).getTime() : null;

    const rows = participants.map(p => {
      const joined = new Date(p.joinedAt).getTime();
      const left = p.leftAt ? new Date(p.leftAt).getTime() : Date.now();
      const attendedMs = Math.max(0, left - joined);
      const coverage = durationMs ? Math.min(100, Math.round((attendedMs / durationMs) * 100)) : 0;
      const lateMinutes = start ? Math.max(0, Math.round((joined - start) / 60000)) : 0;

      return {
        student_id: String(p.studentId),
        student_name: p.studentName,
        joined_at: p.joinedAt,
        left_at: p.leftAt || null,
        minutes_attended: Math.round(attendedMs / 60000),
        coverage_percent: coverage,
        late_minutes: lateMinutes,
        // 60% coverage is the threshold for being marked present.
        status: coverage >= 60 ? (lateMinutes > 5 ? 'late' : 'present') : 'partial',
      };
    });

    res.json({
      session: serializeSession(session),
      total: rows.length,
      present: rows.filter(r => r.status === 'present').length,
      late: rows.filter(r => r.status === 'late').length,
      partial: rows.filter(r => r.status === 'partial').length,
      rows,
    });
  });

  router.post('/:id/attendance/sync', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const session = await loadSession(req.params.id);
    if (!session) return sendError(res, 'Live class not found.', 404);
    if (!ensureHost(session, req.user)) return sendError(res, 'Only the host can sync attendance.', 403);
    if (!session.courseId) return sendError(res, 'This class is not linked to a course.', 400);

    const participants = await db.collection('live_participants').find({ sessionId: session._id }).toArray();
    const durationMs = session.durationMinutes * 60000;
    const date = (session.startedAt || session.scheduledAt).slice(0, 10);

    let written = 0;
    for (const p of participants) {
      const joined = new Date(p.joinedAt).getTime();
      const left = p.leftAt ? new Date(p.leftAt).getTime() : Date.now();
      const coverage = durationMs ? (left - joined) / durationMs : 0;
      if (coverage < 0.6) continue;

      await db.collection('attendance_records').updateOne(
        { studentId: p.studentId, courseId: session.courseId, date },
        {
          $set: { status: 'present', method: 'live_class', sessionId: session._id, markedAt: nowIso() },
          $setOnInsert: { studentId: p.studentId, courseId: session.courseId, date },
        },
        { upsert: true },
      );
      written += 1;
      io.to(roomForUser(p.studentId)).emit('attendance:update', { courseId: String(session.courseId), date });
    }

    res.json({ success: true, records_written: written, total_participants: participants.length });
  });

  return router;
}

module.exports = { createLiveClassesRouter, roomForLive };
