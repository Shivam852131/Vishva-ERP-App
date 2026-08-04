const { getDB, oid } = require('../db');
const { collegeFilter, requireCollegeAccess } = require('../auth');
const { serializeUser, sendError, makeCode, nowIso, isoDate, paginationParams, sendPaginated, roomForUser } = require('../utils');

function notificationVisibleToUser(notification, user) {
  if (notification.audience === 'all') return true;
  if (notification.recipientIds && notification.recipientIds.length > 0) {
    const uid = typeof user._id === 'string' ? user._id : user._id.toString();
    return notification.recipientIds.some(id => id.toString() === uid);
  }
  return true;
}

function createNotificationsRouter(io) {
  const { Router } = require('express');
  const router = Router();

  router.get('/notifications', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const all = await db.collection('notifications')
        .find({ ...collegeFilter(req) })
        .sort({ createdAt: -1 })
        .toArray();
      const visible = all.filter(n => notificationVisibleToUser(n, req.user));
      res.json(visible);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/notifications/read/:id', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const userId = oid(req.user._id);
      await db.collection('notifications').updateOne(
        { _id: oid(req.params.id), ...collegeFilter(req) },
        { $addToSet: { readBy: userId } }
      );
      const updated = await db.collection('notifications').findOne({ _id: oid(req.params.id), ...collegeFilter(req) });
      if (io) io.to(roomForUser(req.user._id)).emit('notifications:update', updated);
      res.json(updated);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/notifications/read-all', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const userId = oid(req.user._id);
      await db.collection('notifications').updateMany(
        { readBy: { $ne: userId }, ...collegeFilter(req) },
        { $addToSet: { readBy: userId } }
      );
      res.json({ ok: true });
    } catch (e) {
      sendError(res, e);
    }
  });

  router.get('/announcements', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const announcements = await db.collection('announcements')
        .find({ ...collegeFilter(req) })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(announcements);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/announcements', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const { title, body, audience } = req.body;

      const announcement = {
        title,
        body,
        audience,
        collegeId: oid(req.userCollegeId),
        createdById: oid(req.user._id),
        createdAt: nowIso(),
      };
      const annResult = await db.collection('announcements').insertOne(announcement);
      announcement._id = annResult.insertedId;

      let recipientFilter = {};
      if (req.userCollegeId && !req.isSuperAdmin) {
        recipientFilter.collegeId = oid(req.userCollegeId);
      }

      let recipientIds = [];
      if (audience === 'all') {
        const users = await db.collection('users').find(recipientFilter).project({ _id: 1 }).toArray();
        recipientIds = users.map(u => u._id);
      } else {
        const roleMap = { students: 'student', faculty: 'faculty', admins: 'admin' };
        const role = roleMap[audience];
        if (role) {
          const users = await db.collection('users').find({ role, ...recipientFilter }).project({ _id: 1 }).toArray();
          recipientIds = users.map(u => u._id);
        }
      }

      const notification = {
        audience: audience === 'all' ? 'all' : 'individual',
        title,
        body,
        collegeId: oid(req.userCollegeId),
        recipientIds,
        readBy: [],
        createdAt: nowIso(),
      };
      const notifResult = await db.collection('notifications').insertOne(notification);
      notification._id = notifResult.insertedId;

      if (io) io.emit('announcements:update', announcement);

      res.json(announcement);
    } catch (e) {
      sendError(res, e);
    }
  });

  return router;
}

module.exports = { createNotificationsRouter };
