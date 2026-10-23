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

function auth(user) {
  return `Bearer ${tokenFor(user)}`;
}

async function createCollege(name) {
  const db = getDB();
  const { insertedId } = await db.collection('colleges').insertOne({
    name,
    code: `${name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()}-${Date.now()}`,
    createdAt: new Date().toISOString(),
  });
  return insertedId;
}

/** Course + one attendance mark, wired to the given college/faculty/student. */
async function seedMark(collegeId, faculty, student, { date = '2026-10-20', status = 'absent' } = {}) {
  const db = getDB();
  const course = await db.collection('courses').insertOne({
    name: 'Database Systems',
    code: 'CS301',
    facultyId: faculty._id,
    collegeId,
  });
  const record = await db.collection('attendance_records').insertOne({
    studentId: student._id,
    courseId: course.insertedId,
    date,
    status,
    method: 'qr',
    sessionId: null,
    collegeId,
  });
  return { courseId: String(course.insertedId), recordId: String(record.insertedId), courseOid: course.insertedId };
}

function correct(header, body) {
  return request(app).patch('/api/attendance/records/correct').set('Authorization', header).send(body);
}

function auditQuery(header, params) {
  const qs = new URLSearchParams(params).toString();
  return request(app).get(`/api/attendance/records/audit?${qs}`).set('Authorization', header);
}

async function auditEntries(recordIdHex) {
  const db = getDB();
  const { oid } = require('./helpers/db');
  return db.collection('attendance_audit_log').find({ recordId: oid(recordIdHex) }).sort({ createdAt: 1 }).toArray();
}

