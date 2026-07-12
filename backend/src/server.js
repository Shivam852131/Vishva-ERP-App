require('dotenv').config();
const http = require('http');
const pino = require('pino');

const { createApp } = require('./app');
const { createSocketServer } = require('./socket');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const PORT = Number(process.env.PORT || 8000);

const io = createSocketServer();
const app = createApp(io);
const server = http.createServer(app);
io.attach(server);

server.listen(PORT, () => {
  logger.info(`Vishva ERP backend listening on http://0.0.0.0:${PORT}`);
});
