require('dotenv').config();
const http = require('http');
const pino = require('pino');

const { connectDB } = require('./db');
const { createApp } = require('./app');
const { createSocketServer } = require('./socket');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const PORT = Number(process.env.PORT || 8000);

async function main() {
  await connectDB();
  logger.info('MongoDB connected.');

  const io = createSocketServer();
  const app = createApp(io);
  const server = http.createServer(app);
  io.attach(server);

  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`Vishva ERP backend listening on http://0.0.0.0:${PORT}`);
    if (process.env.NODE_ENV === 'production') {
      logger.info('Running in PRODUCTION mode');
      startKeepAlive();
    } else {
      logger.info('Running in DEVELOPMENT mode');
    }
  });
}

function startKeepAlive() {
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || 'https://vishva-erp-app.onrender.com';
  if (!RENDER_URL) {
    logger.warn('No RENDER_EXTERNAL_URL set — keep-alive disabled');
    return;
  }
  const url = `${RENDER_URL}/health`;
  logger.info(`Keep-alive started — pinging ${url} every 5 min`);
  setInterval(async () => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      logger.info(`Keep-alive ping: ${res.status}`);
    } catch (err) {
      logger.warn({ err: err.message }, 'Keep-alive ping failed');
    }
  }, 5 * 60 * 1000);
}

main().catch(err => {
  logger.error(err, 'Failed to start server');
  process.exit(1);
});
