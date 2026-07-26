const { Server } = require('socket.io');
const { userFromToken } = require('./auth');
const { roomForUser } = require('./utils');

// Created unattached so app.js (needed by both server.js and tests) can wire routers
// to `io` before an http.Server exists to attach it to. Call io.attach(httpServer)
// once the server is created.
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
    socket.emit('socket:ready', { ok: true, userId });

    // Live class rooms are only reachable by authenticated sockets; the HTTP
    // join endpoint is what actually records participation.
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
  });

  return io;
}

module.exports = { createSocketServer };
