const request = require('supertest');
const { buildTestApp } = require('./helpers/testApp');
const { prisma, resetDb, getDB } = require('./helpers/db');
const { createUser, tokenFor } = require('./helpers/factories');

const app = buildTestApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/login', () => {
  it('logs in with the correct password', async () => {
    await createUser({ email: 'student@test.com', password: 'password123', role: 'student' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@test.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('student@test.com');
  });

  it('rejects an incorrect password', async () => {
    await createUser({ email: 'student@test.com', password: 'password123' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@test.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rejects a login with no password instead of bypassing the check', async () => {
    await createUser({ email: 'student@test.com', password: 'password123' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@test.com' });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown email rather than auto-provisioning an account', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody-admin@test.com', password: 'whatever123' });
    expect(res.status).toBe(401);
    const created = await prisma.user.findUnique({ where: { email: 'nobody-admin@test.com' } });
    expect(created).toBeNull();
  });

  it('rejects a suspended account', async () => {
    await createUser({ email: 'suspended@test.com', password: 'password123' });
    await prisma.user.update({ where: { email: 'suspended@test.com' }, data: { status: 'suspended' } });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'suspended@test.com', password: 'password123' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/auth/register', () => {
  it('registers a new student account and returns a usable token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New Student', email: 'newstudent@test.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('student');
    expect(res.body.user.collegeId).toBeDefined();

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('newstudent@test.com');

    // Also verify college-scoped routes work immediately without 403 Forbidden
    const courses = await request(app).get('/api/courses').set('Authorization', `Bearer ${res.body.token}`);
    expect(courses.status).toBe(200);
  });

  it('supports registering as faculty or parent', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Faculty Member', email: 'faculty@test.com', password: 'password123', role: 'faculty' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('faculty');
  });

  it('rejects passwords shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Short', email: 'short@test.com', password: 'pass' });
    expect(res.status).toBe(400);
  });

  it('ignores a client-supplied privileged role and forces student/parent only', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Sneaky', email: 'sneaky@test.com', password: 'password123', role: 'super_admin' });
    expect(res.status).toBe(400);
  });

  it('rejects duplicate emails', async () => {
    await createUser({ email: 'dupe@test.com' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dupe', email: 'dupe@test.com', password: 'password123' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/send-otp', () => {
  it('sends OTP for a valid 10-digit number', async () => {
    const res = await request(app)
      .post('/api/auth/send-otp')
      .send({ phone: '9876543210' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.otp).toMatch(/^\d{6}$/);
  });

  it('normalizes phone number with +91 country prefix', async () => {
    const res = await request(app)
      .post('/api/auth/send-otp')
      .send({ phone: '+919876543210' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.otp).toBeDefined();
  });

  it('normalizes phone number with whitespace or hyphens', async () => {
    const res = await request(app)
      .post('/api/auth/send-otp')
      .send({ phone: '+91 98765-43210' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('rejects an invalid phone number', async () => {
    const res = await request(app)
      .post('/api/auth/send-otp')
      .send({ phone: '12345' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/verify-otp', () => {
  it('auto-provisions a new student user and returns a token with college access', async () => {
    const sendRes = await request(app)
      .post('/api/auth/send-otp')
      .send({ phone: '9876543211' });
    expect(sendRes.status).toBe(200);
    const otp = sendRes.body.otp;

    const verifyRes = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '9876543211', otp });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.token).toBeDefined();
    expect(verifyRes.body.user.role).toBe('student');
    expect(verifyRes.body.user.collegeId).toBeDefined();

    // Verify token grants access to authenticated routes and college-scoped routes
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${verifyRes.body.token}`);
    expect(meRes.status).toBe(200);

    const coursesRes = await request(app)
      .get('/api/courses')
      .set('Authorization', `Bearer ${verifyRes.body.token}`);
    expect(coursesRes.status).toBe(200);
  });

  it('logs in an existing user without duplicating accounts', async () => {
    const existing = await createUser({
      name: 'Existing Phone User',
      email: 'phoneuser@test.com',
      phone: '+919876543212',
      role: 'student',
    });

    const sendRes = await request(app)
      .post('/api/auth/send-otp')
      .send({ phone: '+919876543212' });
    const otp = sendRes.body.otp;

    const verifyRes = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '9876543212', otp });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.user.email).toBe(existing.email);
    expect(verifyRes.body.user.name).toBe('Existing Phone User');

    const db = getDB();
    const totalUsers = await db.collection('users').countDocuments({ phone: { $regex: '9876543212' } });
    expect(totalUsers).toBe(1);
  });

  it('rejects an incorrect OTP with 401', async () => {
    await request(app)
      .post('/api/auth/send-otp')
      .send({ phone: '9876543213' });

    const verifyRes = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '9876543213', otp: '000000' });
    expect(verifyRes.status).toBe(401);
  });

  it('returns 404 if no OTP was requested for the phone', async () => {
    const verifyRes = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '9999999999', otp: '123456' });
    expect(verifyRes.status).toBe(404);
  });
});

describe('token enforcement', () => {
  it('rejects protected routes with no token', async () => {
    const res = await request(app).get('/api/courses');
    expect(res.status).toBe(401);
  });

  it('rejects protected routes with a garbage token', async () => {
    const res = await request(app).get('/api/courses').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('accepts a valid token', async () => {
    const user = await createUser({ role: 'student' });
    const res = await request(app).get('/api/courses').set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(res.status).toBe(200);
  });
});
