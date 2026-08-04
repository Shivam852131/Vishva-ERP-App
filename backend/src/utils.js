const { oid } = require('./db');

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

function serializeUser(user, college = null) {
  if (!user) return null;
  const role = user.role === 'collegeAdmin' ? 'college_admin'
    : user.role === 'superadmin' ? 'super_admin'
    : user.role || 'student';
  const collegeName = college?.name || undefined;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role,
    phone: user.phone || undefined,
    college: collegeName,
    collegeName,
    collegeId: user.collegeId ? String(user.collegeId) : undefined,
    collegeCode: college?.code || undefined,
    collegeLogo: college?.logo || undefined,
    department: user.department || undefined,
    student_id: user.studentCode || user.studentId || undefined,
    year: user.year ?? undefined,
    cgpa: user.cgpa ?? undefined,
    avatar: user.avatar || undefined,
    status: user.isActive !== undefined ? (user.isActive ? 'active' : 'suspended') : (user.status || 'active'),
  };
}

async function serializeUserWithCollege(db, user) {
  if (!user) return null;
  const collegeId = oid(user.collegeId);
  const college = collegeId
    ? await db.collection('colleges').findOne(
        { _id: collegeId },
        { projection: { name: 1, code: 1, logo: 1 } },
      )
    : null;
  return serializeUser(user, college);
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
  serializeUserWithCollege,
  sendError,
  parseCsv,
};
