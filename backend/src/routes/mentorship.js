const express = require('express');
const { getDB, oid } = require('../db');
const { sendError, nowIso, roomForUser } = require('../utils');
const { ensureCareerSeed, SKILL_BY_KEY, CAREER_BY_KEY } = require('../careerData');
const { getSkillMap } = require('../skillProfile');
const { collegeFilter, requireCollegeAccess } = require('../auth');

function serializeMentor(doc, extra = {}) {
  return {
    id: String(doc._id),
    name: doc.name,
    headline: doc.headline,
    company: doc.company,
    bio: doc.bio,
    expertise: (doc.expertise || []).map(key => ({
      skill_key: key,
      name: SKILL_BY_KEY.get(key)?.name || key,
    })),
    career_tracks: (doc.careerTracks || []).map(key => ({
      key,
      title: CAREER_BY_KEY.get(key)?.title || key,
    })),
    experience_years: doc.experienceYears,
    languages: doc.languages || [],
    availability: doc.availability || [],
    rating: doc.rating || 0,
    sessions_completed: doc.sessionsCompleted || 0,
    is_active: doc.isActive !== false,
    ...extra,
  };
}

function serializeConnection(doc) {
  return {
    id: String(doc._id),
    mentor_id: String(doc.mentorId),
    mentor_name: doc.mentorName,
    mentor_headline: doc.mentorHeadline,
    student_id: String(doc.studentId),
    student_name: doc.studentName,
    status: doc.status,
    goal: doc.goal,
    focus_skills: (doc.focusSkills || []).map(key => ({
      skill_key: key,
      name: SKILL_BY_KEY.get(key)?.name || key,
    })),
    message: doc.message || null,
    decline_reason: doc.declineReason || null,
    requested_at: doc.requestedAt,
    responded_at: doc.respondedAt || null,
    sessions_count: doc.sessionsCount || 0,
  };
}

function serializeSession(doc) {
  return {
    id: String(doc._id),
    connection_id: String(doc.connectionId),
    mentor_id: String(doc.mentorId),
    mentor_name: doc.mentorName,
    student_id: String(doc.studentId),
    student_name: doc.studentName,
    topic: doc.topic,
    agenda: doc.agenda || '',
    scheduled_at: doc.scheduledAt,
    duration_minutes: doc.durationMinutes,
    meeting_url: doc.meetingUrl || null,
    status: doc.status,
    notes: doc.notes || null,
    action_items: doc.actionItems || [],
    rating: doc.rating ?? null,
    feedback: doc.feedback || null,
    created_at: doc.createdAt,
  };
}

function serializeGoal(doc) {
  return {
    id: String(doc._id),
    connection_id: doc.connectionId ? String(doc.connectionId) : null,
    title: doc.title,
    description: doc.description || '',
    skill_key: doc.skillKey || null,
    target_date: doc.targetDate || null,
    status: doc.status,
    progress: doc.progress || 0,
    milestones: doc.milestones || [],
    created_at: doc.createdAt,
    completed_at: doc.completedAt || null,
  };
}

