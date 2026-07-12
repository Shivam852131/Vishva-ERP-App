const { Server } = require('socket.io');
const { userFromToken } = require('./auth');
const { roomForUser } = require('./utils');

function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });

  io.on('connection', async socket => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    const user = await userFromToken(token);
    if (user) socket.join(roomForUser(user.id));
    socket.emit('socket:ready', { ok: true, userId: user ? user.id : null });
  });

  return io;
}

module.exports = { createSocketServer };
