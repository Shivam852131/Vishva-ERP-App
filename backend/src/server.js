require('dotenv').config();
const http = require('http');
const cluster = require('cluster');
const os = require('os');
const pino = require('pino');

const { connectDB, closeDB } = require('./db');
const { createApp } = require('./app');
const { createSocketServer } = require('./socket');
const { loadModels, shutdown: shutdownFaceVerify } = require('./faceVerify');
const { stopCleanupCron } = require('./routes/localshare');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const PORT = Number(process.env.PORT || 8000);
const CLUSTER_ENABLED = process.env.CLUSTER_MODE === 'true';

let server = null;
let mlModelsLoaded = false;
let mlModelsLoading = false;

function getMlStatus() {
  return { loaded: mlModelsLoaded, loading: mlModelsLoading };
}

async function main() {
  if (CLUSTER_ENABLED && cluster.isPrimary) {
    const numCPUs = Math.min(os.cpus().length, Number(process.env.MAX_WORKERS || 8));
    logger.info(`Primary cluster manager running. Forking ${numCPUs} worker processes...`);

    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      logger.warn({ pid: worker.process.pid, code, signal }, 'Worker process died. Forking replacement worker...');
      cluster.fork();
    });
    return;
  }

  await connectDB();
  logger.info(`[Worker ${process.pid}] MongoDB connected.`);

  // Load ML models in background — don't block server startup
  mlModelsLoading = true;
  loadModels().then(ok => {
    mlModelsLoaded = ok;
    mlModelsLoading = false;
    if (ok) logger.info(`[Worker ${process.pid}] Face verification ML models loaded successfully.`);
    else logger.warn(`[Worker ${process.pid}] Face verification models failed to load — face check-in will be degraded.`);
  }).catch(err => {
    mlModelsLoaded = false;
    mlModelsLoading = false;
    logger.warn({ err: err.message }, `[Worker ${process.pid}] Face verification model load failed.`);
  });

  const io = createSocketServer();
  const app = createApp(io);
  server = http.createServer(app);
  io.attach(server);

  // Expose ML status on health endpoint via app locals
  app.set('mlStatus', () => ({ loaded: mlModelsLoaded, loading: mlModelsLoading }));

  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`[Worker ${process.pid}] Vishva ERP backend listening on http://0.0.0.0:${PORT}`);
    if (process.env.NODE_ENV === 'production' && (!CLUSTER_ENABLED || cluster.isPrimary)) {
      logger.info('Running in PRODUCTION mode');
      startKeepAlive();
    } else {
      logger.info(`Running in ${process.env.NODE_ENV || 'development'} mode`);
    }
  });

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

async function gracefulShutdown() {
  logger.info('Shutting down gracefully...');
  stopCleanupCron();
  await shutdownFaceVerify();
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
  let failures = 0;
  const MAX_FAILURES = 5;
  const BASE_INTERVAL = 5 * 60 * 1000;
  const MAX_INTERVAL = 30 * 60 * 1000;

  function schedulePing() {
    const jitter = Math.random() * 60 * 1000;
    const interval = Math.min(BASE_INTERVAL * Math.pow(2, failures), MAX_INTERVAL) + jitter;
    setTimeout(async () => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
        if (res.ok) {
          failures = 0;
          logger.info(`Keep-alive ping: ${res.status}`);
        } else {
          failures++;
          logger.warn(`Keep-alive ping HTTP ${res.status} (${failures}/${MAX_FAILURES})`);
        }
      } catch (err) {
        failures++;
        logger.warn({ err: err.message }, `Keep-alive ping failed (${failures}/${MAX_FAILURES})`);
      }
      if (failures < MAX_FAILURES) {
        schedulePing();
      } else {
        logger.error(`Keep-alive stopped after ${MAX_FAILURES} consecutive failures`);
      }
    }, interval);
  }

  logger.info(`Keep-alive started — pinging ${url} (max ${MAX_FAILURES} retries)`);
  schedulePing();
}

module.exports = { getMlStatus };

main().catch(err => {
  logger.error(err, 'Failed to start server');
  process.exit(1);
});
