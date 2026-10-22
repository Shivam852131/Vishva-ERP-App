/**
 * Google Workspace routes — status, Sheets live-sync controls and
 * on-demand Google Meet link creation.
 *
 *   GET  /google/status                 — what's configured / connected
 *   POST /google/sheets/connect         — create the college's sync spreadsheet
 *   POST /google/sheets/disable         — pause real-time sync (keep the sheet)
 *   POST /google/sheets/sync-now        — flush the queue immediately
 *   POST /google/meet/link              — mint a Meet link for a live class
 *                                        or mentorship session
 */

const express = require('express');
const { z } = require('zod');
const { getDB, oid } = require('../db');
const { sendError, nowIso, roomForUser } = require('../utils');
const { requireRole, collegeIdOrThrow } = require('../auth');
const googleAuth = require('../services/googleAuth');
const { createMeetEvent } = require('../services/googleMeet');
const {
  connectSpreadsheet, adoptSpreadsheet, setSyncEnabled, getSyncStatus, flushSheetSyncQueue, startSheetSyncWorker,
} = require('../services/googleSheets');

function createGoogleRouter(io) {
  const router = express.Router();

  router.get('/google/status', async (req, res) => {
    const collegeId = collegeIdOrThrow(req);
    const sheets = collegeId ? await getSyncStatus(collegeId) : { configured: false, connected: false, pending: 0 };
    res.json({
      sign_in: { configured: googleAuth.isSignInConfigured() },
      api: {
        serviceAccount: googleAuth.isServiceAccountConfigured(),
        serviceAccountEmail: googleAuth.SERVICE_ACCOUNT_EMAIL || null,
      },
      meet: {
        configured: googleAuth.isServiceAccountConfigured(),
        // Google Meet needs a Workspace account, so we always stand a free
        // Jitsi room up as the fallback.
        fallback: 'jitsi',
      },
      sheets: { ...sheets, requiresOwnedSheet: true },
    });
  });

  router.post('/google/sheets/connect', requireRole('college_admin', 'super_admin'), async (req, res) => {
    try {
      const collegeId = collegeIdOrThrow(req);
      if (!collegeId) return sendError(res, 'No college assigned to your account.', 403);
      const db = getDB();
      const college = await db.collection('colleges').findOne(
        { _id: oid(collegeId) },
        { projection: { name: 1 } },
      );
      // Preferred path: a spreadsheet the college already owns and shared with
      // the service account (the SA cannot own files — no Drive storage).
      const supplied = req.body?.spreadsheetUrl || req.body?.spreadsheetId;
      const config = supplied
        ? await adoptSpreadsheet(collegeId, college?.name, supplied)
        : await connectSpreadsheet(collegeId, college?.name, { shareWith: req.user?.email || null });
      startSheetSyncWorker();
      res.json({
        connected: true,
        spreadsheetId: config.spreadsheetId,
        spreadsheetUrl: config.spreadsheetUrl,
        ownedBy: config.ownedBy || 'service_account',
      });
    } catch (err) {
      sendError(res, err.message || 'Could not connect Google Sheets.', err.status && err.status >= 400 ? err.status : 500);
    }
  });

  router.post('/google/sheets/disable', requireRole('college_admin', 'super_admin'), async (req, res) => {
    const collegeId = collegeIdOrThrow(req);
    if (!collegeId) return sendError(res, 'No college assigned to your account.', 403);
    const config = await setSyncEnabled(collegeId, false);
    if (!config) return sendError(res, 'Google Sheets is not connected yet.', 404);
    res.json({ connected: false, spreadsheetUrl: config.spreadsheetUrl });
  });

  router.post('/google/sheets/enable', requireRole('college_admin', 'super_admin'), async (req, res) => {
    const collegeId = collegeIdOrThrow(req);
    if (!collegeId) return sendError(res, 'No college assigned to your account.', 403);
    const config = await setSyncEnabled(collegeId, true, req.body?.types);
    if (!config) return sendError(res, 'Google Sheets is not connected yet.', 404);
    startSheetSyncWorker();
    res.json({ connected: true, spreadsheetUrl: config.spreadsheetUrl, types: config.types || null });
  });

  router.post('/google/sheets/sync-now', requireRole('college_admin', 'super_admin'), async (req, res) => {
    const result = await flushSheetSyncQueue();
    const collegeId = collegeIdOrThrow(req);
    const status = collegeId ? await getSyncStatus(collegeId) : null;
    res.json({ flushed: result.processed || 0, status });
  });

  // ── Google Meet link for an existing live class / mentorship session ──
  const meetLinkSchema = z.object({
    targetType: z.enum(['live_class', 'mentorship_session']),
    targetId: z.string().trim().min(1),
  });

  router.post('/google/meet/link', async (req, res) => {
    const parsed = meetLinkSchema.safeParse(req.body || {});
    if (!parsed.success) return sendError(res, 'targetType and targetId are required.', 400);
    const { targetType, targetId } = parsed.data;
    const db = getDB();

    try {
      if (targetType === 'live_class') {
        const session = await db.collection('live_sessions').findOne({ _id: oid(targetId) });
        if (!session) return sendError(res, 'Live class not found.', 404);
        const isHost = String(session.hostId) === String(req.user._id);
        const isAdmin = req.user.role === 'college_admin' || req.user.role === 'collegeAdmin' || req.isSuperAdmin;
        if (!isHost && !isAdmin) return sendError(res, 'Only the class host can create the meeting link.', 403);
        if (session.meetingUrl) return res.json({ meeting_url: session.meetingUrl, existing: true });

        const meet = await createMeetEvent({
          summary: session.title,
          description: session.description || 'Live class on Vishva ERP',
          startIso: session.scheduledAt,
          durationMinutes: session.durationMinutes,
          roomSeed: `live-class-${targetId}`,
        });
        await db.collection('live_sessions').updateOne(
          { _id: session._id },
          { $set: { meetingUrl: meet.meetUrl, meetCalendarEventId: meet.calendarEventId, updatedAt: nowIso() } },
        );
        const updated = await db.collection('live_sessions').findOne({ _id: session._id });
        io.to(`live:${String(session._id)}`).emit('live:updated', {
          id: String(session._id),
          meeting_url: updated.meetingUrl,
        });
        return res.json({ meeting_url: meet.meetUrl, calendar_event_id: meet.calendarEventId });
      }

      // mentorship_session
      const session = await db.collection('mentorship_sessions').findOne({ _id: oid(targetId) });
      if (!session) return sendError(res, 'Session not found.', 404);
      if (String(session.studentId) !== String(req.user._id) && !req.isSuperAdmin) {
        return sendError(res, 'You cannot create a link for this session.', 403);
      }
      if (session.meetingUrl) return res.json({ meeting_url: session.meetingUrl, existing: true });

      const meet = await createMeetEvent({
        summary: `Mentorship: ${session.topic}`,
        description: session.agenda || `Mentorship session with ${session.mentorName}`,
        startIso: session.scheduledAt,
        durationMinutes: session.durationMinutes,
        roomSeed: `mentorship-${targetId}`,
      });
      await db.collection('mentorship_sessions').updateOne(
        { _id: session._id },
        { $set: { meetingUrl: meet.meetUrl, meetCalendarEventId: meet.calendarEventId } },
      );
      io.to(roomForUser(session.studentId)).emit('mentorship:session-updated', {
        id: String(session._id),
        meeting_url: meet.meetUrl,
      });
      return res.json({ meeting_url: meet.meetUrl, calendar_event_id: meet.calendarEventId });
    } catch (err) {
      if (err.code === 'GOOGLE_NOT_CONFIGURED') {
        return sendError(res, 'Google Meet is not configured on this server yet.', 503);
      }
      sendError(res, err.message || 'Could not create the Google Meet link.', 500);
    }
  });

  return router;
}

module.exports = { createGoogleRouter };
