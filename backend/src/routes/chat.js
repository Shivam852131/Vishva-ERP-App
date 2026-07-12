const express = require('express');
const { prisma } = require('../db');
const { authUser } = require('../auth');
const { sendError, roomForUser } = require('../utils');

function serializeMessage(message) {
  return {
    id: message.id,
    from_id: message.fromId,
    from_name: message.from.name,
    to_id: message.toId,
    message: message.message,
    created_at: message.createdAt.toISOString(),
  };
}

function createChatRouter(io) {
  const router = express.Router();

  async function pushNotification({ audience = 'all', title, body, recipientIds = [] }) {
    await prisma.notification.create({ data: { audience, title, body, recipientIds, readBy: [] } });
    io.emit('notifications:update', { audience, recipientIds });
  }

  router.get('/chat/users', async (req, res) => {
    const user = await authUser(req);
    const users = await prisma.user.findMany({
      where: { role: { in: ['faculty', 'student', 'college_admin'] }, id: { not: user.id } },
    });
    res.json(users.map(item => ({ id: item.id, name: item.name, email: item.email, role: item.role })));
  });

  router.get('/chat/:userId', async (req, res) => {
    const user = await authUser(req);
    const otherId = req.params.userId;
    const messages = await prisma.chatMessage.findMany({
      where: {
        OR: [
          { fromId: user.id, toId: otherId },
          { fromId: otherId, toId: user.id },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: { from: true },
    });
    res.json(messages.map(serializeMessage));
  });

  router.post('/chat/send', async (req, res) => {
    const user = await authUser(req);
    const receiver = await prisma.user.findUnique({ where: { id: req.body.to_user_id } });
    if (!receiver) return sendError(res, 'Recipient not found.', 404);
    const message = await prisma.chatMessage.create({
      data: { fromId: user.id, toId: receiver.id, message: req.body.message || '' },
      include: { from: true },
    });
    const payload = serializeMessage(message);
    io.to(roomForUser(user.id)).emit('chat:message', payload);
    io.to(roomForUser(receiver.id)).emit('chat:message', payload);
    io.emit('chat:message', payload);
    await pushNotification({ audience: receiver.role, title: `New message from ${user.name}`, body: payload.message, recipientIds: [receiver.id] });
    res.json(payload);
  });

  return router;
}

module.exports = { createChatRouter };
