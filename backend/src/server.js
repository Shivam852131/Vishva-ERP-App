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
    } else {
      logger.info('Running in DEVELOPMENT mode');
    }
  });
}

main().catch(err => {
  logger.error(err, 'Failed to start server');
  process.exit(1);
});
