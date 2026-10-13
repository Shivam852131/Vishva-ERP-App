const request = require('supertest');
const { buildTestApp } = require('./helpers/testApp');
const { getDB, oid, connectDB, closeDB } = require('../src/db');
const { hashPassword, issueToken } = require('../src/auth');
const { stopCleanupCron } = require('../src/routes/localshare');

let app;
let db;
let facultyToken, studentToken, facultyId, studentId, collegeId;

beforeAll(async () => {
  await connectDB();
  db = getDB();
});

beforeEach(async () => {
  app = buildTestApp();

  await db.collection('colleges').deleteMany({});
  await db.collection('users').deleteMany({});
  await db.collection('localshare_sessions').deleteMany({});
  await db.collection('localshare_participants').deleteMany({});
  await db.collection('localshare_downloads').deleteMany({});
  await db.collection('localshare_feedback').deleteMany({});
  await db.collection('localshare_audit_logs').deleteMany({});

  const college = await db.collection('colleges').insertOne({
    name: 'Test College', code: `TC-${Date.now()}-${Math.floor(Math.random() * 10000)}`, createdAt: new Date().toISOString(),
  });
  collegeId = String(college.insertedId);

  const passwordHash = await hashPassword('password123');

  const faculty = await db.collection('users').insertOne({
    name: 'Dr. Test', email: `faculty-${Date.now()}@test.com`,
    passwordHash, role: 'faculty', collegeId: oid(collegeId),
    isActive: true, createdAt: new Date().toISOString(),
  });
  facultyId = String(faculty.insertedId);
  facultyToken = issueToken({ _id: facultyId, role: 'faculty', collegeId });

  const student = await db.collection('users').insertOne({
    name: 'Student Test', email: `student-${Date.now()}@test.com`,
    passwordHash, role: 'student', collegeId: oid(collegeId),
    isActive: true, createdAt: new Date().toISOString(),
  });
  studentId = String(student.insertedId);
  studentToken = issueToken({ _id: studentId, role: 'student', collegeId });
});

describe('POST /api/localshare/sessions', () => {
  it('creates a session with valid data', async () => {
    const res = await request(app)
      .post('/api/localshare/sessions')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        title: 'DS Week 3',
        description: 'Graph algorithms',
        files: [{ name: 'notes.pdf', size: 1024000, type: 'application/pdf' }],
      });
    expect(res.status).toBe(201);
    expect(res.body.share_code).toMatch(/^LS-/);
    expect(res.body.title).toBe('DS Week 3');
    expect(res.body.files).toHaveLength(1);
    expect(res.body.status).toBe('active');
  });

  it('rejects missing title', async () => {
    const res = await request(app)
      .post('/api/localshare/sessions')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        files: [{ name: 'notes.pdf', size: 1024000, type: 'application/pdf' }],
      });
    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('title');
  });

  it('rejects invalid file type', async () => {
    const res = await request(app)
      .post('/api/localshare/sessions')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        title: 'Test',
        files: [{ name: 'virus.exe', size: 1024, type: 'application/x-executable' }],
      });
    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('not allowed');
  });

  it('rejects student role', async () => {
    const res = await request(app)
      .post('/api/localshare/sessions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        title: 'Test',
        files: [{ name: 'notes.pdf', size: 1024, type: 'application/pdf' }],
      });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/localshare/join/:code', () => {
  let shareCode;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/localshare/sessions')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        title: 'Join Test',
        files: [{ name: 'notes.pdf', size: 1024, type: 'application/pdf' }],
      });
    shareCode = res.body.share_code;
  });

  it('student joins with valid code', async () => {
    const res = await request(app)
      .get(`/api/localshare/join/${shareCode}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.session.share_code).toBe(shareCode);
    expect(res.body.participant.student_name).toBe('Student Test');
  });

  it('rejects invalid share code', async () => {
    const res = await request(app)
      .get('/api/localshare/join/LS-XXXX')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(404);
  });

  it('rejects joining an ended session', async () => {
    await request(app)
      .post(`/api/localshare/sessions/${shareCode}/end`)  // will fix below
      .set('Authorization', `Bearer ${facultyToken}`);

    const sessions = await db.collection('localshare_sessions')
      .find({ shareCode }).toArray();
    if (sessions.length) {
      await db.collection('localshare_sessions').updateOne(
        { _id: sessions[0]._id },
        { $set: { status: 'ended' } },
      );
    }

    const res = await request(app)
      .get(`/api/localshare/join/${shareCode}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(409);
  });
});

describe('POST /api/localshare/sessions/:id/end', () => {
  let sessionId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/localshare/sessions')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        title: 'End Test',
        files: [{ name: 'notes.pdf', size: 1024, type: 'application/pdf' }],
      });
    sessionId = res.body.id;
  });

  it('teacher ends own session', async () => {
    const res = await request(app)
      .post(`/api/localshare/sessions/${sessionId}/end`)
      .set('Authorization', `Bearer ${facultyToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ended');
    expect(res.body.ended_at).toBeDefined();
  });

  it('rejects student ending a session', async () => {
    const res = await request(app)
      .post(`/api/localshare/sessions/${sessionId}/end`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/localshare/sessions/:id/feedback', () => {
  let sessionId;

  beforeEach(async () => {
    const joinRes = await request(app)
      .post('/api/localshare/sessions')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        title: 'Feedback Test',
        files: [{ name: 'notes.pdf', size: 1024, type: 'application/pdf' }],
      });
    sessionId = joinRes.body.id;

    await request(app)
      .get(`/api/localshare/join/${joinRes.body.share_code}`)
      .set('Authorization', `Bearer ${studentToken}`);
  });

  it('student submits feedback', async () => {
    const res = await request(app)
      .post(`/api/localshare/sessions/${sessionId}/feedback`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ rating: 4, comment: 'Good transfer speed' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('rejects duplicate feedback', async () => {
    await request(app)
      .post(`/api/localshare/sessions/${sessionId}/feedback`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ rating: 5 });

    const res = await request(app)
      .post(`/api/localshare/sessions/${sessionId}/feedback`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ rating: 3 });
    expect(res.status).toBe(409);
  });
});

describe('Rate limiting on /api/localshare/sessions', () => {
  it('does NOT rate-limit GET requests to /api/localshare/sessions', async () => {
    for (let i = 0; i < 15; i++) {
      const res = await request(app)
        .get('/api/localshare/sessions')
        .set('Authorization', `Bearer ${facultyToken}`);
      expect(res.status).toBe(200);
    }
  });

  it('POST requests to /api/localshare/sessions are rate-limited after max attempts', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/localshare/sessions')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          title: `Test ${i}`,
          description: 'Rate limit test',
          files: [{ name: `file${i}.pdf`, size: 1024, type: 'application/pdf' }],
        });
    }

    const res = await request(app)
      .post('/api/localshare/sessions')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        title: 'Over limit',
        files: [{ name: 'over.pdf', size: 1024, type: 'application/pdf' }],
      });
    expect(res.status).toBe(429);
    expect(res.body.detail).toContain('Too many sessions');
  });
});

afterAll(async () => {
  stopCleanupCron();
});
