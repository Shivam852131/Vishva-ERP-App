const request = require('supertest');
const { buildTestApp } = require('./helpers/testApp');
const { prisma, resetDb, getDB } = require('./helpers/db');
const { createUser, tokenFor } = require('./helpers/factories');

const app = buildTestApp();

function auth(user) {
  return `Bearer ${tokenFor(user)}`;
}

/**
 * Two colleges, two courses in A (only one taught by the faculty actor),
 * and a spread of marks — including one corrected record — so scoping,
 * filters, summaries and exports can all be asserted against known counts.
 */
let A;

beforeEach(async () => {
  await resetDb();
  const db = getDB();

  const colA = (await db.collection('colleges').insertOne({ name: 'Alpha College', code: 'ALPHA' })).insertedId;
  const colB = (await db.collection('colleges').insertOne({ name: 'Beta College', code: 'BETA' })).insertedId;

  const faculty = await createUser({ role: 'faculty', name: 'Dr. Rao', collegeId: colA });
  const otherFaculty = await createUser({ role: 'faculty', name: 'Dr. Sen', collegeId: colA });
  const admin = await createUser({ role: 'college_admin', name: 'Admin A', collegeId: colA });
  const studentA1 = await createUser({ role: 'student', name: 'Amit Verma', collegeId: colA, studentCode: 'STU-A1' });
  const studentA2 = await createUser({ role: 'student', name: 'Zoya Khan', collegeId: colA, studentCode: 'STU-A2' });
  const facultyB = await createUser({ role: 'faculty', name: 'Dr. B', collegeId: colB });
  const studentB = await createUser({ role: 'student', name: 'Bhavna Rao', collegeId: colB, studentCode: 'STU-B1' });

  const c1 = (await db.collection('courses').insertOne({
    name: 'Database Systems', code: 'CS301', facultyId: faculty._id, collegeId: colA,
  })).insertedId;
  const c2 = (await db.collection('courses').insertOne({
    name: 'Operating Systems', code: 'CS302', facultyId: otherFaculty._id, collegeId: colA,
  })).insertedId;
  const cB = (await db.collection('courses').insertOne({
    name: 'Beta Course', code: 'BE101', facultyId: facultyB._id, collegeId: colB,
  })).insertedId;

  const mark = (studentId, courseId, date, status, method, extra = {}) => db.collection('attendance_records').insertOne({
    studentId, courseId, date, status, method, sessionId: null, collegeId: colA, ...extra,
  });

  // c1 — the taught course (6 marks, one already corrected).
  await mark(studentA1._id, c1, '2026-10-01', 'present', 'qr');
  await mark(studentA2._id, c1, '2026-10-01', 'absent', 'qr');
  await mark(studentA1._id, c1, '2026-10-02', 'late', 'manual');
  await mark(studentA2._id, c1, '2026-10-02', 'present', 'qr');
  await mark(studentA1._id, c1, '2026-10-03', 'absent', 'batch', {
    correctedAt: '2026-10-03T10:00:00.000Z',
    correctedByName: 'Dr. Rao',
    correctionReason: 'Scanner failed during roll call',
    originalStatus: 'present',
  });
  await mark(studentA2._id, c1, '2026-10-03', 'present', 'qr');
  // c2 — same college, NOT taught by the faculty actor.
  await mark(studentA1._id, c2, '2026-10-01', 'absent', 'qr');
  // College B — must never surface for anyone in college A.
  await db.collection('attendance_records').insertOne({
    studentId: studentB._id, courseId: cB, date: '2026-10-01', status: 'present',
    method: 'qr', sessionId: null, collegeId: colB,
  });

  A = { colA, colB, faculty, otherFaculty, admin, studentA1, studentA2, facultyB, studentB, c1, c2, cB };
});

afterAll(async () => {
  await prisma.$disconnect();
});

function history(header, query = '') {
  return request(app).get(`/api/attendance/history${query}`).set('Authorization', header);
}

