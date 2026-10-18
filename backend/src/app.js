require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pino = require('pino');
const pinoHttp = require('pino-http');

const compression = require('compression');
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
const { router: paymentConfigRoutes } = require('./routes/payment-config');
const collegePaymentsRoutes = require('./routes/college-payments');
const { createWebhookRouter } = require('./routes/webhooks');
const { createAiRouter } = require('./routes/ai');
const twilioRoutes = require('./routes/twilio');
const { createLiveClassesRouter } = require('./routes/live-classes');
const { createPlacementRouter } = require('./routes/placement');
const { createAssessmentsRouter } = require('./routes/assessments');
const { createMentorshipRouter } = require('./routes/mentorship');
const { createSkillsRouter, createCareerRouter } = require('./routes/skills');
const uploadRoutes = require('./routes/upload');
const { createLocalShareRouter } = require('./routes/localshare');
const { createExamPrepRouter } = require('./routes/exam-prep');
const { createReportsRouter } = require('./routes/reports');
const gatepassRoutes = require('./routes/gatepass');
const canteenRoutes = require('./routes/canteen');
const admissionRoutes = require('./routes/admission');
const { createGoogleRouter } = require('./routes/google');
const { startSheetSyncWorker } = require('./services/googleSheets');

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
  app.use(compression());
  app.use(cors({ origin: corsOrigins.length ? corsOrigins : true, credentials: true }));

  app.use('/api/webhooks/razorpay', express.raw({ type: 'application/json' }));
  app.use(express.json({ limit: '10mb' }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: req => req.url === '/health' } }));

  app.get('/', (_req, res) => {
    res.json({ service: 'Vishva ERP API', version: '1.0.0', health: '/health', docs: '/api' });
  });

  app.get('/health', (_req, res) => {
    const getMl = app.get('mlStatus');
    const ml = getMl ? getMl() : { loaded: false, loading: false };
    res.json({
      ok: true,
      service: 'vishva-erp-backend',
      time: new Date().toISOString(),
      ml: { modelsLoaded: ml.loaded, modelsLoading: ml.loading },
    });
  });

  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
  const registerLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
  const googleAuthLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { detail: 'Too many Google sign-in attempts. Please try again later.' } });
  const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
  const whatsappLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { detail: 'Too many WhatsApp requests. Please try again later.' } });
  const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { detail: 'Too many AI requests. Please slow down.' } });

  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth/register', registerLimiter);
  app.use('/api/auth/google', googleAuthLimiter);
  app.post('/api/localshare/sessions', rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { detail: 'Too many sessions. Please try again later.' } }));
  app.use('/api', apiLimiter);

  app.use('/api', createWebhookRouter(io));

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
  app.use('/api', paymentConfigRoutes);
  app.use('/api', collegePaymentsRoutes);
  app.use('/api/ai', aiLimiter, createAiRouter(io));
  app.use('/api/twilio/whatsapp', whatsappLimiter);
  app.use('/api', twilioRoutes);
  app.use('/api/live-classes', createLiveClassesRouter(io));
  app.use('/api/placement', createPlacementRouter(io));
  app.use('/api/assessments', createAssessmentsRouter(io));
  app.use('/api/mentorship', createMentorshipRouter(io));
  app.use('/api/skills', createSkillsRouter(io));
  app.use('/api/career', createCareerRouter(io));

  app.use('/api', uploadRoutes);
  app.use('/api', createLocalShareRouter(io));
  app.use('/api/exam-prep', createExamPrepRouter(io));
  app.use('/api', createReportsRouter());
  app.use('/api/gatepass', gatepassRoutes);
  app.use('/api/canteen', canteenRoutes);
  app.use('/api/admission', admissionRoutes);
  app.use('/api', createGoogleRouter(io));
  startSheetSyncWorker();
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
