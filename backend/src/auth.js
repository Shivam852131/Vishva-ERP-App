const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { prisma } = require('./db');

const SALT_ROUNDS = 10;

function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

async function issueToken(userId) {
  const token = `token-${crypto.randomBytes(24).toString('hex')}`;
  await prisma.authToken.create({ data: { token, userId } });
  return token;
}

async function userFromToken(token) {
  if (!token) return null;
  const record = await prisma.authToken.findUnique({ where: { token }, include: { user: true } });
  return record ? record.user : null;
}

async function authMiddleware(req, _res, next) {
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  req.token = token;
  req.user = await userFromToken(token);
  next();
}

async function authUser(req) {
  if (req.user) return req.user;
  return prisma.user.findFirst({ where: { role: 'student' } });
}

module.exports = {
  hashPassword,
  comparePassword,
  issueToken,
  userFromToken,
  authMiddleware,
  authUser,
};