describe('GET /attendance/history', () => {
  it('scopes faculty to taught courses and admins to their college', async () => {
    const facultyRes = await history(auth(A.faculty));
    expect(facultyRes.status).toBe(200);
    expect(facultyRes.body.total).toBe(6);
    expect(new Set(facultyRes.body.items.map((i) => i.course_id))).toEqual(new Set([String(A.c1)]));
    // No cross-college leakage, and names are joined for display.
    expect(facultyRes.body.items.some((i) => i.student_name === 'Bhavna Rao')).toBe(false);
    expect(facultyRes.body.items[0].student_name).toBeTruthy();

    const adminRes = await history(auth(A.admin));
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.total).toBe(7); // c1 + c2, still not college B
  });

  it('returns paged, sorted items with a body-wrapped envelope and summary', async () => {
    const page1 = await history(auth(A.faculty), '?pageSize=3&page=1&sort=date&order=asc');
    expect(page1.status).toBe(200);
    expect(page1.body).toEqual(expect.objectContaining({ page: 1, pageSize: 3, total: 6, sort: 'date', order: 'asc' }));
    expect(page1.body.items).toHaveLength(3);
    expect(page1.body.items.map((i) => i.date)).toEqual(['2026-10-01', '2026-10-01', '2026-10-02']);

    const page2 = await history(auth(A.faculty), '?pageSize=3&page=2&sort=date&order=asc');
    expect(page2.body.page).toBe(2);
    expect(page2.body.items.map((i) => i.date)).toEqual(['2026-10-02', '2026-10-03', '2026-10-03']);

    // Past the end: empty page, total unchanged.
    const page9 = await history(auth(A.faculty), '?pageSize=3&page=9');
    expect(page9.body.items).toHaveLength(0);
    expect(page9.body.total).toBe(6);

    // Summary covers the whole filtered set, not the visible page.
    expect(page1.body.summary).toEqual({
      total: 6, present: 3, late: 1, absent: 2, corrected: 1, percentage: 67,
    });

    const desc = await history(auth(A.faculty), '?sort=date&order=desc&pageSize=100');
    expect(desc.body.items[0].date).toBe('2026-10-03');
    expect(desc.body.items[desc.body.items.length - 1].date).toBe('2026-10-01');
  });

  it('applies combined status, range, search and corrected filters', async () => {
    const absent = await history(auth(A.faculty), '?status=absent');
    expect(absent.body.total).toBe(2);
    expect(absent.body.items.every((i) => i.status === 'absent')).toBe(true);
    expect(absent.body.summary).toEqual(
      expect.objectContaining({ total: 2, absent: 2, present: 0, late: 0, percentage: 0 }),
    );

    const window = await history(auth(A.faculty), '?from=2026-10-02&to=2026-10-03');
    expect(window.body.total).toBe(4);

    const exact = await history(auth(A.faculty), '?date=2026-10-01');
    expect(exact.body.total).toBe(2);

    const search = await history(auth(A.faculty), '?search=Zoya');
    expect(search.body.total).toBe(3);
    expect(search.body.items.every((i) => i.student_id === String(A.studentA2._id))).toBe(true);

    const corrected = await history(auth(A.faculty), '?corrected=true');
    expect(corrected.body.total).toBe(1);
    expect(corrected.body.items[0]).toEqual(expect.objectContaining({
      corrected: true,
      original_status: 'present',
      corrected_by: 'Dr. Rao',
      correction_reason: 'Scanner failed during roll call',
    }));
  });

  it('rejects invalid filters and out-of-scope courses', async () => {
    const badStatus = await history(auth(A.faculty), '?status=excused');
    expect(badStatus.status).toBe(400);

    const badRange = await history(auth(A.faculty), '?from=2026-10-03&to=2026-10-01');
    expect(badRange.status).toBe(400);

    const badDate = await history(auth(A.faculty), '?from=10-03-2026');
    expect(badDate.status).toBe(400);

    const foreignCourse = await history(auth(A.faculty), `?courseId=${A.c2}`);
    expect(foreignCourse.status).toBe(403);

    const unknownCourse = await history(auth(A.faculty), '?courseId=000000000000000000000000');
    expect(unknownCourse.status).toBe(404);

    // Admins may open any course of their own college.
    const adminCourse = await history(auth(A.admin), `?courseId=${A.c2}`);
    expect(adminCourse.status).toBe(200);
    expect(adminCourse.body.total).toBe(1);
  });

  it('keeps students and anonymous callers out', async () => {
    const student = await history(auth(A.studentA1));
    expect(student.status).toBe(403);

    const anon = await request(app).get('/api/attendance/history');
    expect(anon.status).toBe(401);
  });
});

describe('GET /attendance/history/export', () => {
  function csv(query = '') {
    return request(app)
      .get(`/api/attendance/history/export?format=csv${query}`)
      .set('Authorization', auth(A.faculty))
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
  }

  it('exports a filtered CSV that matches exactly what the page shows', async () => {
    const res = await csv('&status=late');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment; filename="attendance-history-');

    const text = res.body.toString('utf8');
    expect(text).toContain('Date,Student,Student ID,Course');
    expect(text).toContain('Amit Verma');
    expect(text).not.toContain('Zoya Khan'); // status=late leaves her out
    expect(text).not.toContain('Bhavna Rao'); // other college never leaks

    // Course label lands in the file name for a course-scoped export.
    const scoped = await csv(`&courseId=${A.c1}`);
    expect(scoped.headers['content-disposition']).toContain('attendance-history-CS301-');
    expect(scoped.body.toString('utf8')).not.toContain('Operating Systems');
  });

  it('exports a PDF document', async () => {
    const res = await request(app)
      .get('/api/attendance/history/export?format=pdf')
      .set('Authorization', auth(A.faculty))
      .buffer(true)
      .parse((r, cb) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('.pdf"');
    expect(res.body.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(res.body.length).toBeGreaterThan(500);
  });

  it('applies the same RBAC scope and rejects outsiders', async () => {
    const adminCsv = await request(app)
      .get('/api/attendance/history/export?format=csv')
      .set('Authorization', auth(A.admin));
    expect(adminCsv.status).toBe(200);

    const studentCsv = await request(app)
      .get('/api/attendance/history/export?format=csv')
      .set('Authorization', auth(A.studentA1));
    expect(studentCsv.status).toBe(403);

    const anon = await request(app).get('/api/attendance/history/export?format=csv');
    expect(anon.status).toBe(401);

    const badCourse = await request(app)
      .get(`/api/attendance/history/export?format=csv&courseId=${A.c2}`)
      .set('Authorization', auth(A.faculty));
    expect(badCourse.status).toBe(403);
  });
});
