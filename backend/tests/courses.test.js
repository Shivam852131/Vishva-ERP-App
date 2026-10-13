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

// This file is the template for CRUD route tests on other resources: create the
// authenticated actor via the factory, exercise create/read/update/delete through
// the real HTTP layer (not the Prisma layer directly), and assert on both status
// codes and response shape.
describe('course CRUD (/api/courses, /api/admin/courses)', () => {
  it('creates, lists, updates, and deletes a course as an admin', async () => {
    const admin = await createUser({ role: 'college_admin' });
    const authHeader = `Bearer ${tokenFor(admin)}`;

    const create = await request(app)
      .post('/api/admin/courses')
      .set('Authorization', authHeader)
      .send({ code: 'CS401', name: 'Operating Systems', credits: 4 });
    expect(create.status).toBe(200);
    const courseId = create.body.id;

    const list = await request(app).get('/api/courses').set('Authorization', authHeader);
    expect(list.status).toBe(200);
    expect(list.body.some(c => c.id === courseId)).toBe(true);

    const update = await request(app)
      .put(`/api/admin/courses/${courseId}`)
      .set('Authorization', authHeader)
      .send({ name: 'Operating Systems II' });
    expect(update.status).toBe(200);
    expect(update.body.name).toBe('Operating Systems II');

    const remove = await request(app).delete(`/api/admin/courses/${courseId}`).set('Authorization', authHeader);
    expect(remove.status).toBe(200);

    const listAfter = await request(app).get('/api/courses').set('Authorization', authHeader);
    expect(listAfter.body.some(c => c.id === courseId)).toBe(false);
  });

  it('returns 404 when updating a course that does not exist', async () => {
    const admin = await createUser({ role: 'college_admin' });
    const res = await request(app)
      .put('/api/admin/courses/does-not-exist')
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send({ name: 'Ghost Course' });
    expect(res.status).toBe(404);
  });
});

describe('question bank pagination (/api/question-bank)', () => {
  it('supports page/pageSize and reports the total via X-Total-Count', async () => {
    const admin = await createUser({ role: 'college_admin' });
    const authHeader = `Bearer ${tokenFor(admin)}`;
    await prisma.questionBankItem.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        subject: 'Testing',
        unit: 'Unit 1',
        chapter: 'Chapter 1',
        questionText: `Question ${i}`,
        questionType: 'mcq',
        correctAnswer: 'A',
        difficulty: 'easy',
        marks: 1,
      })),
    });

    const firstPage = await request(app)
      .get('/api/question-bank')
      .query({ page: 1, pageSize: 2 })
      .set('Authorization', authHeader);
    expect(firstPage.status).toBe(200);
    expect(firstPage.body).toHaveLength(2);
    expect(firstPage.headers['x-total-count']).toBe('5');

    const unpaginated = await request(app).get('/api/question-bank').set('Authorization', authHeader);
    expect(unpaginated.status).toBe(200);
    expect(Array.isArray(unpaginated.body)).toBe(true);
    expect(unpaginated.body.length).toBe(5);
  });
});
