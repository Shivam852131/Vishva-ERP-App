const { ObjectId } = require('mongodb');

function nowIso() {
  return new Date().toISOString();
}

function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function isoDate(input) {
  return new Date(input || Date.now()).toISOString().slice(0, 10);
}

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function roomForUser(userId) {
  return `user:${String(userId)}`;
}

function paginationParams(query, { defaultSize, maxSize = 200 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, parseInt(query.pageSize, 10) || defaultSize || maxSize));
  return { page, pageSize, skip: (page - 1) * pageSize, limit: pageSize };
}

function sendPaginated(res, items, total) {
  res.set('X-Total-Count', String(total));
  res.json(items);
}

function serializeUser(user) {
  if (!user) return null;
  const role = user.role === 'collegeAdmin' ? 'college_admin'
    : user.role === 'superadmin' ? 'super_admin'
    : user.role || 'student';
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role,
    phone: user.phone || undefined,
    college: user.college || user.collegeId || undefined,
    department: user.department || undefined,
    student_id: user.studentCode || user.studentId || undefined,
    year: user.year ?? undefined,
    cgpa: user.cgpa ?? undefined,
    status: user.isActive !== undefined ? (user.isActive ? 'active' : 'suspended') : (user.status || 'active'),
  };
}

function sendError(res, message, status = 400) {
  res.status(status).json({ detail: message });
}

function parseCsv(csvText) {
  return String(csvText || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

module.exports = {
  nowIso,
  daysFromNow,
  isoDate,
  makeCode,
  roomForUser,
  paginationParams,
  sendPaginated,
  serializeUser,
  sendError,
  parseCsv,
};
