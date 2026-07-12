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
  return `user:${userId}`;
}

function inferRole(email = '') {
  const key = String(email).toLowerCase();
  if (key.includes('super')) return 'super_admin';
  if (key.includes('admin')) return 'college_admin';
  if (key.includes('faculty') || key.includes('prof')) return 'faculty';
  if (key.includes('parent')) return 'parent';
  return 'student';
}

function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || undefined,
    college: user.college || undefined,
    department: user.department || undefined,
    student_id: user.studentCode || undefined,
    year: user.year ?? undefined,
    cgpa: user.cgpa ?? undefined,
    status: user.status,
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
  inferRole,
  serializeUser,
  sendError,
  parseCsv,
};
