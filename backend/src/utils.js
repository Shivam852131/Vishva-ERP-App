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

// Non-breaking pagination: callers that don't pass page/pageSize get an array capped
// at `maxSize` (bounding today's unbounded findMany() calls); callers that opt in via
// query params get a real page. Either way the response body stays a plain array —
// total count is exposed via the X-Total-Count header so existing array-consuming
// frontend code keeps working unchanged.
function paginationParams(query, { defaultSize, maxSize = 200 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, parseInt(query.pageSize, 10) || defaultSize || maxSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

function sendPaginated(res, items, total) {
  res.set('X-Total-Count', String(total));
  res.json(items);
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
  paginationParams,
  sendPaginated,
  serializeUser,
  sendError,
  parseCsv,
};
