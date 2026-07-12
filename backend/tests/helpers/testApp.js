const { createApp } = require('../../src/app');
const { createSocketServer } = require('../../src/socket');

// createSocketServer() returns an unattached socket.io instance — emit() calls are
// harmless no-ops with no http server attached, which is all routers need in tests.
function buildTestApp() {
  const io = createSocketServer();
  return createApp(io);
}

module.exports = { buildTestApp };
