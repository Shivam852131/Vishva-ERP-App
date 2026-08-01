require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pino = require('pino');
const pinoHttp = require('pino-http');

const { authMiddleware } = require('./auth');
const { sendError } = require('./utils');

const authRoutes = require('./routes/auth');
const { router: dashboardRoutes } = require('./routes/dashboard');
const academicsRoutes = require('./routes/academics');
const { createAttendanceRouter } = require('./routes/attendance');
const { createAttendanceAnalyticsRouter } = require('./routes/attendance-analytics');
const { createFeesRouter } = require('./routes/fees');
const { createNotificationsRouter } = require('./routes/notifications');
const { createChatRouter } = require('./routes/chat');
const libraryRoutes = require('./routes/library');
const { createCampusRouter } = require('./routes/campus');
const adminUsersRoutes = require('./routes/admin-users');
const collegesRoutes = require('./routes/colleges');
const { createAiRouter } = require('./routes/ai');
const twilioRoutes = require('./routes/twilio');
const { createLiveClassesRouter } = require('./routes/live-classes');
const { createPlacementRouter } = require('./routes/placement');
const { createAssessmentsRouter } = require('./routes/assessments');
const { createMentorshipRouter } = require('./routes/mentorship');
const { createSkillsRouter, createCareerRouter } = require('./routes/skills');

function createApp(io) {
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  const app = express();

  const corsOrigins = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  if (!corsOrigins.length) {
    logger.warn('CORS_ORIGINS is not set — allowing all origins. Set CORS_ORIGINS in production.');
  }

  app.use(helmet());
  app.use(cors({ origin: corsOrigins.length ? corsOrigins : true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: req => req.url === '/health' } }));

  app.get('/', (_req, res) => {
    res.json({ service: 'Vishva ERP API', version: '1.0.0', health: '/health', docs: '/api' });
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'vishva-erp-backend', time: new Date().toISOString() });
  });

  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
  const registerLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
  const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });

  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth/register', registerLimiter);
  app.use('/api', apiLimiter);

  app.use('/api', authMiddleware);

  app.use('/api', authRoutes);
  app.use('/api', dashboardRoutes);
  app.use('/api', academicsRoutes);
  app.use('/api', createAttendanceRouter(io));
  app.use('/api', createAttendanceAnalyticsRouter(io));
  app.use('/api', createFeesRouter(io));
  app.use('/api', createNotificationsRouter(io));
  app.use('/api/chat', createChatRouter(io));
  app.use('/api/library', libraryRoutes);
  app.use('/api', createCampusRouter(io));
  app.use('/api/admin/users', adminUsersRoutes);
  app.use('/api', collegesRoutes);
  app.use('/api/ai', createAiRouter(io));
  app.use('/api', twilioRoutes);
  app.use('/api/live-classes', createLiveClassesRouter(io));
  app.use('/api/placement', createPlacementRouter(io));
  app.use('/api/assessments', createAssessmentsRouter(io));
  app.use('/api/mentorship', createMentorshipRouter(io));
  app.use('/api/skills', createSkillsRouter(io));
  app.use('/api/career', createCareerRouter(io));

  app.use('/api', (_req, res) => {
    sendError(res, 'Route not found.', 404);
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    (req.log || logger).error({ err }, 'Unhandled request error');
    if (res.headersSent) return;
    sendError(res, err.publicMessage || 'Internal server error.', err.status || 500);
  });

  return app;
}

module.exports = { createApp };
