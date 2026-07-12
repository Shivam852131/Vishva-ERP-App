const express = require('express');
const { prisma } = require('../db');
const { authUser, requireRole } = require('../auth');
const { sendError } = require('../utils');

function notificationVisibleToUser(notification, user) {
  if (!user) return false;
  const recipientIds = Array.isArray(notification.recipientIds) ? notification.recipientIds : [];
  if (recipientIds.length > 0) return recipientIds.includes(user.id);
  if (notification.audience === 'all') return true;
  if (notification.audience === 'students') return user.role === 'student';
  if (notification.audience === 'faculty') return user.role === 'faculty';
  if (notification.audience === 'parents') return user.role === 'parent';
  if (notification.audience === 'admins') return ['college_admin', 'super_admin'].includes(user.role);
  return notification.audience === user.role;
}

function formatNotification(notification, user) {
  const readBy = Array.isArray(notification.readBy) ? notification.readBy : [];
  return {
    id: notification.id,
    audience: notification.audience,
    title: notification.title,
    body: notification.body,
    created_at: notification.createdAt.toISOString(),
    read: readBy.includes(user.id),
  };
}

function createNotificationsRouter(io) {
  const router = express.Router();

  router.get('/notifications', async (req, res) => {
    const user = await authUser(req);
    const notifications = await prisma.notification.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(notifications.filter(n => notificationVisibleToUser(n, user)).map(n => formatNotification(n, user)));
  });

  router.post('/notifications/read/:id', async (req, res) => {
    const user = await authUser(req);
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification) return sendError(res, 'Notification not found.', 404);
    const readBy = Array.isArray(notification.readBy) ? notification.readBy : [];
    if (!readBy.includes(user.id)) {
      await prisma.notification.update({ where: { id: notification.id }, data: { readBy: [...readBy, user.id] } });
    }
    io.emit('notifications:update', { notificationId: notification.id, userId: user.id });
    res.json({ ok: true });
  });

  router.get('/announcements', async (_req, res) => {
    const announcements = await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(announcements.map(a => ({
      id: a.id,
      title: a.title,
      body: a.body,
      audience: a.audience,
      created_by: a.createdById,
      created_at: a.createdAt.toISOString(),
    })));
  });

  router.post('/announcements', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const user = await authUser(req);
    const announcement = await prisma.announcement.create({
      data: {
        title: req.body.title || 'Announcement',
        body: req.body.body || '',
        audience: req.body.audience || 'all',
        createdById: user.id,
      },
    });
    const payload = {
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      audience: announcement.audience,
      created_by: announcement.createdById,
      created_at: announcement.createdAt.toISOString(),
    };
    io.emit('announcements:update', payload);
    await prisma.notification.create({
      data: {
        audience: announcement.audience === 'all' ? 'all' : announcement.audience,
        title: announcement.title,
        body: announcement.body,
        recipientIds: [],
        readBy: [],
      },
    });
    io.emit('notifications:update', { audience: announcement.audience, recipientIds: [] });
    res.json(payload);
  });

  return router;
}

module.exports = { createNotificationsRouter };
