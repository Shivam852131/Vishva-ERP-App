const { Server } = require('socket.io');
const { userFromToken } = require('./auth');
const { roomForUser } = require('./utils');
const { getDB, oid } = require('./db');

function createSocketServer() {
  const io = new Server({
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });

  io.on('connection', async socket => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    const user = await userFromToken(token);
    const userId = user ? String(user._id) : null;
    if (userId) socket.join(roomForUser(userId));
    if (user && user.collegeId) socket.join(`college:${String(user.collegeId)}`);
    socket.emit('socket:ready', { ok: true, userId });

    socket.on('live:subscribe', sessionId => {
      if (!userId || !sessionId) return;
      socket.join(`live:${String(sessionId)}`);
    });

    socket.on('live:unsubscribe', sessionId => {
      if (!sessionId) return;
      socket.leave(`live:${String(sessionId)}`);
    });

    socket.on('live:typing', payload => {
      if (!userId || !payload?.sessionId) return;
      socket.to(`live:${String(payload.sessionId)}`).emit('live:typing', {
        user_id: userId,
        user_name: user.name,
        typing: !!payload.typing,
      });
    });

    // ── LocalShare WebRTC Signaling ──────────────────────────────────────
    socket.on('localshare:join-room', async sessionId => {
      if (!userId || !sessionId) return;
      try {
        const db = getDB();
        const session = await db.collection('localshare_sessions').findOne({
          sessionId: String(sessionId),
          status: 'active',
        });
        if (!session) return;
        socket.join(`localshare:${String(sessionId)}`);
        socket.data.localshareSessionId = sessionId;
      } catch (_) {
        socket.join(`localshare:${String(sessionId)}`);
        socket.data.localshareSessionId = sessionId;
      }
    });

    socket.on('localshare:leave-room', sessionId => {
      if (!sessionId) return;
      socket.leave(`localshare:${String(sessionId)}`);
      socket.to(`localshare:${String(sessionId)}`).emit('localshare:peer-left', {
        session_id: String(sessionId),
        peer_id: userId,
      });
    });

    socket.on('localshare:rtc-offer', payload => {
      if (!userId || !payload) return;
      const { sessionId, targetStudentId, offer } = payload;
      if (!sessionId || !offer) return;

      if (targetStudentId) {
        io.to(roomForUser(targetStudentId)).emit('localshare:rtc-offer', {
          session_id: String(sessionId),
          teacher_id: userId,
          offer,
        });
      } else {
        socket.to(`localshare:${String(sessionId)}`).emit('localshare:rtc-offer', {
          session_id: String(sessionId),
          teacher_id: userId,
          offer,
        });
      }
    });

    socket.on('localshare:rtc-answer', payload => {
      if (!userId || !payload) return;
      const { sessionId, teacherId, answer } = payload;
      if (!sessionId || !answer) return;

      if (teacherId) {
        io.to(roomForUser(teacherId)).emit('localshare:rtc-answer', {
          session_id: String(sessionId),
          student_id: userId,
          answer,
        });
      } else {
        socket.to(`localshare:${String(sessionId)}`).emit('localshare:rtc-answer', {
          session_id: String(sessionId),
          student_id: userId,
          answer,
        });
      }
    });

    socket.on('localshare:ice-candidate', payload => {
      if (!userId || !payload) return;
      const { sessionId, targetId, candidate } = payload;
      if (!sessionId || !candidate) return;

      if (targetId) {
        io.to(roomForUser(targetId)).emit('localshare:ice-candidate', {
          session_id: String(sessionId),
          source_id: userId,
          candidate,
        });
      } else {
        socket.to(`localshare:${String(sessionId)}`).emit('localshare:ice-candidate', {
          session_id: String(sessionId),
          source_id: userId,
          candidate,
        });
      }
    });

    socket.on('localshare:transfer-progress', payload => {
      if (!userId || !payload) return;
      const { sessionId, fileId, received, total } = payload;
      if (!sessionId) return;

      socket.to(`localshare:${String(sessionId)}`).emit('localshare:transfer-progress', {
        session_id: String(sessionId),
        student_id: userId,
        file_id: fileId,
        received,
        total,
      });
    });

    socket.on('localshare:disconnect', () => {
      const sessionId = socket.data.localshareSessionId;
      if (sessionId) {
        socket.to(`localshare:${String(sessionId)}`).emit('localshare:peer-left', {
          session_id: String(sessionId),
          peer_id: userId,
        });
      }
    });

    socket.on('disconnect', () => {
      const sessionId = socket.data.localshareSessionId;
      if (sessionId && userId) {
        io.to(`localshare:${String(sessionId)}`).emit('localshare:teacher-disconnected', {
          session_id: String(sessionId),
          teacher_id: userId,
        });
      }
    });
  });

  return io;
}

module.exports = { createSocketServer };
