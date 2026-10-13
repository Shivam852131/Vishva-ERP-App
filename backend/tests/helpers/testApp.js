const { createApp } = require('../../src/app');
const { createSocketServer } = require('../../src/socket');

function createMockIo() {
  const handler = { emit: () => {} };
  return {
    to: () => handler,
    in: () => handler,
    emit: () => {},
    on: () => {},
    attach: () => {},
    close: (cb) => { if (cb) cb(); },
  };
}

function buildTestApp(io = createMockIo()) {
  return createApp(io);
}

module.exports = { buildTestApp, createMockIo };
