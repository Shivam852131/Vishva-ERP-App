require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');

const { authMiddleware } = require('./auth');
const { sendError } = require('./utils');
const { createSocketServer } = require('./socket');

const authRoutes = require('./routes/auth');
const { router: dashboardRoutes } = require('./routes/dashboard');
const academicsRoutes = require('./routes/academics');
const { createAttendanceRouter } = require('./routes/attendance');
const { createFeesRouter } = require('./routes/fees');
const { createNotificationsRouter } = require('./routes/notifications');
const { createChatRouter } = require('./routes/chat');
const libraryRoutes = require('./routes/library');
const { createCampusRouter } = require('./routes/campus');
const adminUsersRoutes = require('./routes/admin-users');
const collegesRoutes = require('./routes/colleges');
const { createAiRouter } = require('./routes/ai');

const app = express();
const server = http.createServer(app);
const io = createSocketServer(server);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = Number(process.env.PORT || 8000);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'vishva-erp-backend', time: new Date().toISOString() });
});

app.use('/api', authMiddleware);

app.use('/api', authRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', academicsRoutes);
app.use('/api', createAttendanceRouter(io));
app.use('/api', createFeesRouter(io));
app.use('/api', createNotificationsRouter(io));
app.use('/api', createChatRouter(io));
app.use('/api', libraryRoutes);
app.use('/api', createCampusRouter(io));
app.use('/api', adminUsersRoutes);
app.use('/api', collegesRoutes);
app.use('/api', createAiRouter(io));

app.use('/api', (_req, res) => {
  sendError(res, 'Route not found.', 404);
});

server.listen(PORT, () => {
  console.log(`Vishva ERP backend listening on http://0.0.0.0:${PORT}`);
});
