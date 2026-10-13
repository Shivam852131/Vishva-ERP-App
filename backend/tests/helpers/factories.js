const { getDB, oid } = require('./db');
const { hashPassword, issueToken } = require('../../src/auth');

let counter = 0;
function uniqueEmail(prefix) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@test.com`;
}

async function createUser({ name, email, password, role, parentUserId, studentCode, collegeId, phone } = {}) {
  const db = getDB();
  let cid = collegeId;
  if (!cid) {
    const col = await db.collection('colleges').findOne({});
    if (col) {
      cid = col._id;
    } else {
      const newCol = await db.collection('colleges').insertOne({
        name: 'Vishva Institute of Technology',
        code: `VIT-${Date.now()}`,
        createdAt: new Date().toISOString(),
      });
      cid = newCol.insertedId;
    }
  }

  const doc = {
    name: name || 'Test User',
    email: (email || uniqueEmail(role || 'user')).toLowerCase(),
    passwordHash: await hashPassword(password || 'password123'),
    role: role || 'student',
    phone: phone || undefined,
    college: 'Vishva Institute of Technology',
    collegeId: oid(cid),
    parentUserId: parentUserId ? oid(parentUserId) : undefined,
    studentCode: studentCode || undefined,
    status: 'active',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const result = await db.collection('users').insertOne(doc);
  return {
    ...doc,
    _id: result.insertedId,
    id: String(result.insertedId),
  };
}

function tokenFor(user) {
  return issueToken({
    _id: String(user._id || user.id),
    role: user.role,
    collegeId: user.collegeId ? String(user.collegeId) : null,
  });
}

module.exports = { createUser, tokenFor, uniqueEmail };
