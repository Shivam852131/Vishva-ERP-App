const request = require('supertest');
const { buildTestApp } = require('./helpers/testApp');
const { prisma, resetDb } = require('./helpers/db');
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

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('newstudent@test.com');
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