describe('attendance correction (immutable audit)', () => {
  it('corrects a mark, pins the original, and appends an audit entry', async () => {
    const collegeId = await createCollege('Alpha College');
    const faculty = await createUser({ role: 'faculty', name: 'Dr. Rao', collegeId });
    const student = await createUser({ role: 'student', name: 'Asha', collegeId });
    const { courseId, recordId } = await seedMark(collegeId, faculty, student);

    const res = await correct(auth(faculty), {
      courseId,
      studentId: String(student._id),
      date: '2026-10-20',
      status: 'present',
      reason: 'Was present but the QR failed to scan',
    });

    expect(res.status).toBe(200);
    expect(res.body.record.previous_status).toBe('absent');
    expect(res.body.record.status).toBe('present');
    expect(res.body.record.original_status).toBe('absent');
    expect(res.body.audit_id).toBeTruthy();

    const db = getDB();
    const { oid } = require('./helpers/db');
    const record = await db.collection('attendance_records').findOne({ _id: oid(recordId) });
    expect(record.status).toBe('present');
    // History is preserved, not rewritten: pristine value pinned once, revision
    // counts the edits, and a pointer to the audit entry is stored.
    expect(record.originalStatus).toBe('absent');
    expect(record.revision).toBe(1);
    expect(String(record.lastAuditId)).toBe(res.body.audit_id);
    expect(record.correctionReason).toContain('QR failed');

    const [entry] = await auditEntries(recordId);
    expect(entry.previous_status).toBe('absent');
    expect(entry.new_status).toBe('present');
    expect(entry.reason).toContain('QR failed');
    expect(entry.actorName).toBe('Dr. Rao');
    expect(entry.actorRole).toBe('faculty');

    // The student is told what changed and why.
    const notif = await db.collection('notifications').findOne({ title: 'Attendance corrected' });
    expect(notif).toBeTruthy();
    expect(notif.recipientIds).toContain(String(student._id));
    expect(notif.body).toContain('absent to present');
  });

  it('refuses a correction without a meaningful reason and writes nothing', async () => {
    const collegeId = await createCollege('Alpha College');
    const faculty = await createUser({ role: 'faculty', collegeId });
    const student = await createUser({ role: 'student', collegeId });
    const { courseId, recordId } = await seedMark(collegeId, faculty, student);

    const missing = await correct(auth(faculty), {
      courseId, studentId: String(student._id), date: '2026-10-20', status: 'present',
    });
    expect(missing.status).toBe(400);
    expect(missing.body.detail).toMatch(/reason/i);

    const tooShort = await correct(auth(faculty), {
      courseId, studentId: String(student._id), date: '2026-10-20', status: 'present', reason: 'ok',
    });
    expect(tooShort.status).toBe(400);

    const db = getDB();
    const { oid } = require('./helpers/db');
    const record = await db.collection('attendance_records').findOne({ _id: oid(recordId) });
    expect(record.status).toBe('absent');
    expect(await db.collection('attendance_audit_log').countDocuments({})).toBe(0);
  });

  it('validates the status and rejects a no-op change', async () => {
    const collegeId = await createCollege('Alpha College');
    const faculty = await createUser({ role: 'faculty', collegeId });
    const student = await createUser({ role: 'student', collegeId });
    const { courseId } = await seedMark(collegeId, faculty, student);

    const bad = await correct(auth(faculty), {
      courseId, studentId: String(student._id), date: '2026-10-20', status: 'excused', reason: 'Medical leave note submitted',
    });
    expect(bad.status).toBe(400);
    expect(bad.body.detail).toMatch(/present, late, absent/);

    const noop = await correct(auth(faculty), {
      courseId, studentId: String(student._id), date: '2026-10-20', status: 'absent', reason: 'Trying to change nothing here',
    });
    expect(noop.status).toBe(400);
    expect(noop.body.detail).toMatch(/already marked absent/);
  });

  it('enforces the college lock window but keeps corrections open by default', async () => {
    const db = getDB();
    const collegeId = await createCollege('Alpha College');
    const faculty = await createUser({ role: 'faculty', collegeId });
    const student = await createUser({ role: 'student', collegeId });
    const { courseId, recordId } = await seedMark(collegeId, faculty, student, { date: '2026-01-05' });

    // Default settings = 0 days = open, so an old mark is still editable.
    const open = await correct(auth(faculty), {
      courseId, studentId: String(student._id), date: '2026-01-05', status: 'present', reason: 'Old mark was never checked',
    });
    expect(open.status).toBe(200);

    // A 7-day window locks anything older.
    await db.collection('colleges').updateOne(
      { _id: collegeId },
      { $set: { settings: { attendanceCorrectionWindowDays: 7 } } },
    );
    const locked = await correct(auth(faculty), {
      courseId, studentId: String(student._id), date: '2026-01-05', status: 'absent', reason: 'Second thought about the old mark',
    });
    expect(locked.status).toBe(403);
    expect(locked.body.detail).toMatch(/locked/);

    const { oid } = require('./helpers/db');
    const record = await db.collection('attendance_records').findOne({ _id: oid(recordId) });
    expect(record.status).toBe('present'); // the locked attempt changed nothing
  });

  it('scopes corrections to the courses a faculty member actually teaches', async () => {
    const collegeId = await createCollege('Alpha College');
    const faculty = await createUser({ role: 'faculty', name: 'Not Theirs', collegeId });
    const otherFaculty = await createUser({ role: 'faculty', name: 'Dr. Rao', collegeId });
    const student = await createUser({ role: 'student', collegeId });
    const { courseId } = await seedMark(collegeId, otherFaculty, student);

    const res = await correct(auth(faculty), {
      courseId, studentId: String(student._id), date: '2026-10-20', status: 'present', reason: 'Trying to edit a foreign course',
    });
    expect(res.status).toBe(403);
    expect(res.body.detail).toMatch(/do not teach/);

    // An admin of the same college can correct any course.
    const admin = await createUser({ role: 'college_admin', collegeId });
    const byAdmin = await correct(auth(admin), {
      courseId, studentId: String(student._id), date: '2026-10-20', status: 'present', reason: 'Admin correction after a complaint',
    });
    expect(byAdmin.status).toBe(200);
  });

  it('never lets corrections cross colleges, students, or anonymous callers', async () => {
    const collegeA = await createCollege('Alpha College');
    const collegeB = await createCollege('Beta College');
    const facultyA = await createUser({ role: 'faculty', collegeId: collegeA });
    const facultyB = await createUser({ role: 'faculty', collegeId: collegeB });
    const studentB = await createUser({ role: 'student', collegeId: collegeB });
    const { courseId } = await seedMark(collegeB, facultyB, studentB);

    const outsider = await correct(auth(facultyA), {
      courseId, studentId: String(studentB._id), date: '2026-10-20', status: 'present', reason: 'Cross college edit attempt',
    });
    expect(outsider.status).toBe(404);

    const student = await correct(auth(studentB), {
      courseId, studentId: String(studentB._id), date: '2026-10-20', status: 'present', reason: 'Students must stay read-only',
    });
    expect(student.status).toBe(403);

    const anon = await request(app).patch('/api/attendance/records/correct').send({
      courseId, studentId: String(studentB._id), date: '2026-10-20', status: 'present', reason: 'Anonymous edit attempt',
    });
    expect(anon.status).toBe(401);
  });

  it('rejects a stale correction and keeps a full trail across repeat edits', async () => {
    const collegeId = await createCollege('Alpha College');
    const faculty = await createUser({ role: 'faculty', name: 'Dr. Rao', collegeId });
    const student = await createUser({ role: 'student', collegeId });
    const { courseId, recordId } = await seedMark(collegeId, faculty, student);

    // Optimistic check: the screen saw "absent", the mark is now "late".
    const first = await correct(auth(faculty), {
      courseId, studentId: String(student._id), date: '2026-10-20', status: 'late', reason: 'Student arrived ten minutes late',
    });
    expect(first.status).toBe(200);

    const stale = await correct(auth(faculty), {
      courseId, studentId: String(student._id), date: '2026-10-20', status: 'present', reason: 'Working from a stale screen here',
      expected_status: 'absent',
    });
    expect(stale.status).toBe(409);

    const second = await correct(auth(faculty), {
      courseId, studentId: String(student._id), date: '2026-10-20', status: 'present', reason: 'Late mark was wrong, has a note',
      expected_status: 'late',
    });
    expect(second.status).toBe(200);

    // The trail is append-only and ordered; the pristine value never moves.
    const entries = await auditEntries(recordId);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => `${e.previous_status}->${e.new_status}`)).toEqual(['absent->late', 'late->present']);

    const { oid } = require('./helpers/db');
    const db = getDB();
    const record = await db.collection('attendance_records').findOne({ _id: oid(recordId) });
    expect(record.originalStatus).toBe('absent');
    expect(record.revision).toBe(2);
  });

  it('serves a read-only trail to the student who owns the mark', async () => {
    const collegeId = await createCollege('Alpha College');
    const faculty = await createUser({ role: 'faculty', name: 'Dr. Rao', collegeId });
    const student = await createUser({ role: 'student', name: 'Asha', collegeId });
    const bystander = await createUser({ role: 'student', name: 'Ravi', collegeId });
    const { courseId } = await seedMark(collegeId, faculty, student);

    await correct(auth(faculty), {
      courseId, studentId: String(student._id), date: '2026-10-20', status: 'present', reason: 'Scanner lost the first check-in',
    });

    const params = { courseId, studentId: String(student._id), date: '2026-10-20' };

    const own = await auditQuery(auth(student), params);
    expect(own.status).toBe(200);
    expect(own.body.total).toBe(1);
    expect(own.body.items[0].previous_status).toBe('absent');
    expect(own.body.items[0].actor_name).toBe('Dr. Rao');
    expect(own.body.original_status).toBe('absent');
    expect(own.body.current_status).toBe('present');

    const other = await auditQuery(auth(bystander), params);
    expect(other.status).toBe(403);

    const anon = await request(app).get(`/api/attendance/records/audit?${new URLSearchParams(params)}`);
    expect(anon.status).toBe(401);

    const missing = await auditQuery(auth(student), { courseId, studentId: String(student._id), date: '2026-10-21' });
    expect(missing.status).toBe(404);
  });
});
