const { prisma } = require('./db');
const { hashPassword, issueToken } = require('../../src/auth');

let counter = 0;
function uniqueEmail(prefix) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@test.com`;
}

async function createUser({ name, email, password, role, parentUserId, studentCode } = {}) {
  return prisma.user.create({
    data: {
      name: name || 'Test User',
      email: email || uniqueEmail(role || 'user'),
      passwordHash: await hashPassword(password || 'password123'),
      role: role || 'student',
      college: 'Vishva Institute of Technology',
      parentUserId: parentUserId || undefined,
      studentCode: studentCode || undefined,
    },
  });
}

function tokenFor(user) {
  return issueToken(user);
}

module.exports = { createUser, tokenFor, uniqueEmail };
