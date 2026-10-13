const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { getDB, oid } = require('../db');
const { sendError, nowIso, makeCode, paginationParams, sendPaginated } = require('../utils');
const { requireRole, collegeFilter, collegeIdOrThrow } = require('../auth');

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 10;
const SESSION_DURATION_MS = 2 * 60 * 60 * 1000;
const MAX_SESSIONS_PER_HOUR = 5;
const MAX_PARTICIPANTS = 200;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const JOIN_RATE_LIMIT = { windowMs: 60 * 1000, max: 30 };
const DOWNLOAD_RATE_LIMIT = { windowMs: 60 * 1000, max: 100 };

let cleanupTimer = null;
let lastCleanupRun = null;
let cleanupStats = { totalCleaned: 0, errors: 0 };

function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'LS-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function generateSessionId() {
  return 'sess_' + crypto.randomBytes(8).toString('hex');
}

function serializeSession(doc, extra = {}) {
  return {
    id: String(doc._id),
    session_id: doc.sessionId,
    share_code: doc.shareCode,
    title: doc.title,
    description: doc.description || '',
    teacher_id: String(doc.teacherId),
    teacher_name: doc.teacherName,
    files: (doc.files || []).map(f => ({
      file_id: f.fileId,
      name: f.name,
      size: f.size,
      type: f.type,
      chunk_count: f.chunkCount,
    })),
    status: doc.status,
    max_participants: doc.maxParticipants,
    participant_count: doc.participantCount || 0,
    college_id: doc.collegeId ? String(doc.collegeId) : null,
    created_at: doc.createdAt,
    expires_at: doc.expiresAt,
    ended_at: doc.endedAt || null,
    ...extra,
  };
}

function serializeParticipant(doc) {
  return {
    id: String(doc._id),
    session_id: String(doc.sessionId),
    student_id: String(doc.studentId),
    student_name: doc.studentName,
    joined_at: doc.joinedAt,
    connection_status: doc.connectionStatus,
    files_received: doc.filesReceived || [],
    last_seen: doc.lastSeen,
  };
}

function serializeDownload(doc) {
  return {
    id: String(doc._id),
    session_id: String(doc.sessionId),
    student_id: String(doc.studentId),
    student_name: doc.studentName,
    file_id: doc.fileId,
    file_name: doc.fileName,
    file_size: doc.fileSize,
    started_at: doc.startedAt,
    completed_at: doc.completedAt || null,
    status: doc.status,
    duration: doc.duration || null,
    average_speed: doc.averageSpeed || null,
  };
}

async function auditLog(db, { sessionId, event, actorId, actorRole, details, ipAddress, collegeId }) {
  await db.collection('localshare_audit_logs').insertOne({
    sessionId: sessionId ? oid(sessionId) : null,
    event,
    actorId: actorId ? oid(actorId) : null,
    actorRole,
    details: details || {},
    ipAddress: ipAddress || null,
    collegeId: collegeId ? oid(collegeId) : null,
    timestamp: nowIso(),
  });
}

async function runCleanup(io) {
  const db = getDB();
  const now = new Date().toISOString();
  const expiredSessions = await db.collection('localshare_sessions').find({
    status: 'active',
    expiresAt: { $lte: now },
  }).toArray();

  if (expiredSessions.length === 0) return { cleaned: 0 };

  let cleaned = 0;
  for (const session of expiredSessions) {
    try {
      await db.collection('localshare_sessions').updateOne(
        { _id: session._id },
        { $set: { status: 'ended', endedAt: now, updatedAt: now } },
      );
      await db.collection('localshare_participants').updateMany(
        { sessionId: session._id, connectionStatus: { $ne: 'disconnected' } },
        { $set: { connectionStatus: 'disconnected', lastSeen: now } },
      );
      await auditLog(db, {
        sessionId: session._id,
        event: 'cleanup_expired',
        actorId: null,
        actorRole: 'system',
        details: { title: session.title, shareCode: session.shareCode },
      });
      if (io) {
        io.to(`localshare:${session.sessionId}`).emit('localshare:session-ended', {
          session_id: session.sessionId,
          ended_at: now,
          reason: 'expired',
        });
        io.to(`college:${String(session.collegeId)}`).emit('localshare:session-closed', {
          session_id: session.sessionId,
          ended_at: now,
        });
      }
      cleaned++;
    } catch (err) {
      cleanupStats.errors++;
    }
  }

  cleanupStats.totalCleaned += cleaned;
  lastCleanupRun = now;
  return { cleaned };
}

