const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { getDB, oid } = require('./db');
const { sendError } = require('./utils');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required.');
}

const PUBLIC_PATHS = new Set(['/auth/login', '/auth/register', '/auth/send-otp', '/auth/verify-otp']);

function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function issueToken(user) {
  return jwt.sign(
    { sub: String(user._id || user.id), role: user.role, collegeId: user.collegeId ? String(user.collegeId) : null },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

async function userFromToken(token) {
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
  const db = getDB();
  return db.collection('users').findOne({ _id: oid(payload.sub) });
}

async function authMiddleware(req, res, next) {
  if (PUBLIC_PATHS.has(req.path)) return next();
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return sendError(res, 'Authentication required.', 401);
  const user = await userFromToken(token);
  if (!user) return sendError(res, 'Invalid or expired token.', 401);
  if (user.status === 'suspended' || user.isActive === false) return sendError(res, 'This account is suspended.', 403);
  req.token = token;
  req.user = user;
  req.userCollegeId = user.collegeId || null;
  req.isSuperAdmin = user.role === 'super_admin' || user.role === 'superadmin';
  next();
}

async function authUser(req) {
  return req.user || null;
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return sendError(res, 'You do not have permission to perform this action.', 403);
    const userRole = req.user.role;
    const normalized = userRole === 'collegeAdmin' ? 'college_admin' : userRole === 'superadmin' ? 'super_admin' : userRole;
    if (!roles.includes(normalized) && !roles.includes(userRole)) {
      return sendError(res, 'You do not have permission to perform this action.', 403);
    }
    next();
  };
}

function requireCollegeAccess(req, res, next) {
  if (req.isSuperAdmin) return next();
  if (!req.userCollegeId) return sendError(res, 'No college assigned to your account.', 403);
  next();
}

function collegeFilter(req) {
  if (req.isSuperAdmin) return {};
  return { collegeId: oid(req.userCollegeId) };
}

function collegeIdOrThrow(req) {
  if (req.isSuperAdmin) {
    const requested = req.query.collegeId || req.body?.collegeId;
    return requested ? oid(requested) : null;
  }
  return oid(req.userCollegeId);
}

module.exports = {
  hashPassword,
  comparePassword,
  issueToken,
  userFromToken,
  authMiddleware,
  authUser,
  requireRole,
  requireCollegeAccess,
  collegeFilter,
  collegeIdOrThrow,
};