function createMentorshipRouter(io) {
  const router = express.Router();

  // ── Mentor discovery ───────────────────────────────────────────────────────
  router.get('/mentors', async (req, res) => {
    const db = getDB();
    await ensureCareerSeed(db);

    const { expertise, track, search, sort } = req.query;
    const filter = { isActive: { $ne: false } };
    if (expertise) filter.expertise = expertise;
    if (track) filter.careerTracks = track;
    if (search) {
      filter.$or = [
        { name: { $regex: String(search), $options: 'i' } },
        { company: { $regex: String(search), $options: 'i' } },
        { headline: { $regex: String(search), $options: 'i' } },
      ];
    }

    const collegeQ = collegeFilter(req);
    const [mentors, connections, skillMap] = await Promise.all([
      db.collection('mentors').find({ ...filter, ...collegeQ }).toArray(),
      db.collection('mentorship_connections').find({ studentId: oid(req.user._id), ...collegeQ }).toArray(),
      getSkillMap(req.user._id),
    ]);

    const connectionMap = new Map(connections.map(c => [String(c.mentorId), c]));

    // Relevance = how well the mentor's expertise covers the student's weakest
    // tracked skills. A mentor who teaches what you already know ranks lower.
    const enriched = mentors.map(m => {
      const gaps = (m.expertise || []).map(key => {
        const score = skillMap.get(key)?.score ?? null;
        return score == null ? 40 : Math.max(0, 100 - score);
      });
      const relevance = gaps.length ? Math.round(gaps.reduce((sum, g) => sum + g, 0) / gaps.length) : 0;
      const connection = connectionMap.get(String(m._id));

      return serializeMentor(m, {
        relevance,
        connection_status: connection?.status || null,
        connection_id: connection ? String(connection._id) : null,
      });
    });

    if (sort === 'rating') enriched.sort((a, b) => b.rating - a.rating);
    else if (sort === 'experience') enriched.sort((a, b) => b.experience_years - a.experience_years);
    else enriched.sort((a, b) => b.relevance - a.relevance || b.rating - a.rating);

    res.json(enriched);
  });

  router.get('/mentors/:id', async (req, res) => {
    const db = getDB();
    const mentor = await db.collection('mentors').findOne({ _id: oid(req.params.id), ...collegeFilter(req) });
    if (!mentor) return sendError(res, 'Mentor not found.', 404);

    const [connection, reviews] = await Promise.all([
      db.collection('mentorship_connections').findOne({ mentorId: mentor._id, studentId: oid(req.user._id), ...collegeFilter(req) }),
      db.collection('mentorship_sessions')
        .find({ mentorId: mentor._id, rating: { $ne: null }, ...collegeFilter(req) })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray(),
    ]);

    res.json(serializeMentor(mentor, {
      connection_status: connection?.status || null,
      connection_id: connection ? String(connection._id) : null,
      reviews: reviews.map(r => ({
        student_name: r.studentName,
        rating: r.rating,
        feedback: r.feedback,
        at: r.createdAt,
      })),
    }));
  });

  // ── Connections ────────────────────────────────────────────────────────────
  router.post('/mentors/:id/request', async (req, res) => {
    const db = getDB();
    const mentor = await db.collection('mentors').findOne({ _id: oid(req.params.id), ...collegeFilter(req) });
    if (!mentor) return sendError(res, 'Mentor not found.', 404);

    const existing = await db.collection('mentorship_connections').findOne({
      mentorId: mentor._id,
      studentId: oid(req.user._id),
      status: { $in: ['pending', 'active'] },
      ...collegeFilter(req),
    });
    if (existing) return sendError(res, 'You already have a request with this mentor.', 409);

    const { goal, message, focusSkills } = req.body || {};
    if (!goal) return sendError(res, 'Tell the mentor what you want help with.', 400);

    const doc = {
      collegeId: oid(req.userCollegeId),
      mentorId: mentor._id,
      mentorName: mentor.name,
      mentorHeadline: mentor.headline,
      studentId: oid(req.user._id),
      studentName: req.user.name,
      studentEmail: req.user.email,
      status: 'pending',
      goal,
      message: message || null,
      focusSkills: Array.isArray(focusSkills) ? focusSkills : [],
      sessionsCount: 0,
      requestedAt: nowIso(),
    };

    const { insertedId } = await db.collection('mentorship_connections').insertOne(doc);
    const payload = serializeConnection({ ...doc, _id: insertedId });
    io.to(roomForUser(req.user._id)).emit('mentorship:request-sent', payload);
    res.status(201).json(payload);
  });

  router.get('/connections', async (req, res) => {
    const db = getDB();
    const filter = { studentId: oid(req.user._id), ...collegeFilter(req) };
    if (req.query.status) filter.status = req.query.status;

    const connections = await db.collection('mentorship_connections')
      .find(filter)
      .sort({ requestedAt: -1 })
      .toArray();

    res.json(connections.map(serializeConnection));
  });

  router.patch('/connections/:id', async (req, res) => {
    const db = getDB();
    const connection = await db.collection('mentorship_connections').findOne({
      _id: oid(req.params.id),
      studentId: oid(req.user._id),
      ...collegeFilter(req),
    });
    if (!connection) return sendError(res, 'Connection not found.', 404);

    const { status, goal, focusSkills } = req.body || {};
    const patch = {};
    if (status) {
      if (!['cancelled', 'completed'].includes(status)) {
        return sendError(res, 'You can only cancel or complete a connection.', 400);
      }
      patch.status = status;
      patch.respondedAt = nowIso();
    }
    if (goal) patch.goal = goal;
    if (Array.isArray(focusSkills)) patch.focusSkills = focusSkills;
    if (!Object.keys(patch).length) return sendError(res, 'Nothing to update.', 400);

    await db.collection('mentorship_connections').updateOne({ _id: connection._id, ...collegeFilter(req) }, { $set: patch });
    const updated = await db.collection('mentorship_connections').findOne({ _id: connection._id, ...collegeFilter(req) });
    res.json(serializeConnection(updated));
  });

  // Mentors in the seeded directory are external, so acceptance is simulated by
  // the placement cell / admin acting on their behalf.
  router.post('/connections/:id/accept', async (req, res) => {
    const db = getDB();
    const connection = await db.collection('mentorship_connections').findOne({ _id: oid(req.params.id), ...collegeFilter(req) });
    if (!connection) return sendError(res, 'Connection not found.', 404);

    const isStaff = ['college_admin', 'super_admin', 'faculty', 'collegeAdmin', 'superadmin'].includes(req.user.role);
    if (!isStaff) return sendError(res, 'Only staff can accept mentorship requests.', 403);
    if (connection.status !== 'pending') return sendError(res, 'This request is not pending.', 409);

    await db.collection('mentorship_connections').updateOne(
      { _id: connection._id, ...collegeFilter(req) },
      { $set: { status: 'active', respondedAt: nowIso() } },
    );

    io.to(roomForUser(connection.studentId)).emit('mentorship:request-accepted', {
      connection_id: String(connection._id),
      mentor_name: connection.mentorName,
    });
    res.json(serializeConnection({ ...connection, status: 'active', respondedAt: nowIso() }));
  });

  // ── Sessions ───────────────────────────────────────────────────────────────
  router.get('/sessions', async (req, res) => {
    const db = getDB();
    const filter = { studentId: oid(req.user._id), ...collegeFilter(req) };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.connectionId) filter.connectionId = oid(req.query.connectionId);

    const sessions = await db.collection('mentorship_sessions')
      .find(filter)
      .sort({ scheduledAt: 1 })
      .toArray();

    res.json(sessions.map(serializeSession));
  });

  router.post('/sessions', async (req, res) => {
    const db = getDB();
    const { connectionId, topic, agenda, scheduledAt, durationMinutes } = req.body || {};
    if (!connectionId) return sendError(res, 'connectionId is required.', 400);
    if (!topic) return sendError(res, 'topic is required.', 400);
    if (!scheduledAt) return sendError(res, 'scheduledAt is required.', 400);

    const connection = await db.collection('mentorship_connections').findOne({
      _id: oid(connectionId),
      studentId: oid(req.user._id),
      ...collegeFilter(req),
    });
    if (!connection) return sendError(res, 'Connection not found.', 404);
    if (connection.status !== 'active') return sendError(res, 'This mentorship is not active yet.', 409);

    const clash = await db.collection('mentorship_sessions').findOne({
      connectionId: connection._id,
      scheduledAt,
      status: 'scheduled',
      ...collegeFilter(req),
    });
    if (clash) return sendError(res, 'A session is already booked at that time.', 409);

    const doc = {
      collegeId: oid(req.userCollegeId),
      connectionId: connection._id,
      mentorId: connection.mentorId,
      mentorName: connection.mentorName,
      studentId: oid(req.user._id),
      studentName: req.user.name,
      topic,
      agenda: agenda || '',
      scheduledAt,
      durationMinutes: Number(durationMinutes) || 45,
      meetingUrl: null,
      status: 'scheduled',
      notes: null,
      actionItems: [],
      rating: null,
      feedback: null,
      createdAt: nowIso(),
    };

    const { insertedId } = await db.collection('mentorship_sessions').insertOne(doc);
    const payload = serializeSession({ ...doc, _id: insertedId });
    io.to(roomForUser(req.user._id)).emit('mentorship:session-booked', payload);
    res.status(201).json(payload);
  });

  router.patch('/sessions/:id', async (req, res) => {
    const db = getDB();
    const session = await db.collection('mentorship_sessions').findOne({
      _id: oid(req.params.id),
      studentId: oid(req.user._id),
      ...collegeFilter(req),
    });
    if (!session) return sendError(res, 'Session not found.', 404);

    const { status, notes, actionItems, scheduledAt, meetingUrl } = req.body || {};
    const patch = {};
    if (status) {
      if (!['scheduled', 'completed', 'cancelled', 'no_show'].includes(status)) {
        return sendError(res, 'Invalid session status.', 400);
      }
      patch.status = status;
      if (status === 'completed') patch.completedAt = nowIso();
    }
    if (notes !== undefined) patch.notes = notes;
    if (Array.isArray(actionItems)) patch.actionItems = actionItems;
    if (scheduledAt) patch.scheduledAt = scheduledAt;
    if (meetingUrl !== undefined) patch.meetingUrl = meetingUrl;
    if (!Object.keys(patch).length) return sendError(res, 'Nothing to update.', 400);

    await db.collection('mentorship_sessions').updateOne({ _id: session._id, ...collegeFilter(req) }, { $set: patch });

    if (patch.status === 'completed' && session.status !== 'completed') {
      await db.collection('mentorship_connections').updateOne(
        { _id: session.connectionId, ...collegeFilter(req) },
        { $inc: { sessionsCount: 1 } },
      );
      await db.collection('mentors').updateOne(
        { _id: session.mentorId, ...collegeFilter(req) },
        { $inc: { sessionsCompleted: 1 } },
      );
    }

    const updated = await db.collection('mentorship_sessions').findOne({ _id: session._id, ...collegeFilter(req) });
    res.json(serializeSession(updated));
  });

  router.post('/sessions/:id/feedback', async (req, res) => {
    const db = getDB();
    const session = await db.collection('mentorship_sessions').findOne({
      _id: oid(req.params.id),
      studentId: oid(req.user._id),
      ...collegeFilter(req),
    });
    if (!session) return sendError(res, 'Session not found.', 404);
    if (session.status !== 'completed') return sendError(res, 'Rate the session after it is completed.', 409);

    const rating = Number(req.body?.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return sendError(res, 'Rating must be between 1 and 5.', 400);
    }

    await db.collection('mentorship_sessions').updateOne(
      { _id: session._id },
      { $set: { rating, feedback: req.body?.feedback || null, ratedAt: nowIso() } },
    );

    // Recompute the mentor's rating from all rated sessions.
    const rated = await db.collection('mentorship_sessions')
      .find({ mentorId: session.mentorId, rating: { $ne: null }, ...collegeFilter(req) })
      .toArray();
    const avg = rated.length
      ? Number((rated.reduce((sum, r) => sum + (r.rating || 0), 0) / rated.length).toFixed(1))
      : rating;
    await db.collection('mentors').updateOne({ _id: session.mentorId, ...collegeFilter(req) }, { $set: { rating: avg } });

    res.json({ success: true, rating, mentor_rating: avg });
  });

  // ── Goals ──────────────────────────────────────────────────────────────────
  router.get('/goals', async (req, res) => {
    const db = getDB();
    const goals = await db.collection('mentorship_goals')
      .find({ studentId: oid(req.user._id), ...collegeFilter(req) })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(goals.map(serializeGoal));
  });

  router.post('/goals', async (req, res) => {
    const db = getDB();
    const { title, description, skillKey, targetDate, connectionId, milestones } = req.body || {};
    if (!title) return sendError(res, 'title is required.', 400);

    const doc = {
      collegeId: oid(req.userCollegeId),
      studentId: oid(req.user._id),
      connectionId: connectionId ? oid(connectionId) : null,
      title,
      description: description || '',
      skillKey: skillKey || null,
      targetDate: targetDate || null,
      status: 'active',
      progress: 0,
      milestones: Array.isArray(milestones)
        ? milestones.map(m => ({ title: String(m), done: false }))
        : [],
      createdAt: nowIso(),
      completedAt: null,
    };

    const { insertedId } = await db.collection('mentorship_goals').insertOne(doc);
    res.status(201).json(serializeGoal({ ...doc, _id: insertedId }));
  });

  router.patch('/goals/:id', async (req, res) => {
    const db = getDB();
    const goal = await db.collection('mentorship_goals').findOne({
      _id: oid(req.params.id),
      studentId: oid(req.user._id),
      ...collegeFilter(req),
    });
    if (!goal) return sendError(res, 'Goal not found.', 404);

    const { title, description, status, milestoneIndex, targetDate } = req.body || {};
    const patch = {};
    if (title) patch.title = title;
    if (description !== undefined) patch.description = description;
    if (targetDate !== undefined) patch.targetDate = targetDate;
    if (status) {
      if (!['active', 'completed', 'abandoned'].includes(status)) return sendError(res, 'Invalid goal status.', 400);
      patch.status = status;
      if (status === 'completed') {
        patch.completedAt = nowIso();
        patch.progress = 100;
      }
    }

    if (milestoneIndex != null) {
      const index = Number(milestoneIndex);
      const milestones = goal.milestones || [];
      if (!Number.isInteger(index) || index < 0 || index >= milestones.length) {
        return sendError(res, 'Invalid milestone index.', 400);
      }
      milestones[index] = { ...milestones[index], done: !milestones[index].done };
      patch.milestones = milestones;
      patch.progress = milestones.length
        ? Math.round((milestones.filter(m => m.done).length / milestones.length) * 100)
        : 0;
      if (patch.progress === 100 && !patch.status) {
        patch.status = 'completed';
        patch.completedAt = nowIso();
      }
    }

    if (!Object.keys(patch).length) return sendError(res, 'Nothing to update.', 400);

    await db.collection('mentorship_goals').updateOne({ _id: goal._id, ...collegeFilter(req) }, { $set: patch });
    const updated = await db.collection('mentorship_goals').findOne({ _id: goal._id, ...collegeFilter(req) });
    res.json(serializeGoal(updated));
  });

  router.delete('/goals/:id', async (req, res) => {
    const db = getDB();
    const result = await db.collection('mentorship_goals').deleteOne({
      _id: oid(req.params.id),
      studentId: oid(req.user._id),
      ...collegeFilter(req),
    });
    if (!result.deletedCount) return sendError(res, 'Goal not found.', 404);
    res.json({ success: true });
  });

  router.get('/overview', async (req, res) => {
    const db = getDB();
    await ensureCareerSeed(db);
    const studentId = oid(req.user._id);
    const collegeQ = collegeFilter(req);

    const [connections, sessions, goals] = await Promise.all([
      db.collection('mentorship_connections').find({ studentId, ...collegeQ }).toArray(),
      db.collection('mentorship_sessions').find({ studentId, ...collegeQ }).sort({ scheduledAt: 1 }).toArray(),
      db.collection('mentorship_goals').find({ studentId, ...collegeQ }).toArray(),
    ]);

    const upcoming = sessions.filter(s => s.status === 'scheduled' && new Date(s.scheduledAt) >= new Date());
    const completed = sessions.filter(s => s.status === 'completed');

    res.json({
      stats: {
        active_mentors: connections.filter(c => c.status === 'active').length,
        pending_requests: connections.filter(c => c.status === 'pending').length,
        upcoming_sessions: upcoming.length,
        completed_sessions: completed.length,
        total_hours: Math.round(completed.reduce((sum, s) => sum + (s.durationMinutes || 0), 0) / 60),
        active_goals: goals.filter(g => g.status === 'active').length,
        completed_goals: goals.filter(g => g.status === 'completed').length,
      },
      next_session: upcoming[0] ? serializeSession(upcoming[0]) : null,
      connections: connections.map(serializeConnection),
      upcoming_sessions: upcoming.slice(0, 5).map(serializeSession),
      goals: goals.map(serializeGoal),
    });
  });

  return router;
}

module.exports = { createMentorshipRouter };
