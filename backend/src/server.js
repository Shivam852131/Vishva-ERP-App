require('dotenv').config();
const http = require('http');
const pino = require('pino');

const { connectDB, closeDB } = require('./db');
const { createApp } = require('./app');
const { createSocketServer } = require('./socket');
const { loadModels } = require('./faceVerify');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const PORT = Number(process.env.PORT || 8000);

let server = null;

async function main() {
  await connectDB();
  logger.info('MongoDB connected.');

  logger.info('Loading face-api ML models...');
  const modelsOk = await loadModels();
  if (modelsOk) {
    logger.info('Face verification ML models loaded successfully.');
  } else {
    logger.warn('Face verification models failed to load — face check-in will be degraded.');
  }

  const io = createSocketServer();
  const app = createApp(io);
  server = http.createServer(app);
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

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

async function gracefulShutdown() {
  logger.info('Shutting down gracefully...');
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed.');
    });
  }
  await closeDB();
  process.exit(0);
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
