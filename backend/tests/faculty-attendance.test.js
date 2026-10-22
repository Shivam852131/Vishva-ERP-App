const request = require('supertest');
const { buildTestApp } = require('./helpers/testApp');
const { resetDb, closeDB, getDB } = require('./helpers/db');
const { createUser, tokenFor } = require('./helpers/factories');

const app = buildTestApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeDB();
});

// Dates are derived from today so the default 30-day window can never rot.
function dayOffset(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

describe('Faculty attendance console', () => {
  async function makeCourse(faculty, { name = 'Computer Networks', code = 'CS301' } = {}) {
    const db = getDB();
    const res = await db.collection('courses').insertOne({
      code,
      name,
      credits: 3,
      facultyId: faculty._id,
      collegeId: faculty.collegeId,
      createdAt: new Date(),
    });
    return res.insertedId;
  }

  async function enroll(courseId, student) {
    const db = getDB();
    await db.collection('course_enrollments').insertOne({
      studentId: student._id,
      courseId,
      collegeId: student.collegeId,
      enrolledAt: new Date(),
    });
  }

  async function mark(courseId, student, status, date) {
    const db = getDB();
    await db.collection('attendance_records').insertOne({
      studentId: student._id,
      courseId,
      sessionId: null,
      status,
      date,
      method: 'manual',
      collegeId: student.collegeId,
    });
  }

  async function seedSession(courseId, faculty, date) {
    const db = getDB();
    const res = await db.collection('attendance_sessions').insertOne({
      courseId,
      facultyId: faculty._id,
      date,
      type: 'qr',
      qrCode: '123456',
      startTime: new Date(),
      endTime: null,
      isActive: false,
      location: null,
      radius: 150,
      createdAt: new Date(),
      collegeId: faculty.collegeId,
    });
    return res.insertedId;
  }

  describe('GET /attendance/faculty/overview', () => {
    it('scopes a faculty member to the courses they teach', async () => {
      const facultyA = await createUser({ role: 'faculty' });
      const facultyB = await createUser({ role: 'faculty' });
      const courseA = await makeCourse(facultyA, { name: 'Networks', code: 'CS101' });
      const courseB = await makeCourse(facultyB, { name: 'Databases', code: 'CS102' });

      const sA = await createUser({ role: 'student' });
      const sB = await createUser({ role: 'student' });
      await enroll(courseA, sA);
      await enroll(courseB, sB);
      await mark(courseA, sA, 'present', dayOffset(1));
      await mark(courseB, sB, 'absent', dayOffset(1));

      const res = await request(app)
        .get('/api/attendance/faculty/overview')
        .set('Authorization', `Bearer ${tokenFor(facultyA)}`);

      expect(res.status).toBe(200);
      expect(res.body.faculty_only).toBe(true);
      expect(res.body.courses).toHaveLength(1);
      expect(res.body.courses[0].id).toBe(String(courseA));
      expect(res.body.courses[0].name).toBe('Networks');
      // B's record must not leak into A's totals.
      expect(res.body.totals.absent).toBe(0);
      expect(res.body.totals.present).toBe(1);
      expect(res.body.defaulters).toHaveLength(0);
    });

    it('gives an admin the whole college', async () => {
      const facultyA = await createUser({ role: 'faculty' });
      const facultyB = await createUser({ role: 'faculty' });
      const admin = await createUser({ role: 'college_admin' });
      const courseA = await makeCourse(facultyA, { name: 'Networks', code: 'CS101' });
      const courseB = await makeCourse(facultyB, { name: 'Databases', code: 'CS102' });

      const res = await request(app)
        .get('/api/attendance/faculty/overview')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(200);
      expect(res.body.faculty_only).toBe(false);
      expect(res.body.courses.map((c) => c.id).sort()).toEqual(
        [String(courseA), String(courseB)].sort(),
      );
    });

    it('aggregates present, late and absent into a course percentage', async () => {
      const faculty = await createUser({ role: 'faculty' });
      const courseId = await makeCourse(faculty);
      const student = await createUser({ role: 'student' });
      await enroll(courseId, student);

      for (const status of ['present', 'present', 'present', 'late', 'absent', 'absent']) {
        await mark(courseId, student, status, dayOffset(2));
      }
      await seedSession(courseId, faculty, dayOffset(2));

      const res = await request(app)
        .get('/api/attendance/faculty/overview')
        .set('Authorization', `Bearer ${tokenFor(faculty)}`);

      expect(res.status).toBe(200);
      const course = res.body.courses[0];
      expect(course).toMatchObject({ present: 3, late: 1, absent: 2, classes_marked: 6, sessions: 1, enrolled: 1 });
      // 4 attended of 6 marked = 67%
      expect(course.percentage).toBe(67);
      expect(res.body.totals.percentage).toBe(67);
      expect(res.body.totals.courses).toBe(1);
      expect(res.body.totals.students).toBe(1);
    });

    it('lists students under the shortage line with the classes needed to recover', async () => {
      const faculty = await createUser({ role: 'faculty' });
      const courseId = await makeCourse(faculty);
      const student = await createUser({ role: 'student', studentCode: 'VIT-0001' });
      await enroll(courseId, student);

      for (let i = 0; i < 10; i += 1) {
        await mark(courseId, student, i < 3 ? 'present' : 'absent', dayOffset(3 + i));
      }

      const res = await request(app)
        .get('/api/attendance/faculty/overview')
        .set('Authorization', `Bearer ${tokenFor(faculty)}`);

      expect(res.status).toBe(200);
      expect(res.body.threshold).toBe(75);
      expect(res.body.totals.defaulters).toBe(1);
      expect(res.body.defaulters).toHaveLength(1);

      const d = res.body.defaulters[0];
      expect(d.name).toBe(student.name);
      expect(d.student_code).toBe('VIT-0001');
      expect(d.percentage).toBe(30);
      expect(d.course_id).toBe(String(courseId));
      expect(d.course_name).toBe('Computer Networks');
      expect(d.course_percentage).toBe(30);
      // 3/10 held -> (0.75*10 - 3) / 0.25 = 18 more consecutive classes = 21/28 = 75%
      expect(d.shortfall_classes).toBe(18);
      expect((3 + d.shortfall_classes) / (10 + d.shortfall_classes)).toBeGreaterThanOrEqual(0.75);
    });

    it('does not flag a student who is safely above the line', async () => {
      const faculty = await createUser({ role: 'faculty' });
      const courseId = await makeCourse(faculty);
      const student = await createUser({ role: 'student' });
      await enroll(courseId, student);

      for (let i = 0; i < 10; i += 1) {
        await mark(courseId, student, i < 8 ? 'present' : 'absent', dayOffset(3 + i));
      }

      const res = await request(app)
        .get('/api/attendance/faculty/overview')
        .set('Authorization', `Bearer ${tokenFor(faculty)}`);

      expect(res.status).toBe(200);
      expect(res.body.totals.defaulters).toBe(0);
      expect(res.body.defaulters).toHaveLength(0);
      expect(res.body.courses[0].percentage).toBe(80);
    });

    it('points at the worst course when a student is weak in more than one', async () => {
      const faculty = await createUser({ role: 'faculty' });
      const strong = await makeCourse(faculty, { name: 'Networks', code: 'CS101' });
      const weak = await makeCourse(faculty, { name: 'Operating Systems', code: 'CS102' });
      const student = await createUser({ role: 'student' });
      await enroll(strong, student);
      await enroll(weak, student);

      for (let i = 0; i < 4; i += 1) await mark(strong, student, 'present', dayOffset(1 + i));
      for (let i = 0; i < 4; i += 1) await mark(weak, student, 'absent', dayOffset(1 + i));

      const res = await request(app)
        .get('/api/attendance/faculty/overview')
        .set('Authorization', `Bearer ${tokenFor(faculty)}`);

      expect(res.status).toBe(200);
      // Overall 50% -> below the line, but the weak course is the one to report.
      expect(res.body.defaulters[0].percentage).toBe(50);
      expect(res.body.defaulters[0].course_name).toBe('Operating Systems');
      expect(res.body.defaulters[0].course_percentage).toBe(0);
    });

    it('exposes a daily trend for the sparkline', async () => {
      const faculty = await createUser({ role: 'faculty' });
      const courseId = await makeCourse(faculty);
      const student = await createUser({ role: 'student' });
      await enroll(courseId, student);

      await mark(courseId, student, 'present', dayOffset(2));
      await mark(courseId, student, 'absent', dayOffset(1));

      const res = await request(app)
        .get('/api/attendance/faculty/overview?days=7')
        .set('Authorization', `Bearer ${tokenFor(faculty)}`);

      expect(res.status).toBe(200);
      expect(res.body.period_days).toBe(7);
      expect(res.body.trend).toHaveLength(2);
      expect(res.body.trend.map((t) => t.percentage)).toEqual([100, 0]);
    });

    it('counts recent session turnout from the session records', async () => {
      const faculty = await createUser({ role: 'faculty' });
      const courseId = await makeCourse(faculty);
      const a = await createUser({ role: 'student' });
      const b = await createUser({ role: 'student' });
      await enroll(courseId, a);
      await enroll(courseId, b);

      const sessionId = await seedSession(courseId, faculty, dayOffset(1));
      const db = getDB();
      await db.collection('attendance_records').insertMany([
        { studentId: a._id, courseId, sessionId, status: 'present', date: dayOffset(1), method: 'qr', collegeId: faculty.collegeId },
        { studentId: b._id, courseId, sessionId, status: 'absent', date: dayOffset(1), method: 'auto-absent', collegeId: faculty.collegeId },
      ]);

      const res = await request(app)
        .get('/api/attendance/faculty/overview')
        .set('Authorization', `Bearer ${tokenFor(faculty)}`);

      expect(res.status).toBe(200);
      expect(res.body.sessions).toHaveLength(1);
      expect(res.body.sessions[0]).toMatchObject({
        id: String(sessionId),
        course_name: 'Computer Networks',
        present: 1,
        enrolled: 2,
        percentage: 50,
        active: false,
      });
    });

    it('rejects students and returns 403', async () => {
      const student = await createUser({ role: 'student' });
      const res = await request(app)
        .get('/api/attendance/faculty/overview')
        .set('Authorization', `Bearer ${tokenFor(student)}`);
      expect(res.status).toBe(403);
    });

    it('returns an empty console for a faculty member with no courses', async () => {
      const faculty = await createUser({ role: 'faculty' });
      const res = await request(app)
        .get('/api/attendance/faculty/overview')
        .set('Authorization', `Bearer ${tokenFor(faculty)}`);

      expect(res.status).toBe(200);
      expect(res.body.courses).toHaveLength(0);
      expect(res.body.totals.percentage).toBe(0);
      expect(res.body.trend).toHaveLength(0);
    });
  });

  describe('GET /attendance/faculty/course/:courseId', () => {
    it('returns the roster with risk bands and per-date history', async () => {
      const faculty = await createUser({ role: 'faculty' });
      const courseId = await makeCourse(faculty);

      const critical = await createUser({ role: 'student', name: 'Low Attender', studentCode: 'VIT-0007' });
      const safe = await createUser({ role: 'student', name: 'Good Student' });
      const unmarked = await createUser({ role: 'student', name: 'Never Marked' });
      for (const s of [critical, safe, unmarked]) await enroll(courseId, s);

      for (let i = 0; i < 4; i += 1) await mark(courseId, critical, i === 0 ? 'present' : 'absent', dayOffset(1 + i));
      for (let i = 0; i < 4; i += 1) await mark(courseId, safe, 'present', dayOffset(1 + i));

      const res = await request(app)
        .get(`/api/attendance/faculty/course/${courseId}`)
        .set('Authorization', `Bearer ${tokenFor(faculty)}`);

      expect(res.status).toBe(200);
      expect(res.body.threshold).toBe(75);
      expect(res.body.course).toMatchObject({ name: 'Computer Networks', code: 'CS301' });
      expect(res.body.summary.enrolled).toBe(3);
      expect(res.body.summary.marked).toBe(2);
      expect(res.body.summary.defaulters).toBe(1);
      expect(res.body.summary.percentage).toBe(63); // (1 + 4) of 8 marked

      const byName = Object.fromEntries(res.body.students.map((s) => [s.name, s]));
      expect(byName['Low Attender']).toMatchObject({ status: 'critical', percentage: 25, student_code: 'VIT-0007' });
      expect(byName['Good Student']).toMatchObject({ status: 'safe', percentage: 100 });
      expect(byName['Never Marked']).toMatchObject({ status: 'unmarked', total: 0 });
      expect(byName['Low Attender'].shortfall_classes).toBe(8); // (1+8)/(4+8) = 75%
      expect(Object.keys(byName['Low Attender'].history)).toHaveLength(4);
      expect(byName['Low Attender'].enrolled).toBe(true);

      // Riskiest first, then safe, then unmarked.
      expect(res.body.students.map((s) => s.name)).toEqual([
        'Low Attender',
        'Good Student',
        'Never Marked',
      ]);
    });

    it('lets a faculty member open only their own course', async () => {
      const owner = await createUser({ role: 'faculty' });
      const other = await createUser({ role: 'faculty' });
      const theirs = await makeCourse(owner, { name: 'Networks', code: 'CS101' });
      const notTheirs = await makeCourse(other, { name: 'Databases', code: 'CS102' });

      const allowed = await request(app)
        .get(`/api/attendance/faculty/course/${theirs}`)
        .set('Authorization', `Bearer ${tokenFor(owner)}`);
      expect(allowed.status).toBe(200);

      const denied = await request(app)
        .get(`/api/attendance/faculty/course/${notTheirs}`)
        .set('Authorization', `Bearer ${tokenFor(owner)}`);
      expect(denied.status).toBe(403);
      expect(denied.body.detail).toMatch(/do not teach/i);
    });

    it('lets an admin open any course in their college', async () => {
      const faculty = await createUser({ role: 'faculty' });
      const admin = await createUser({ role: 'college_admin' });
      const courseId = await makeCourse(faculty);

      const res = await request(app)
        .get(`/api/attendance/faculty/course/${courseId}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
      expect(res.status).toBe(200);
    });

    it('404s for an unknown course', async () => {
      const faculty = await createUser({ role: 'faculty' });
      const res = await request(app)
        .get('/api/attendance/faculty/course/000000000000000000000000')
        .set('Authorization', `Bearer ${tokenFor(faculty)}`);
      expect(res.status).toBe(404);
    });

    it('rejects students', async () => {
      const faculty = await createUser({ role: 'faculty' });
      const student = await createUser({ role: 'student' });
      const courseId = await makeCourse(faculty);

      const res = await request(app)
        .get(`/api/attendance/faculty/course/${courseId}`)
        .set('Authorization', `Bearer ${tokenFor(student)}`);
      expect(res.status).toBe(403);
    });
  });
});
