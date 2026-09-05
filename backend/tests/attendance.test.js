const request = require('supertest');
const { buildTestApp } = require('./helpers/testApp');
const { resetDb, closeDB, getDB, oid } = require('./helpers/db');
const { createUser, tokenFor } = require('./helpers/factories');

const app = buildTestApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeDB();
});

describe('Attendance Workflows (Manual & Automatic)', () => {
  async function setupCourseAndEnrollment({ faculty, students = [] }) {
    const db = getDB();
    const collegeId = faculty.collegeId;

    const courseRes = await db.collection('courses').insertOne({
      code: 'CS301',
      name: 'Computer Networks',
      credits: 4,
      facultyId: faculty._id,
      collegeId,
      createdAt: new Date(),
    });
    const courseId = courseRes.insertedId;

    for (const s of students) {
      await db.collection('course_enrollments').insertOne({
        studentId: s._id,
        courseId,
        collegeId,
        enrolledAt: new Date(),
      });
    }

    return { courseId, courseName: 'Computer Networks', courseCode: 'CS301' };
  }

  describe('Session Creation & Listing', () => {
    it('faculty can create an attendance session with snake_case and duration_min', async () => {
      const faculty = await createUser({ role: 'faculty' });
      const { courseId } = await setupCourseAndEnrollment({ faculty });

      const res = await request(app)
        .post('/api/attendance/sessions')
        .set('Authorization', `Bearer ${tokenFor(faculty)}`)
        .send({
          course_id: String(courseId),
          method: 'qr',
          duration_min: 30,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body.course_name).toBe('Computer Networks');
      expect(res.body.method).toBe('qr');
      expect(res.body.code).toBeDefined();
      expect(res.body.active).toBe(true);
      expect(res.body.expires_at).toBeDefined();
    });

    it('faculty can create a GPS geofenced session with coordinates and radius', async () => {
      const faculty = await createUser({ role: 'faculty' });
      const { courseId } = await setupCourseAndEnrollment({ faculty });

      const res = await request(app)
        .post('/api/attendance/sessions')
        .set('Authorization', `Bearer ${tokenFor(faculty)}`)
        .send({
          courseId: String(courseId),
          type: 'gps',
          lat: 12.9716,
          lng: 77.5946,
          radius_m: 100,
          duration_min: 45,
        });

      expect(res.status).toBe(200);
      expect(res.body.method).toBe('gps');
      expect(res.body.lat).toBe(12.9716);
      expect(res.body.lng).toBe(77.5946);
      expect(res.body.radius_m).toBe(100);
    });

    it('enrolled student can see active session with GPS details and code', async () => {
      const faculty = await createUser({ role: 'faculty' });
      const student = await createUser({ role: 'student', collegeId: faculty.collegeId });
      const otherStudent = await createUser({ role: 'student', collegeId: faculty.collegeId });
      const { courseId } = await setupCourseAndEnrollment({ faculty, students: [student] });

      const sess = await request(app)
        .post('/api/attendance/sessions')
        .set('Authorization', `Bearer ${tokenFor(faculty)}`)
        .send({
          course_id: String(courseId),
          method: 'gps',
          lat: 12.9716,
          lng: 77.5946,
          radius_m: 120,
          duration_min: 30,
        });
      expect(sess.status).toBe(200);

      // Enrolled student sees it
      const studentRes = await request(app)
        .get('/api/attendance/sessions/active')
        .set('Authorization', `Bearer ${tokenFor(student)}`);
      expect(studentRes.status).toBe(200);
      expect(studentRes.body.sessions).toHaveLength(1);
      expect(studentRes.body.sessions[0].course_name).toBe('Computer Networks');
      expect(studentRes.body.sessions[0].lat).toBe(12.9716);
      expect(studentRes.body.sessions[0].lng).toBe(77.5946);
      expect(studentRes.body.sessions[0].radius_m).toBe(120);
      expect(studentRes.body.sessions[0].checked_in).toBe(false);

      // Non-enrolled student does not see it
      const otherRes = await request(app)
        .get('/api/attendance/sessions/active')
        .set('Authorization', `Bearer ${tokenFor(otherStudent)}`);
      expect(otherRes.status).toBe(200);
      expect(otherRes.body.sessions).toHaveLength(0);
    });
  });

  describe('Automatic QR Check-in', () => {
    it('accepts correct QR code, rejects wrong code, and rejects duplicate checkin', async () => {
      const faculty = await createUser({ role: 'faculty' });
      const student1 = await createUser({ role: 'student', collegeId: faculty.collegeId });
      const student2 = await createUser({ role: 'student', collegeId: faculty.collegeId });
      const { courseId } = await setupCourseAndEnrollment({ faculty, students: [student1, student2] });

      const sessionRes = await request(app)
        .post('/api/attendance/sessions')
        .set('Authorization', `Bearer ${tokenFor(faculty)}`)
        .send({ course_id: String(courseId), method: 'qr', duration_min: 20 });
      const sessionId = sessionRes.body.id;
      const validCode = sessionRes.body.code;

      // Wrong code
      const failRes = await request(app)
        .post('/api/attendance/checkin')
        .set('Authorization', `Bearer ${tokenFor(student1)}`)
        .send({ session_id: sessionId, code: '000000' });
      expect(failRes.status).toBe(400);
      expect(failRes.body.detail || failRes.body.message).toMatch(/not match/i);

      // Valid code
      const okRes1 = await request(app)
        .post('/api/attendance/checkin')
        .set('Authorization', `Bearer ${tokenFor(student1)}`)
        .send({ session_id: sessionId, code: validCode });
      expect(okRes1.status).toBe(200);
      expect(okRes1.body.ok).toBe(true);
      expect(okRes1.body.status).toBe('present');

      // Second student checking in on time is also marked 'present'
      const okRes2 = await request(app)
        .post('/api/attendance/checkin')
        .set('Authorization', `Bearer ${tokenFor(student2)}`)
        .send({ session_id: sessionId, code: validCode });
      expect(okRes2.status).toBe(200);
      expect(okRes2.body.ok).toBe(true);
      expect(okRes2.body.status).toBe('present');

      // Duplicate check-in attempt
      const dupRes = await request(app)
        .post('/api/attendance/checkin')
        .set('Authorization', `Bearer ${tokenFor(student1)}`)
        .send({ session_id: sessionId, code: validCode });
      expect(dupRes.status).toBe(400);
      expect(dupRes.body.detail || dupRes.body.message).toMatch(/already checked in/i);
    });

    it('marks check-in as late if student checks in after grace period', async () => {
      const faculty = await createUser({ role: 'faculty' });
      const student = await createUser({ role: 'student', collegeId: faculty.collegeId });
      const { courseId } = await setupCourseAndEnrollment({ faculty, students: [student] });

      // Session started 25 minutes ago with default 15 min grace period
      const pastStart = new Date(Date.now() - 25 * 60 * 1000);
      const sessionRes = await request(app)
        .post('/api/attendance/sessions')
        .set('Authorization', `Bearer ${tokenFor(faculty)}`)
        .send({
          course_id: String(courseId),
          method: 'qr',
          startTime: pastStart.toISOString(),
          duration_min: 60,
        });
      const sessionId = sessionRes.body.id;
      const code = sessionRes.body.code;

      const checkinRes = await request(app)
        .post('/api/attendance/checkin')
        .set('Authorization', `Bearer ${tokenFor(student)}`)
        .send({ session_id: sessionId, code });

      expect(checkinRes.status).toBe(200);
      expect(checkinRes.body.status).toBe('late');
    });
  });

  describe('Automatic GPS Geofence Check-in', () => {
    it('verifies location within geofence radius and blocks checkin outside', async () => {
      const faculty = await createUser({ role: 'faculty' });
      const studentInside = await createUser({ role: 'student', collegeId: faculty.collegeId });
      const studentOutside = await createUser({ role: 'student', collegeId: faculty.collegeId });
      const { courseId } = await setupCourseAndEnrollment({
        faculty,
        students: [studentInside, studentOutside],
      });

      // Classroom at MG Road, Bangalore: 12.9716, 77.5946 with radius 150m
      const sessionRes = await request(app)
        .post('/api/attendance/sessions')
        .set('Authorization', `Bearer ${tokenFor(faculty)}`)
        .send({
          course_id: String(courseId),
          method: 'gps',
          lat: 12.9716,
          lng: 77.5946,
          radius_m: 150,
          duration_min: 30,
        });
      const sessionId = sessionRes.body.id;

      // Student without location coordinates
      const missingLocRes = await request(app)
        .post('/api/attendance/checkin')
        .set('Authorization', `Bearer ${tokenFor(studentInside)}`)
        .send({ session_id: sessionId, method: 'gps' });
      expect(missingLocRes.status).toBe(400);
      expect(missingLocRes.body.detail || missingLocRes.body.message).toMatch(/location coordinates are required/i);

      // Student outside geofence (Whitefield, ~15km away)
      const outsideRes = await request(app)
        .post('/api/attendance/checkin')
        .set('Authorization', `Bearer ${tokenFor(studentOutside)}`)
        .send({ session_id: sessionId, lat: 12.9698, lng: 77.7499, method: 'gps' });
      expect(outsideRes.status).toBe(400);
      expect(outsideRes.body.detail || outsideRes.body.message).toMatch(/outside classroom geofence/i);

      // Student inside geofence (~20m away: 12.9717, 77.5947)
      const insideRes = await request(app)
        .post('/api/attendance/checkin')
        .set('Authorization', `Bearer ${tokenFor(studentInside)}`)
        .send({ session_id: sessionId, lat: 12.9717, lng: 77.5947, method: 'gps' });
      expect(insideRes.status).toBe(200);
      expect(insideRes.body.ok).toBe(true);
      expect(insideRes.body.status).toBe('present');
    });
  });

  describe('Manual Attendance & Override Workflow', () => {
    it('faculty can view live session and manually override student status', async () => {
      const faculty = await createUser({ role: 'faculty' });
      const student1 = await createUser({ role: 'student', collegeId: faculty.collegeId });
      const student2 = await createUser({ role: 'student', collegeId: faculty.collegeId });
      const { courseId } = await setupCourseAndEnrollment({ faculty, students: [student1, student2] });

      const sessionRes = await request(app)
        .post('/api/attendance/sessions')
        .set('Authorization', `Bearer ${tokenFor(faculty)}`)
        .send({ course_id: String(courseId), method: 'qr', duration_min: 30 });
      const sessionId = sessionRes.body.id;

      // Student 1 auto-checks in
      await request(app)
        .post('/api/attendance/checkin')
        .set('Authorization', `Bearer ${tokenFor(student1)}`)
        .send({ session_id: sessionId, code: sessionRes.body.code });

      // Faculty manually overrides student 2 (who did not scan) to 'present'
      const overrideRes = await request(app)
        .post(`/api/attendance/sessions/${sessionId}/override`)
        .set('Authorization', `Bearer ${tokenFor(faculty)}`)
        .send({ student_id: String(student2._id), status: 'present', reason: 'Physical roll call' });
      expect(overrideRes.status).toBe(200);
      expect(overrideRes.body.ok).toBe(true);

      // Verify live session roster includes both students
      const liveRes = await request(app)
        .get(`/api/attendance/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${tokenFor(faculty)}`);
      expect(liveRes.status).toBe(200);
      expect(liveRes.body.roll).toHaveLength(2);

      // Faculty toggles student 1 to 'absent'
      const absentRes = await request(app)
        .post(`/api/attendance/sessions/${sessionId}/override`)
        .set('Authorization', `Bearer ${tokenFor(faculty)}`)
        .send({ student_id: String(student1._id), status: 'absent' });
      expect(absentRes.status).toBe(200);

      const liveAfter = await request(app)
        .get(`/api/attendance/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${tokenFor(faculty)}`);
      expect(liveAfter.body.roll).toHaveLength(1);
      expect(liveAfter.body.roll[0].student_id).toBe(String(student2.studentCode || student2._id));
    });

    it('admin override endpoint (/api/admin/attendance/override/:sid) functions correctly', async () => {
      const admin = await createUser({ role: 'college_admin' });
      const faculty = await createUser({ role: 'faculty', collegeId: admin.collegeId });
      const student = await createUser({ role: 'student', collegeId: admin.collegeId });
      const { courseId } = await setupCourseAndEnrollment({ faculty, students: [student] });

      const sessionRes = await request(app)
        .post('/api/attendance/sessions')
        .set('Authorization', `Bearer ${tokenFor(faculty)}`)
        .send({ course_id: String(courseId), method: 'qr', duration_min: 30 });
      const sessionId = sessionRes.body.id;

      const override = await request(app)
        .post(`/api/admin/attendance/override/${sessionId}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ student_id: String(student._id), status: 'present' });
      expect(override.status).toBe(200);
      expect(override.body.status).toBe('present');

      // Admin live roster endpoint
      const roster = await request(app)
        .get(`/api/admin/attendance/live/${sessionId}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
      expect(roster.status).toBe(200);
      expect(roster.body.present).toBe(1);
    });
  });

  describe('Session Closing & Absentee Processing', () => {
    it('closing a session marks absent students and is idempotent', async () => {
      const faculty = await createUser({ role: 'faculty' });
      const studentPresent = await createUser({ role: 'student', collegeId: faculty.collegeId });
      const studentAbsent = await createUser({ role: 'student', collegeId: faculty.collegeId });
      const { courseId } = await setupCourseAndEnrollment({
        faculty,
        students: [studentPresent, studentAbsent],
      });

      const sessionRes = await request(app)
        .post('/api/attendance/sessions')
        .set('Authorization', `Bearer ${tokenFor(faculty)}`)
        .send({ course_id: String(courseId), method: 'qr', duration_min: 15 });
      const sessionId = sessionRes.body.id;

      // Student 1 checks in
      await request(app)
        .post('/api/attendance/checkin')
        .set('Authorization', `Bearer ${tokenFor(studentPresent)}`)
        .send({ session_id: sessionId, code: sessionRes.body.code });

      // Faculty closes session
      const closeRes1 = await request(app)
        .post(`/api/attendance/sessions/${sessionId}/close`)
        .set('Authorization', `Bearer ${tokenFor(faculty)}`);
      expect(closeRes1.status).toBe(200);
      expect(closeRes1.body.ok).toBe(true);

      // Student 2 should now have an absent record in attendance_records
      const db = getDB();
      const absentRecord = await db.collection('attendance_records').findOne({
        studentId: studentAbsent._id,
        sessionId: oid(sessionId),
      });
      expect(absentRecord).toBeDefined();
      expect(absentRecord.status).toBe('absent');

      // Closing a second time should be idempotent and not duplicate
      const closeRes2 = await request(app)
        .post(`/api/attendance/sessions/${sessionId}/close`)
        .set('Authorization', `Bearer ${tokenFor(faculty)}`);
      expect(closeRes2.status).toBe(200);
      expect(closeRes2.body.ok).toBe(true);

      const count = await db.collection('attendance_records').countDocuments({
        studentId: studentAbsent._id,
        sessionId: oid(sessionId),
      });
      expect(count).toBe(1);

      // Late check-in after closure fails
      const lateCheckin = await request(app)
        .post('/api/attendance/checkin')
        .set('Authorization', `Bearer ${tokenFor(studentAbsent)}`)
        .send({ session_id: sessionId, code: sessionRes.body.code });
      expect(lateCheckin.status).toBe(400);
      expect(lateCheckin.body.detail || lateCheckin.body.message).toMatch(/ended/i);
    });
  });

  describe('Student Attendance History & Reports', () => {
    it('GET /api/attendance/me returns student records and course stats correctly', async () => {
      const faculty = await createUser({ role: 'faculty' });
      const student = await createUser({ role: 'student', collegeId: faculty.collegeId });
      const { courseId } = await setupCourseAndEnrollment({ faculty, students: [student] });

      // Session 1: student attended
      const sess1 = await request(app)
        .post('/api/attendance/sessions')
        .set('Authorization', `Bearer ${tokenFor(faculty)}`)
        .send({ course_id: String(courseId), method: 'qr', duration_min: 15 });
      await request(app)
        .post('/api/attendance/checkin')
        .set('Authorization', `Bearer ${tokenFor(student)}`)
        .send({ session_id: sess1.body.id, code: sess1.body.code });
      await request(app)
        .post(`/api/attendance/sessions/${sess1.body.id}/close`)
        .set('Authorization', `Bearer ${tokenFor(faculty)}`);

      // Session 2: student missed
      const sess2 = await request(app)
        .post('/api/attendance/sessions')
        .set('Authorization', `Bearer ${tokenFor(faculty)}`)
        .send({ course_id: String(courseId), method: 'qr', duration_min: 15 });
      await request(app)
        .post(`/api/attendance/sessions/${sess2.body.id}/close`)
        .set('Authorization', `Bearer ${tokenFor(faculty)}`);

      // Query student stats
      const meRes = await request(app)
        .get('/api/attendance/me')
        .set('Authorization', `Bearer ${tokenFor(student)}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.records).toHaveLength(2);
      expect(meRes.body.by_course).toHaveLength(1);
      expect(meRes.body.by_course[0].total).toBe(2);
      expect(meRes.body.by_course[0].present).toBe(1);
      expect(meRes.body.by_course[0].percentage).toBe(50);
    });
  });
});