function startCleanupCron(io) {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => runCleanup(io), CLEANUP_INTERVAL_MS);
  if (cleanupTimer && cleanupTimer.unref) cleanupTimer.unref();
}

function stopCleanupCron() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

function createLocalShareRouter(io) {
  const router = express.Router();
  const joinLimiter = rateLimit({ windowMs: JOIN_RATE_LIMIT.windowMs, max: JOIN_RATE_LIMIT.max, standardHeaders: true, legacyHeaders: false, message: { detail: 'Too many join attempts. Please try again.' } });
  const downloadLimiter = rateLimit({ windowMs: DOWNLOAD_RATE_LIMIT.windowMs, max: DOWNLOAD_RATE_LIMIT.max, standardHeaders: true, legacyHeaders: false, message: { detail: 'Too many download requests. Please try again.' } });

  startCleanupCron(io);

  // ── Create Session ───────────────────────────────────────────────────────
  router.post('/localshare/sessions', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const { title, description, files } = req.body || {};

    if (!title || !String(title).trim()) return sendError(res, 'title is required.', 400);
    if (!Array.isArray(files) || files.length === 0) return sendError(res, 'At least one file is required.', 400);
    if (files.length > MAX_FILES) return sendError(res, `Maximum ${MAX_FILES} files allowed.`, 400);

    for (const f of files) {
      if (!f.name || !f.size || !f.type) return sendError(res, 'Each file must have name, size, and type.', 400);
      if (f.size > MAX_FILE_SIZE) return sendError(res, `File "${f.name}" exceeds 50MB limit.`, 400);
      if (!ALLOWED_MIME.has(f.type)) return sendError(res, `File type "${f.type}" is not allowed.`, 400);
    }

    const recentCount = await db.collection('localshare_sessions').countDocuments({
      teacherId: oid(req.user._id),
      createdAt: { $gte: new Date(Date.now() - 3600000).toISOString() },
      ...collegeFilter(req),
    });
    if (recentCount >= MAX_SESSIONS_PER_HOUR) {
      return sendError(res, `Rate limit: max ${MAX_SESSIONS_PER_HOUR} sessions per hour.`, 429);
    }

    const sessionId = generateSessionId();
    let shareCode = generateShareCode();
    for (let attempt = 0; attempt < 3; attempt++) {
      const existing = await db.collection('localshare_sessions').countDocuments({ shareCode });
      if (existing === 0) break;
      if (attempt === 2) return sendError(res, 'Could not generate unique share code. Try again.', 500);
      shareCode = generateShareCode();
    }
    const now = nowIso();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

    const doc = {
      sessionId,
      shareCode,
      collegeId: collegeIdOrThrow(req),
      teacherId: oid(req.user._id),
      teacherName: req.user.name,
      title: String(title).trim(),
      description: String(description || '').trim(),
      files: files.map(f => ({
        fileId: 'file_' + crypto.randomBytes(6).toString('hex'),
        name: f.name,
        size: f.size,
        type: f.type,
        checksum: f.checksum || null,
        chunkCount: Math.ceil(f.size / 65536),
      })),
      status: 'active',
      maxParticipants: MAX_PARTICIPANTS,
      participantCount: 0,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      endedAt: null,
    };

    const { insertedId } = await db.collection('localshare_sessions').insertOne(doc);

    await auditLog(db, {
      sessionId: insertedId,
      event: 'session_created',
      actorId: req.user._id,
      actorRole: req.user.role,
      details: { title: doc.title, fileCount: doc.files.length },
      ipAddress: req.ip,
      collegeId: req.userCollegeId,
    });

    io.to(`college:${req.userCollegeId}`).emit('localshare:session-created', serializeSession({ ...doc, _id: insertedId }));

    res.status(201).json(serializeSession({ ...doc, _id: insertedId }));
  });

  // ── List Sessions ────────────────────────────────────────────────────────
  router.get('/localshare/sessions', async (req, res) => {
    const db = getDB();
    const { status, scope } = req.query;
    const { page, pageSize, skip, limit } = paginationParams(req.query, { defaultSize: 20 });

    const filter = { ...collegeFilter(req) };
    if (status) filter.status = status;
    if (scope === 'mine' && ['faculty', 'college_admin', 'super_admin'].includes(req.user.role)) {
      filter.teacherId = oid(req.user._id);
    }
    if (scope === 'joined') {
      filter['participants.studentId'] = oid(req.user._id);
    }

    const [sessions, total] = await Promise.all([
      db.collection('localshare_sessions')
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('localshare_sessions').countDocuments(filter),
    ]);

    const sessionIds = sessions.map(s => s._id);
    const participantCounts = sessionIds.length
      ? await db.collection('localshare_participants').aggregate([
          { $match: { sessionId: { $in: sessionIds } } },
          { $group: { _id: '$sessionId', count: { $sum: 1 } } },
        ]).toArray()
      : [];

    const countMap = new Map(participantCounts.map(p => [String(p._id), p.count]));

    res.set('X-Total-Count', String(total));
    res.json(sessions.map(s => serializeSession(s, {
      participant_count: countMap.get(String(s._id)) || 0,
    })));
  });

  // ── Get Single Session ───────────────────────────────────────────────────
  router.get('/localshare/sessions/:id', async (req, res) => {
    const db = getDB();
    const session = await db.collection('localshare_sessions').findOne(
      { _id: oid(req.params.id), ...collegeFilter(req) },
    );
    if (!session) return sendError(res, 'Session not found.', 404);

    const participants = await db.collection('localshare_participants')
      .find({ sessionId: session._id })
      .sort({ joinedAt: 1 })
      .toArray();

    const downloads = await db.collection('localshare_downloads')
      .find({ sessionId: session._id })
      .sort({ startedAt: -1 })
      .limit(100)
      .toArray();

    res.json({
      ...serializeSession(session, {
        participant_count: participants.length,
        is_teacher: String(session.teacherId) === String(req.user._id),
      }),
      participants: participants.map(serializeParticipant),
      downloads: downloads.map(serializeDownload),
    });
  });

  // ── Join by Share Code ───────────────────────────────────────────────────
  router.get('/localshare/join/:code', joinLimiter, requireRole('student', 'faculty'), async (req, res) => {
    const db = getDB();
    const code = String(req.params.code).trim().toUpperCase();

    const session = await db.collection('localshare_sessions').findOne({
      shareCode: code,
      ...collegeFilter(req),
    });
    if (!session) return sendError(res, 'Session not found.', 404);
    if (session.status === 'ended') return sendError(res, 'This session has ended.', 409);
    if (new Date(session.expiresAt) < new Date()) return sendError(res, 'This session has expired.', 410);

    const participantCount = await db.collection('localshare_participants').countDocuments({ sessionId: session._id });
    if (participantCount >= session.maxParticipants) return sendError(res, 'Session is full.', 409);

    const existing = await db.collection('localshare_participants').findOne({
      sessionId: session._id,
      studentId: oid(req.user._id),
    });

    let participant;
    if (existing) {
      await db.collection('localshare_participants').updateOne(
        { _id: existing._id },
        { $set: { connectionStatus: 'reconnected', lastSeen: nowIso() } },
      );
      participant = { ...existing, connectionStatus: 'reconnected', lastSeen: nowIso() };
    } else {
      const doc = {
        sessionId: session._id,
        studentId: oid(req.user._id),
        studentName: req.user.name,
        joinedAt: nowIso(),
        connectionStatus: 'waiting',
        filesReceived: [],
        lastSeen: nowIso(),
        collegeId: oid(req.userCollegeId),
      };
      const { insertedId } = await db.collection('localshare_participants').insertOne(doc);
      participant = { ...doc, _id: insertedId };

      await db.collection('localshare_sessions').updateOne(
        { _id: session._id },
        { $inc: { participantCount: 1 }, $set: { updatedAt: nowIso() } },
      );

      await auditLog(db, {
        sessionId: session._id,
        event: 'student_joined',
        actorId: req.user._id,
        actorRole: req.user.role,
        details: { studentName: req.user.name },
        ipAddress: req.ip,
        collegeId: req.userCollegeId,
      });

      io.to(`localshare:${session.sessionId}`).emit('localshare:student-joined', {
        session_id: session.sessionId,
        student: serializeParticipant(participant),
        total_participants: participantCount + 1,
      });
    }

    res.json({
      session: serializeSession(session, { participant_count: participantCount + (existing ? 0 : 1) }),
      participant: serializeParticipant(participant),
    });
  });

  // ── End Session ──────────────────────────────────────────────────────────
  router.post('/localshare/sessions/:id/end', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const session = await db.collection('localshare_sessions').findOne(
      { _id: oid(req.params.id), ...collegeFilter(req) },
    );
    if (!session) return sendError(res, 'Session not found.', 404);
    if (String(session.teacherId) !== String(req.user._id) && !['college_admin', 'super_admin'].includes(req.user.role)) {
      return sendError(res, 'Only the session creator can end it.', 403);
    }
    if (session.status === 'ended') return sendError(res, 'Session already ended.', 409);

    const endedAt = nowIso();
    await db.collection('localshare_sessions').updateOne(
      { _id: session._id },
      { $set: { status: 'ended', endedAt, updatedAt: endedAt } },
    );

    await db.collection('localshare_participants').updateMany(
      { sessionId: session._id, connectionStatus: { $ne: 'disconnected' } },
      { $set: { connectionStatus: 'disconnected', lastSeen: endedAt } },
    );

    await auditLog(db, {
      sessionId: session._id,
      event: 'session_ended',
      actorId: req.user._id,
      actorRole: req.user.role,
      details: { duration: Date.now() - new Date(session.createdAt).getTime() },
      ipAddress: req.ip,
      collegeId: req.userCollegeId,
    });

    io.to(`localshare:${session.sessionId}`).emit('localshare:session-ended', {
      session_id: session.sessionId,
      ended_at: endedAt,
    });
    io.to(`college:${req.userCollegeId}`).emit('localshare:session-closed', {
      session_id: session.sessionId,
      ended_at: endedAt,
    });

    res.json(serializeSession({ ...session, status: 'ended', endedAt }));
  });

  // ── Delete Session ───────────────────────────────────────────────────────
  router.delete('/localshare/sessions/:id', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const session = await db.collection('localshare_sessions').findOne(
      { _id: oid(req.params.id), ...collegeFilter(req) },
    );
    if (!session) return sendError(res, 'Session not found.', 404);
    if (String(session.teacherId) !== String(req.user._id) && !['college_admin', 'super_admin'].includes(req.user.role)) {
      return sendError(res, 'Only the session creator can delete it.', 403);
    }

    await Promise.all([
      db.collection('localshare_sessions').deleteOne({ _id: session._id }),
      db.collection('localshare_participants').deleteMany({ sessionId: session._id }),
      db.collection('localshare_downloads').deleteMany({ sessionId: session._id }),
    ]);

    res.json({ success: true });
  });

  // ── Log Download (called after P2P transfer completes) ───────────────────
  router.post('/localshare/sessions/:id/downloads', downloadLimiter, requireRole('student', 'faculty'), async (req, res) => {
    const db = getDB();
    const { fileId, fileName, fileSize, duration, averageSpeed } = req.body || {};
    if (!fileId || !fileName) return sendError(res, 'fileId and fileName are required.', 400);

    const session = await db.collection('localshare_sessions').findOne(
      { _id: oid(req.params.id), ...collegeFilter(req) },
    );
    if (!session) return sendError(res, 'Session not found.', 404);

    const doc = {
      sessionId: session._id,
      studentId: oid(req.user._id),
      studentName: req.user.name,
      fileId,
      fileName,
      fileSize: fileSize || 0,
      startedAt: req.body.startedAt || nowIso(),
      completedAt: nowIso(),
      status: 'completed',
      duration: duration || null,
      averageSpeed: averageSpeed || null,
      collegeId: oid(req.userCollegeId),
    };

    const { insertedId } = await db.collection('localshare_downloads').insertOne(doc);

    await db.collection('localshare_participants').updateOne(
      { sessionId: session._id, studentId: oid(req.user._id) },
      { $addToSet: { filesReceived: fileId } },
    );

    await auditLog(db, {
      sessionId: session._id,
      event: 'file_completed',
      actorId: req.user._id,
      actorRole: req.user.role,
      details: { fileId, fileName, fileSize, duration },
      ipAddress: req.ip,
      collegeId: req.userCollegeId,
    });

    io.to(`localshare:${session.sessionId}`).emit('localshare:file-downloaded', {
      session_id: session.sessionId,
      student_id: String(req.user._id),
      student_name: req.user.name,
      file_id: fileId,
      file_name: fileName,
    });

    res.status(201).json({ id: String(insertedId), success: true });
  });

  // ── Session Status (polling fallback) ────────────────────────────────────
  router.get('/localshare/sessions/:id/status', async (req, res) => {
    const db = getDB();
    const session = await db.collection('localshare_sessions').findOne(
      { _id: oid(req.params.id), ...collegeFilter(req) },
      { projection: { status: 1, endedAt: 1, expiresAt: 1, participantCount: 1 } },
    );
    if (!session) return sendError(res, 'Session not found.', 404);

    res.json({
      session_id: session.sessionId,
      status: session.status,
      ended_at: session.endedAt || null,
      expires_at: session.expiresAt,
      participant_count: session.participantCount || 0,
    });
  });

  // ── Session Status by Share Code (student-friendly) ────────────────────
  router.get('/localshare/sessions/by-code/:code/status', async (req, res) => {
    const db = getDB();
    const code = String(req.params.code).trim().toUpperCase();
    const session = await db.collection('localshare_sessions').findOne(
      { shareCode: code, ...collegeFilter(req) },
      { projection: { sessionId: 1, status: 1, endedAt: 1, expiresAt: 1, participantCount: 1 } },
    );
    if (!session) return sendError(res, 'Session not found.', 404);

    res.json({
      session_id: session.sessionId,
      status: session.status,
      ended_at: session.endedAt || null,
      expires_at: session.expiresAt,
      participant_count: session.participantCount || 0,
    });
  });

  // ── Session History ──────────────────────────────────────────────────────
  router.get('/localshare/history', async (req, res) => {
    const db = getDB();
    const { page, pageSize, skip, limit } = paginationParams(req.query, { defaultSize: 20 });

    const filter = { ...collegeFilter(req), status: 'ended' };
    if (['faculty', 'college_admin', 'super_admin'].includes(req.user.role)) {
      if (req.query.scope === 'mine') filter.teacherId = oid(req.user._id);
    }

    const [sessions, total] = await Promise.all([
      db.collection('localshare_sessions')
        .find(filter)
        .sort({ endedAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('localshare_sessions').countDocuments(filter),
    ]);

    const sessionIds = sessions.map(s => s._id);
    const downloadStats = sessionIds.length
      ? await db.collection('localshare_downloads').aggregate([
          { $match: { sessionId: { $in: sessionIds } } },
          { $group: { _id: '$sessionId', totalDownloads: { $sum: 1 }, uniqueStudents: { $addToSet: '$studentId' } } },
          { $project: { totalDownloads: 1, uniqueStudents: { $size: '$uniqueStudents' } } },
        ]).toArray()
      : [];

    const statsMap = new Map(downloadStats.map(d => [String(d._id), d]));

    res.set('X-Total-Count', String(total));
    res.json(sessions.map(s => {
      const stats = statsMap.get(String(s._id)) || { totalDownloads: 0, uniqueStudents: 0 };
      return serializeSession(s, {
        total_downloads: stats.totalDownloads,
        unique_students: stats.uniqueStudents,
      });
    }));
  });

  // ── Session Monitoring (teacher view) ──────────────────────────────────
  router.get('/localshare/sessions/:id/monitor', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const session = await db.collection('localshare_sessions').findOne(
      { _id: oid(req.params.id), ...collegeFilter(req) },
    );
    if (!session) return sendError(res, 'Session not found.', 404);
    if (String(session.teacherId) !== String(req.user._id) && !['college_admin', 'super_admin'].includes(req.user.role)) {
      return sendError(res, 'Only the session creator can view monitoring data.', 403);
    }

    const [participants, downloads, feedback] = await Promise.all([
      db.collection('localshare_participants')
        .find({ sessionId: session._id })
        .sort({ joinedAt: 1 })
        .toArray(),
      db.collection('localshare_downloads')
        .find({ sessionId: session._id })
        .sort({ startedAt: -1 })
        .toArray(),
      db.collection('localshare_feedback')
        .find({ sessionId: session._id })
        .toArray(),
    ]);

    const participantStats = participants.map(p => {
      const studentDownloads = downloads.filter(d => String(d.studentId) === String(p.studentId));
      return {
        student_id: String(p.studentId),
        student_name: p.studentName,
        joined_at: p.joinedAt,
        connection_status: p.connectionStatus,
        files_downloaded: studentDownloads.length,
        total_bytes: studentDownloads.reduce((sum, d) => sum + (d.fileSize || 0), 0),
        avg_speed: studentDownloads.length > 0
          ? studentDownloads.reduce((sum, d) => sum + (parseFloat(d.averageSpeed) || 0), 0) / studentDownloads.length
          : 0,
      };
    });

    const avgFeedback = feedback.length > 0
      ? feedback.reduce((sum, f) => sum + (f.rating || 0), 0) / feedback.length
      : null;

    res.json({
      session: serializeSession(session),
      total_participants: participants.length,
      active_participants: participants.filter(p => p.connectionStatus === 'connected').length,
      total_downloads: downloads.length,
      total_bytes_transferred: downloads.reduce((sum, d) => sum + (d.fileSize || 0), 0),
      participants: participantStats,
      recent_downloads: downloads.slice(0, 50).map(serializeDownload),
      feedback_summary: {
        count: feedback.length,
        average_rating: avgFeedback ? Math.round(avgFeedback * 10) / 10 : null,
      },
    });
  });

  // ── Transfer Quality Feedback ────────────────────────────────────────────
  router.post('/localshare/sessions/:id/feedback', requireRole('student', 'faculty'), async (req, res) => {
    const db = getDB();
    const { rating, comment, issues } = req.body || {};

    if (!rating || rating < 1 || rating > 5) return sendError(res, 'Rating must be 1-5.', 400);

    const session = await db.collection('localshare_sessions').findOne(
      { _id: oid(req.params.id), ...collegeFilter(req) },
    );
    if (!session) return sendError(res, 'Session not found.', 404);

    const existing = await db.collection('localshare_feedback').findOne({
      sessionId: session._id,
      studentId: oid(req.user._id),
    });
    if (existing) return sendError(res, 'You already submitted feedback for this session.', 409);

    const doc = {
      sessionId: session._id,
      studentId: oid(req.user._id),
      studentName: req.user.name,
      rating: Number(rating),
      comment: String(comment || '').trim().slice(0, 500),
      issues: Array.isArray(issues) ? issues.slice(0, 10) : [],
      collegeId: oid(req.userCollegeId),
      createdAt: nowIso(),
    };

    const { insertedId } = await db.collection('localshare_feedback').insertOne(doc);

    await auditLog(db, {
      sessionId: session._id,
      event: 'feedback_submitted',
      actorId: req.user._id,
      actorRole: req.user.role,
      details: { rating: doc.rating, issues: doc.issues },
      ipAddress: req.ip,
      collegeId: req.userCollegeId,
    });

    res.status(201).json({ id: String(insertedId), success: true });
  });

  // ── Metrics (admin) ─────────────────────────────────────────────────────
  router.get('/localshare/metrics', requireRole('college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const now = new Date();
    const oneHourAgo = new Date(now - 3600000).toISOString();
    const oneDayAgo = new Date(now - 86400000).toISOString();

    const [activeSessions, totalSessions24h, totalDownloads24h, lastCleanup, activeParticipants] = await Promise.all([
      db.collection('localshare_sessions').countDocuments({ status: 'active' }),
      db.collection('localshare_sessions').countDocuments({ createdAt: { $gte: oneDayAgo } }),
      db.collection('localshare_downloads').countDocuments({ completedAt: { $gte: oneDayAgo } }),
      db.collection('localshare_audit_logs').findOne(
        { event: 'cleanup_expired' },
        { sort: { timestamp: -1 }, projection: { timestamp: 1, details: 1 } },
      ),
      db.collection('localshare_participants').countDocuments({ connectionStatus: 'connected' }),
    ]);

    res.json({
      active_sessions: activeSessions,
      active_participants: activeParticipants,
      sessions_last_24h: totalSessions24h,
      downloads_last_24h: totalDownloads24h,
      cleanup: {
        last_run: lastCleanup?.timestamp || null,
        total_cleaned: cleanupStats.totalCleaned,
        errors: cleanupStats.errors,
      },
    });
  });

  // ── Manual cleanup trigger (admin) ──────────────────────────────────────
  router.post('/localshare/cleanup', requireRole('college_admin', 'super_admin'), async (req, res) => {
    const result = await runCleanup(io);
    res.json({ success: true, ...result });
  });

  return router;
}

module.exports = { createLocalShareRouter, stopCleanupCron };
