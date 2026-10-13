const { resolveTestEnv } = require('./loadTestEnv');
const { connectDB, getDB } = require('../src/db');

module.exports = async () => {
  await connectDB();
  const db = getDB();
  await db.collection('localshare_sessions').deleteMany({});
  await db.collection('localshare_participants').deleteMany({});
  await db.collection('localshare_downloads').deleteMany({});
  await db.collection('localshare_feedback').deleteMany({});
  await db.collection('localshare_audit_logs').deleteMany({});
};
