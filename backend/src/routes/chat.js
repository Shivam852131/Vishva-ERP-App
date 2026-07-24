const express = require('express');
const { getDB, oid } = require('../db');
const { serializeUser, sendError, makeCode, nowIso } = require('../utils');

function createChatRouter(io) {
  const router = express.Router();

  router.get('/users', async (req, res) => {
    try {
      const db = getDB();
      const currentUserId = req.user._id;

      const users = await db.collection('users')
        .find({ _id: { $ne: oid(currentUserId) } })
        .project({ name: 1, role: 1 })
        .toArray();

      const result = await Promise.all(users.map(async (user) => {
        const lastMessage = await db.collection('chat_messages')
          .findOne(
            {
              $or: [
                { senderId: oid(currentUserId), receiverId: user._id },
                { senderId: user._id, receiverId: oid(currentUserId) },
              ],
            },
            { sort: { createdAt: -1 } }
          );

        return {
          id: user._id.toString(),
          name: user.name,
          role: user.role,
          lastMessage: lastMessage
            ? { content: lastMessage.content, createdAt: lastMessage.createdAt }
            : null,
        };
      }));

      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/messages/:userId', async (req, res) => {
    try {
      const db = getDB();
      const currentUserId = req.user._id;
      const otherUserId = req.params.userId;

      const messages = await db.collection('chat_messages')
        .find({
          $or: [
            { senderId: oid(currentUserId), receiverId: oid(otherUserId) },
            { senderId: oid(otherUserId), receiverId: oid(currentUserId) },
          ],
        })
        .sort({ createdAt: 1 })
        .toArray();

      await db.collection('chat_messages').updateMany(
        { senderId: oid(otherUserId), receiverId: oid(currentUserId), read: false },
        { $set: { read: true } }
      );

      res.json(messages);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/messages', async (req, res) => {
    try {
      const db = getDB();
      const currentUserId = req.user._id;
      const { receiverId, content } = req.body;

      const message = {
        senderId: oid(currentUserId),
        receiverId: oid(receiverId),
        content,
        read: false,
        createdAt: nowIso(),
      };

      const { insertedId } = await db.collection('chat_messages').insertOne(message);

      const savedMessage = { ...message, _id: insertedId };

      io.to(receiverId.toString()).emit('chat:message', savedMessage);

      const receiver = await db.collection('users').findOne(
        { _id: oid(receiverId) },
        { projection: { name: 1 } }
      );

      const sender = await db.collection('users').findOne(
        { _id: oid(currentUserId) },
        { projection: { name: 1 } }
      );

      if (receiver) {
        await db.collection('notifications').insertOne({
          audience: 'individual',
          title: 'New Message',
          body: `${sender?.name || 'Someone'} sent you a message`,
          recipientIds: [oid(receiverId)],
          readBy: [],
          createdAt: nowIso(),
        });
      }

      res.status(201).json(savedMessage);
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
}

module.exports = { createChatRouter };
