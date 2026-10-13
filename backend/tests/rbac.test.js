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

describe('RBAC on /api/admin/users', () => {
  it('forbids a student from listing users', async () => {
    const student = await createUser({ role: 'student' });
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${tokenFor(student)}`);
    expect(res.status).toBe(403);
  });

  it('forbids a faculty member from listing users', async () => {
    const faculty = await createUser({ role: 'faculty' });
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${tokenFor(faculty)}`);
    expect(res.status).toBe(403);
  });

  it('allows a college_admin to list users', async () => {
    const admin = await createUser({ role: 'college_admin' });
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${tokenFor(admin)}`);
    expect(res.status).toBe(200);
  });

  it('forbids a college_admin from creating another admin account', async () => {
    const admin = await createUser({ role: 'college_admin' });
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send({ name: 'Sneaky Admin', email: 'sneaky-admin@test.com', role: 'college_admin' });
    expect(res.status).toBe(403);
  });

  it('allows a super_admin to create another admin account', async () => {
    const superAdmin = await createUser({ role: 'super_admin' });
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${tokenFor(superAdmin)}`)
      .send({ name: 'New Admin', email: 'new-admin@test.com', role: 'college_admin' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('college_admin');
  });

  it('does not leak requests to unrelated routers when the target route is unmatched', async () => {
    // Regression test: /api/admin/users used to be mounted with a router-wide
    // requireRole() gate at the shared /api prefix, which swallowed ANY unmatched
    // request (e.g. /api/colleges) that reached it before later routers.
    const student = await createUser({ role: 'student' });
    const res = await request(app).get('/api/colleges').set('Authorization', `Bearer ${tokenFor(student)}`);
    expect(res.status).toBe(200);
  });
});

describe('RBAC on course management', () => {
  it('forbids a student from creating a course', async () => {
    const student = await createUser({ role: 'student' });
    const res = await request(app)
      .post('/api/admin/courses')
      .set('Authorization', `Bearer ${tokenFor(student)}`)
      .send({ code: 'CS999', name: 'Hacking 101' });
    expect(res.status).toBe(403);
  });

  it('allows a college_admin to create a course', async () => {
    const admin = await createUser({ role: 'college_admin' });
    const res = await request(app)
      .post('/api/admin/courses')
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send({ code: 'CS201', name: 'Algorithms' });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('CS201');
  });
});

describe('fee ownership', () => {
  it('forbids a student from paying another student\'s fee', async () => {
    const owner = await createUser({ role: 'student' });
    const attacker = await createUser({ role: 'student' });
    const fee = await prisma.fee.create({
      data: { studentId: owner.id, type: 'Tuition', amount: 1000, dueDate: new Date(), semester: 'Sem 1' },
    });
    const res = await request(app)
      .post('/api/fees/pay')
      .set('Authorization', `Bearer ${tokenFor(attacker)}`)
      .send({ fee_id: fee.id });
    expect(res.status).toBe(403);
  });

  it('allows a student to pay their own fee', async () => {
    const owner = await createUser({ role: 'student' });
    const fee = await prisma.fee.create({
      data: { studentId: owner.id, type: 'Tuition', amount: 1000, dueDate: new Date(), semester: 'Sem 1' },
    });
    const res = await request(app)
      .post('/api/fees/pay')
      .set('Authorization', `Bearer ${tokenFor(owner)}`)
      .send({ fee_id: fee.id });
    expect(res.status).toBe(200);
  });
});
