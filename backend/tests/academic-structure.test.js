const request = require('supertest');
const { buildTestApp } = require('./helpers/testApp');
const { prisma, resetDb, getDB, oid } = require('./helpers/db');
const { createUser, tokenFor } = require('./helpers/factories');

const app = buildTestApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createCollege(name) {
  const db = getDB();
  const { insertedId } = await db.collection('colleges').insertOne({
    name,
    code: `${name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    createdAt: new Date().toISOString(),
  });
  return insertedId;
}

function auth(user) {
  return `Bearer ${tokenFor(user)}`;
}

/**
 * Builds the canonical chain Session → Programme → Branch → Section → Subject
 * through the real HTTP layer and fails loudly if any link breaks.
 */
async function buildStructure(header, opts = {}) {
  const post = (path, body) => request(app).post(path).set('Authorization', header).send(body);

  const session = await post('/api/academic/sessions', {
    name: opts.sessionName || '2025-2026',
    start_date: '2025-07-01',
    end_date: '2026-06-30',
    is_current: true,
  });
  const program = await post('/api/academic/programs', { name: 'B.Tech', durationYears: 4 });
  const branch = await post('/api/academic/branches', {
    program_id: program.body.id,
    name: 'Computer Science and Engineering',
    code: 'CSE',
  });
  const section = await post('/api/academic/sections', {
    program_id: program.body.id,
    branch_id: branch.body.id,
    year: 2,
    name: 'A',
  });
  const subject = await post('/api/academic/subjects', {
    code: 'CS301',
    name: 'Database Management Systems',
    program_id: program.body.id,
    branch_id: branch.body.id,
    year: 2,
    semester: 3,
    subject_type: 'theory',
    credits: 4,
    session_ids: [session.body.id],
  });

  const steps = { session, program, branch, section, subject };
  for (const [label, res] of Object.entries(steps)) {
    if (res.status !== 201) {
      throw new Error(`${label} create failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
  }
  return { ...Object.fromEntries(Object.entries(steps).map(([k, v]) => [k, v.body])), post };
}

describe('structured academic management (scenarios 1, 14)', () => {
  it('creates a programme with branches, years, semesters and subjects, rejecting duplicates', async () => {
    const collegeId = await createCollege('Alpha College');
    const admin = await createUser({ role: 'college_admin', collegeId });
    const header = auth(admin);
    const s = await buildStructure(header);

    // Programme + session duplicates
    const dupeProgram = await request(app)
      .post('/api/academic/programs')
      .set('Authorization', header)
      .send({ name: 'B.Tech' });
    expect(dupeProgram.status).toBe(409);

    const dupeSession = await request(app)
      .post('/api/academic/sessions')
      .set('Authorization', header)
      .send({ name: '2025-2026' });
    expect(dupeSession.status).toBe(409);

    // Branch with derived initials when no code is given
    const it = await request(app)
      .post('/api/academic/branches')
      .set('Authorization', header)
      .send({ program_id: s.program.id, name: 'Information Technology' });
    expect(it.status).toBe(201);
    expect(it.body.code).toBe('IT');

    const dupeBranch = await request(app)
      .post('/api/academic/branches')
      .set('Authorization', header)
      .send({ program_id: s.program.id, name: 'Information Tech', code: 'CSE' });
    expect(dupeBranch.status).toBe(409);

    // Duplicate section for the same year
    const dupeSection = await request(app)
      .post('/api/academic/sections')
      .set('Authorization', header)
      .send({ program_id: s.program.id, branch_id: s.branch.id, year: 2, name: 'A' });
    expect(dupeSection.status).toBe(409);

    // Subject code collision inside the college
    const dupeCode = await request(app)
      .post('/api/academic/subjects')
      .set('Authorization', header)
      .send({
        code: 'CS301',
        name: 'Operating Systems',
        program_id: s.program.id,
        branch_id: s.branch.id,
        year: 2,
        semester: 3,
      });
    expect(dupeCode.status).toBe(409);
    expect(dupeCode.body.detail).toMatch(/CS301 already exists/i);

    // Same subject name in a different semester is legitimately allowed
    const otherSem = await request(app)
      .post('/api/academic/subjects')
      .set('Authorization', header)
      .send({
        code: 'CS405',
        name: 'Database Management Systems',
        program_id: s.program.id,
        branch_id: s.branch.id,
        year: 2,
        semester: 4,
      });
    expect(otherSem.status).toBe(201);

    // Invalid semester rejected
    const badSem = await request(app)
      .post('/api/academic/subjects')
      .set('Authorization', header)
      .send({ code: 'CS501', name: 'Algorithms', program_id: s.program.id, year: 2, semester: 0 });
    expect(badSem.status).toBe(400);

    // Dependent filters behave (semester → subjects, programme → branches)
    const semester3 = await request(app)
      .get('/api/academic/subjects')
      .query({ semester: 3 })
      .set('Authorization', header);
    expect(semester3.status).toBe(200);
    expect(semester3.body.map(x => x.code)).toEqual(['CS301']);

    const sessionScoped = await request(app)
      .get('/api/academic/subjects')
      .query({ session_id: s.session.id })
      .set('Authorization', header);
    expect(sessionScoped.body.length).toBe(2);

    const branches = await request(app)
      .get('/api/academic/branches')
      .query({ program_id: s.program.id })
      .set('Authorization', header);
    expect(branches.body.length).toBe(2);

    // Exactly one current session
    const sessions = await request(app).get('/api/academic/sessions').set('Authorization', header);
    expect(sessions.body.filter(x => x.is_current)).toHaveLength(1);

    // Switching current moves the flag
    const second = await request(app)
      .post('/api/academic/sessions')
      .set('Authorization', header)
      .send({ name: '2026-2027', is_current: true });
    expect(second.status).toBe(201);
    const after = await request(app).get('/api/academic/sessions').set('Authorization', header);
    expect(after.body.find(x => x.is_current).name).toBe('2026-2027');
  });

  it('rejects structural writes from students and faculty (RBAC)', async () => {
    const collegeId = await createCollege('Alpha College');
    const student = await createUser({ role: 'student', collegeId });
    const faculty = await createUser({ role: 'faculty', collegeId });

    for (const [method, path, body] of [
      ['post', '/api/academic/programs', { name: 'B.Tech' }],
      ['post', '/api/academic/sessions', { name: '2025-2026' }],
      ['post', '/api/academic/branches', { name: 'CSE' }],
      ['post', '/api/academic/subjects', { code: 'X1', name: 'X' }],
      ['post', '/api/academic/enrollments', { studentIds: [] }],
      ['put', '/api/academic/settings', { allowCoTeaching: false }],
    ]) {
      const res = await request(app)[method](path).set('Authorization', auth(student)).send(body);
      expect(res.status).toBe(403);
      const res2 = await request(app)[method](path).set('Authorization', auth(faculty)).send(body);
      expect(res2.status).toBe(403);
    }
  });
});

describe('faculty assignment (scenarios 2, 4, 14, 16)', () => {
  it('assigns faculty to subject + section with conflict and deactivation protection', async () => {
    const collegeId = await createCollege('Alpha College');
    const admin = await createUser({ role: 'college_admin', collegeId });
    const header = auth(admin);
    const s = await buildStructure(header);
    const fac1 = await createUser({ role: 'faculty', collegeId, name: 'Dr. Rao' });
    const fac2 = await createUser({ role: 'faculty', collegeId, name: 'Dr. Sen' });

    const body = {
      session_id: s.session.id,
      course_id: s.subject.id,
      faculty_id: fac1.id,
      section_id: s.section.id,
    };
    const assigned = await s.post('/api/academic/assignments', body);
    expect(assigned.status).toBe(201);
    expect(assigned.body).toMatchObject({
      faculty_name: 'Dr. Rao',
      section_name: 'A',
      course_name: 'Database Management Systems',
      year: 2,
      semester: 3,
      active: true,
    });

    // Exact duplicate rejected
    const dupe = await s.post('/api/academic/assignments', body);
    expect(dupe.status).toBe(409);
    expect(dupe.body.detail).toMatch(/already assigned/i);

    // Co-teaching is allowed by default
    const coTeacher = await s.post('/api/academic/assignments', {
      ...body,
      faculty_id: fac2.id,
    });
    expect(coTeacher.status).toBe(201);

    // Legacy single-faculty views keep working through the mirrored field
    const subjects = await request(app)
      .get('/api/academic/subjects')
      .set('Authorization', header);
    expect(subjects.body.find(x => x.code === 'CS301').faculty_id).toBe(fac1.id);

    // College policy can forbid co-teaching
    const settings = await request(app)
      .put('/api/academic/settings')
      .set('Authorization', header)
      .send({ allowCoTeaching: false });
    expect(settings.status).toBe(200);
    expect(settings.body.allowCoTeaching).toBe(false);

    const fac3 = await createUser({ role: 'faculty', collegeId, name: 'Dr. Iyer' });
    const conflict = await s.post('/api/academic/assignments', { ...body, faculty_id: fac3.id });
    expect(conflict.status).toBe(409);
    expect(conflict.body.detail).toMatch(/already taught/i);

    // Deactivated faculty accounts cannot be assigned (scenario 16)
    const deactivated = await createUser({ role: 'faculty', collegeId, name: 'Dr. Left' });
    await getDB()
      .collection('users')
      .updateOne({ _id: oid(deactivated.id) }, { $set: { isActive: false, status: 'inactive' } });
    const inactiveAttempt = await s.post('/api/academic/assignments', { ...body, faculty_id: deactivated.id });
    expect(inactiveAttempt.status).toBe(400);
    expect(inactiveAttempt.body.detail).toMatch(/deactivated/i);

    // Inactive subjects cannot be assigned (scenario 16)
    const deactivate = await request(app)
      .put(`/api/academic/subjects/${s.subject.id}`)
      .set('Authorization', header)
      .send({ active: false });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.active).toBe(false);

    const onInactive = await s.post('/api/academic/assignments', { ...body, faculty_id: fac1.id, session_id: s.session.id });
    // fac1 is already assigned → 409 duplicate; use a free faculty instead
    if (onInactive.status === 409) {
      const fac4 = await createUser({ role: 'faculty', collegeId });
      const attempt = await s.post('/api/academic/assignments', { ...body, faculty_id: fac4.id });
      expect(attempt.status).toBe(400);
      expect(attempt.body.detail).toMatch(/inactive/i);
    } else {
      expect(onInactive.status).toBe(400);
    }

    // Soft-delete keeps the record for history
    const remove = await request(app)
      .delete(`/api/academic/assignments/${assigned.body.id}`)
      .set('Authorization', header);
    expect(remove.status).toBe(200);
    expect(remove.body.active).toBe(false);
    const kept = await getDB()
      .collection('faculty_assignments')
      .findOne({ _id: oid(assigned.body.id) });
    expect(kept).not.toBeNull();
  });

  it('lets faculty see only their own classes and nothing else (scenario 4)', async () => {
    const collegeId = await createCollege('Alpha College');
    const admin = await createUser({ role: 'college_admin', collegeId });
    const header = auth(admin);
    const s = await buildStructure(header);
    const fac1 = await createUser({ role: 'faculty', collegeId, name: 'Dr. Rao' });
    const fac2 = await createUser({ role: 'faculty', collegeId, name: 'Dr. Stranger' });

    await s.post('/api/academic/assignments', {
      session_id: s.session.id,
      course_id: s.subject.id,
      faculty_id: fac1.id,
      section_id: s.section.id,
    });

    const fac1Assignments = await request(app)
      .get('/api/academic/assignments')
      .set('Authorization', auth(fac1));
    expect(fac1Assignments.status).toBe(200);
    expect(fac1Assignments.body).toHaveLength(1);

    const fac2Assignments = await request(app)
      .get('/api/academic/assignments')
      .set('Authorization', auth(fac2));
    expect(fac2Assignments.status).toBe(200);
    expect(fac2Assignments.body).toHaveLength(0);

    // Subject visibility follows the same rule
    const fac1Subjects = await request(app)
      .get('/api/academic/subjects')
      .set('Authorization', auth(fac1));
    expect(fac1Subjects.body.map(x => x.code)).toEqual(['CS301']);

    const fac2Subjects = await request(app)
      .get('/api/academic/subjects')
      .set('Authorization', auth(fac2));
    expect(fac2Subjects.body).toHaveLength(0);

    // Faculty cannot assign themselves or create subjects
    const selfAssign = await request(app)
      .post('/api/academic/assignments')
      .set('Authorization', auth(fac2))
      .send({
        session_id: s.session.id,
        course_id: s.subject.id,
        faculty_id: fac2.id,
        section_id: s.section.id,
      });
    expect(selfAssign.status).toBe(403);
  });
});

describe('student enrollment (scenarios 3, 10, 14, 16)', () => {
  it('enrolls students into the structure and subject rosters, deduplicating repeats', async () => {
    const collegeId = await createCollege('Alpha College');
    const admin = await createUser({ role: 'college_admin', collegeId });
    const header = auth(admin);
    const s = await buildStructure(header);
    const st1 = await createUser({ role: 'student', collegeId, name: 'Asha' });
    const st2 = await createUser({ role: 'student', collegeId, name: 'Vikram' });
    const st3 = await createUser({ role: 'student', collegeId, name: 'Meera' });

    const enrollBody = {
      session_id: s.session.id,
      program_id: s.program.id,
      branch_id: s.branch.id,
      year: 2,
      semester: 3,
      section_id: s.section.id,
      studentIds: [st1.id, st2.id, st3.id],
    };
    const first = await s.post('/api/academic/enrollments', enrollBody);
    expect(first.status).toBe(201);
    expect(first.body).toEqual({ created: 3, skipped: 0, total: 3 });

    // Re-submitting the same cohort is a no-op, not an error
    const again = await s.post('/api/academic/enrollments', enrollBody);
    expect(again.status).toBe(201);
    expect(again.body).toEqual({ created: 0, skipped: 3, total: 3 });

    // Listing with names + body-wrapped pagination
    const list = await request(app)
      .get('/api/academic/enrollments')
      .query({ session_id: s.session.id, section_id: s.section.id, page: 1, pageSize: 2 })
      .set('Authorization', header);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(3);
    expect(list.body.items).toHaveLength(2);
    expect(list.body.items[0]).toHaveProperty('student_name');

    // Subject roster: every active subject of that semester, then deduped
    const bulkBody = {
      session_id: s.session.id,
      program_id: s.program.id,
      branch_id: s.branch.id,
      year: 2,
      semester: 3,
      section_id: s.section.id,
    };
    const bulk = await s.post('/api/academic/enrollments/subjects', bulkBody);
    expect(bulk.status).toBe(201);
    expect(bulk.body).toMatchObject({ created: 3, skipped: 0, students: 3, subjects: 1 });

    const bulkAgain = await s.post('/api/academic/enrollments/subjects', bulkBody);
    expect(bulkAgain.body).toMatchObject({ created: 0, skipped: 3 });

    // Students can read their own enrollment, but nobody else's
    const own = await request(app)
      .get('/api/academic/enrollments')
      .set('Authorization', auth(st1));
    expect(own.status).toBe(200);
    expect(own.body.total).toBe(1);
    expect(own.body.items[0].student_id).toBe(st1.id);

    // ...and their subjects
    const mySubjects = await request(app)
      .get('/api/academic/subjects')
      .set('Authorization', auth(st1));
    expect(mySubjects.body.map(x => x.code)).toEqual(['CS301']);
  });

  it('never lets one college enroll or read another college\'s people (scenario 10)', async () => {
    const collegeA = await createCollege('Alpha College');
    const collegeB = await createCollege('Beta College');
    const adminA = await createUser({ role: 'college_admin', collegeId: collegeA });
    const adminB = await createUser({ role: 'college_admin', collegeId: collegeB });
    const headerA = auth(adminA);
    const headerB = auth(adminB);

    const s = await buildStructure(headerA);
    const facA = await createUser({ role: 'faculty', collegeId: collegeA });
    const stA = await createUser({ role: 'student', collegeId: collegeA });
    await s.post('/api/academic/assignments', {
      session_id: s.session.id,
      course_id: s.subject.id,
      faculty_id: facA.id,
      section_id: s.section.id,
    });
    await s.post('/api/academic/enrollments', {
      session_id: s.session.id,
      program_id: s.program.id,
      year: 2,
      semester: 3,
      studentIds: [stA.id],
    });

    // Reads from college B see none of college A's structure
    for (const path of ['/api/academic/programs', '/api/academic/sessions', '/api/academic/branches', '/api/academic/subjects']) {
      const res = await request(app).get(path).set('Authorization', headerB);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    }
    const assignmentsB = await request(app).get('/api/academic/assignments').set('Authorization', headerB);
    expect(assignmentsB.body).toHaveLength(0);
    const enrollmentsB = await request(app).get('/api/academic/enrollments').set('Authorization', headerB);
    expect(enrollmentsB.body.total).toBe(0);

    // Writes against college A's ids fail with 404 (existence is not leaked)
    const edits = [
      request(app).put(`/api/academic/programs/${s.program.id}`).set('Authorization', headerB).send({ name: 'Hijacked' }),
      request(app).put(`/api/academic/sessions/${s.session.id}`).set('Authorization', headerB).send({ name: 'Hijacked' }),
      request(app).put(`/api/academic/subjects/${s.subject.id}`).set('Authorization', headerB).send({ name: 'Hijacked' }),
      request(app)
        .post('/api/academic/branches')
        .set('Authorization', headerB)
        .send({ program_id: s.program.id, name: 'Sneaky Branch' }),
      request(app)
        .post('/api/academic/assignments')
        .set('Authorization', headerB)
        .send({ session_id: s.session.id, course_id: s.subject.id, faculty_id: facA.id, section_id: s.section.id }),
    ];
    for (const edit of edits) {
      const res = await edit;
      expect(res.status).toBe(404);
    }

    // Legacy courses endpoint is isolated too
    const legacy = await request(app)
      .post('/api/courses')
      .set('Authorization', headerA)
      .send({ code: 'LEG101', name: 'Legacy Subject' });
    expect(legacy.status).toBe(200);
    const seenByB = await request(app).get('/api/courses').set('Authorization', headerB);
    expect(seenByB.body).toHaveLength(0);
    const seenByA = await request(app).get('/api/courses').set('Authorization', headerA);
    expect(seenByA.body.some(c => c.code === 'LEG101')).toBe(true);
  });

  it('promotes students without rewriting history or subject rosters (scenario 16)', async () => {
    const collegeId = await createCollege('Alpha College');
    const admin = await createUser({ role: 'college_admin', collegeId });
    const header = auth(admin);
    const s = await buildStructure(header);
    const nextSection = await s.post('/api/academic/sections', {
      program_id: s.program.id,
      branch_id: s.branch.id,
      year: 3,
      name: 'B',
    });
    expect(nextSection.status).toBe(201);

    const st1 = await createUser({ role: 'student', collegeId, name: 'Asha' });
    const st2 = await createUser({ role: 'student', collegeId, name: 'Vikram' });
    await s.post('/api/academic/enrollments', {
      session_id: s.session.id,
      program_id: s.program.id,
      branch_id: s.branch.id,
      year: 2,
      semester: 3,
      section_id: s.section.id,
      studentIds: [st1.id, st2.id],
    });
    await s.post('/api/academic/enrollments/subjects', {
      session_id: s.session.id,
      program_id: s.program.id,
      branch_id: s.branch.id,
      year: 2,
      semester: 3,
    });

    const promote = await s.post('/api/academic/enrollments/promote', {
      session_id: s.session.id,
      studentIds: [st1.id, st2.id],
      to_year: 3,
      to_semester: 5,
      to_section_id: nextSection.body.id,
    });
    expect(promote.status).toBe(200);
    expect(promote.body).toEqual({ promoted: 2, already_at_target: 0, total: 2 });

    // Previous enrollment documents are retained, never deleted
    const olds = await getDB()
      .collection('student_enrollments')
      .find({ status: 'promoted' })
      .toArray();
    expect(olds).toHaveLength(2);
    expect(olds[0].promotedTo).toMatchObject({ year: 3, semester: 5 });

    const active = await getDB()
      .collection('student_enrollments')
      .find({ status: 'active', year: 3, semester: 5 })
      .toArray();
    expect(active).toHaveLength(2);

    // Subject-level enrollments are untouched by promotion
    expect(await getDB().collection('course_enrollments').countDocuments({})).toBe(2);

    // Re-promoting the same cohort is idempotent
    const repeat = await s.post('/api/academic/enrollments/promote', {
      session_id: s.session.id,
      studentIds: [st1.id],
      to_year: 3,
      to_semester: 5,
    });
    expect(repeat.body).toEqual({ promoted: 0, already_at_target: 1, total: 1 });

    // Default list shows current students; history stays queryable
    const current = await request(app)
      .get('/api/academic/enrollments')
      .query({ session_id: s.session.id, year: 3 })
      .set('Authorization', header);
    expect(current.body.total).toBe(2);
    const history = await request(app)
      .get('/api/academic/enrollments')
      .query({ session_id: s.session.id, status: 'promoted' })
      .set('Authorization', header);
    expect(history.body.total).toBe(2);
  });

  it('withdraws an enrollment softly instead of deleting it (scenario 16)', async () => {
    const collegeId = await createCollege('Alpha College');
    const admin = await createUser({ role: 'college_admin', collegeId });
    const header = auth(admin);
    const s = await buildStructure(header);
    const student = await createUser({ role: 'student', collegeId });
    const enroll = await s.post('/api/academic/enrollments', {
      session_id: s.session.id,
      program_id: s.program.id,
      year: 2,
      semester: 3,
      studentIds: [student.id],
    });
    expect(enroll.body.created).toBe(1);

    const id = (await request(app)
      .get('/api/academic/enrollments')
      .query({ session_id: s.session.id })
      .set('Authorization', header)).body.items[0].id;

    const withdraw = await request(app)
      .delete(`/api/academic/enrollments/${id}`)
      .set('Authorization', header);
    expect(withdraw.status).toBe(200);
    expect(withdraw.body.status).toBe('inactive');

    const stillThere = await getDB().collection('student_enrollments').findOne({ _id: oid(id) });
    expect(stillThere).not.toBeNull();

    const list = await request(app)
      .get('/api/academic/enrollments')
      .query({ session_id: s.session.id })
      .set('Authorization', header);
    expect(list.body.total).toBe(0);
  });
});

describe('subject edits and deletes preserve history (scenarios 13, 15, 16)', () => {
  it('renaming a subject never touches attendance records; deleting one deactivates it', async () => {
    const collegeId = await createCollege('Alpha College');
    const admin = await createUser({ role: 'college_admin', collegeId });
    const header = auth(admin);
    const s = await buildStructure(header);
    const student = await createUser({ role: 'student', collegeId });

    // A real attendance record pointing at the subject
    const { insertedId } = await getDB().collection('attendance_records').insertOne({
      studentId: oid(student.id),
      courseId: oid(s.subject.id),
      sessionId: null,
      status: 'present',
      date: '2026-10-20',
      method: 'live',
      collegeId: oid(collegeId),
      recordedAt: new Date().toISOString(),
    });

    const rename = await request(app)
      .put(`/api/academic/subjects/${s.subject.id}`)
      .set('Authorization', header)
      .send({ name: 'Advanced Database Management Systems', credits: 5 });
    expect(rename.status).toBe(200);
    expect(rename.body.name).toBe('Advanced Database Management Systems');
    expect(rename.body.credits).toBe(5);

    // Attendance record is byte-for-byte untouched
    const record = await getDB().collection('attendance_records').findOne({ _id: insertedId });
    expect(record).toMatchObject({ status: 'present', date: '2026-10-20', method: 'live' });

    // Deleting a subject WITH history deactivates instead of destroying
    const remove = await request(app)
      .delete(`/api/admin/courses/${s.subject.id}`)
      .set('Authorization', header);
    expect(remove.status).toBe(200);
    expect(remove.body).toEqual({ ok: true, deactivated: true });

    const course = await getDB().collection('courses').findOne({ _id: oid(s.subject.id) });
    expect(course).not.toBeNull();
    expect(course.active).toBe(false);
    expect(await getDB().collection('attendance_records').countDocuments({ _id: insertedId })).toBe(1);

    // A brand-new subject with no references still deletes outright
    const fresh = await s.post('/api/academic/subjects', {
      code: 'CS999',
      name: 'Brand New Subject',
      program_id: s.program.id,
      year: 2,
      semester: 6,
    });
    expect(fresh.status).toBe(201);
    const hardDelete = await request(app)
      .delete(`/api/admin/courses/${fresh.body.id}`)
      .set('Authorization', header);
    expect(hardDelete.status).toBe(200);
    expect(hardDelete.body).toEqual({ ok: true });
    expect(await getDB().collection('courses').findOne({ _id: oid(fresh.body.id) })).toBeNull();
  });
});

describe('legacy access hardening (RBAC / scenarios 4, 9, 10)', () => {
  it('never falls back to college-wide courses or timetables for scoped roles', async () => {
    const collegeId = await createCollege('Alpha College');
    const admin = await createUser({ role: 'college_admin', collegeId });
    const student = await createUser({ role: 'student', collegeId });
    const otherStudent = await createUser({ role: 'student', collegeId });
    const faculty = await createUser({ role: 'faculty', collegeId });

    const course = await request(app)
      .post('/api/courses')
      .set('Authorization', auth(admin))
      .send({ code: 'CS101', name: 'Intro to Code', faculty_id: faculty.id });
    expect(course.status).toBe(200);

    // Unlinked student / faculty see nothing rather than everything
    const studentCourses = await request(app).get('/api/courses').set('Authorization', auth(student));
    expect(studentCourses.status).toBe(200);
    expect(studentCourses.body).toHaveLength(0);

    const studentTimetable = await request(app).get('/api/timetable').set('Authorization', auth(student));
    expect(studentTimetable.status).toBe(200);
    expect(studentTimetable.body).toHaveLength(0);

    // Enrolled student sees their subject and its timetable
    await getDB().collection('course_enrollments').insertOne({
      studentId: oid(student.id),
      courseId: oid(course.body.id),
      collegeId: oid(collegeId),
      enrolledAt: new Date(),
    });
    await getDB().collection('timetable_slots').insertOne({
      courseId: oid(course.body.id),
      facultyId: oid(faculty.id),
      dayOfWeek: 'Mon',
      startTime: '09:00',
      endTime: '10:00',
      collegeId: oid(collegeId),
    });

    const enrolledList = await request(app).get('/api/courses').set('Authorization', auth(student));
    expect(enrolledList.body.map(c => c.code)).toEqual(['CS101']);
    const enrolledTimetable = await request(app).get('/api/timetable').set('Authorization', auth(student));
    expect(enrolledTimetable.body).toHaveLength(1);

    // Another student with no enrollment still sees nothing
    const otherCourses = await request(app).get('/api/courses').set('Authorization', auth(otherStudent));
    expect(otherCourses.body).toHaveLength(0);

    // Faculty cannot create subjects, and cannot edit one they do not teach
    const facultyCreate = await request(app)
      .post('/api/courses')
      .set('Authorization', auth(faculty))
      .send({ code: 'CS202', name: 'Sneaky Subject' });
    expect(facultyCreate.status).toBe(403);

    const stranger = await createUser({ role: 'faculty', collegeId, name: 'Dr. Stranger' });
    const strangerEdit = await request(app)
      .put(`/api/courses/${course.body.id}`)
      .set('Authorization', auth(stranger))
      .send({ name: 'Renamed by a stranger' });
    expect(strangerEdit.status).toBe(403);

    // The owning faculty may edit but may not reassign themselves away
    const ownerEdit = await request(app)
      .put(`/api/courses/${course.body.id}`)
      .set('Authorization', auth(faculty))
      .send({ name: 'Intro to Programming' });
    expect(ownerEdit.status).toBe(200);
    expect(ownerEdit.body.name).toBe('Intro to Programming');

    const reassign = await request(app)
      .put(`/api/courses/${course.body.id}`)
      .set('Authorization', auth(faculty))
      .send({ faculty_id: stranger.id });
    expect(reassign.status).toBe(403);
  });
});

describe('college settings (co-teaching + correction window)', () => {
  it('stores and validates the college policy', async () => {
    const collegeId = await createCollege('Alpha College');
    const admin = await createUser({ role: 'college_admin', collegeId });
    const header = auth(admin);

    const defaults = await request(app).get('/api/academic/settings').set('Authorization', header);
    expect(defaults.status).toBe(200);
    expect(defaults.body).toEqual({ allowCoTeaching: true, attendanceCorrectionWindowDays: 0 });

    const updated = await request(app)
      .put('/api/academic/settings')
      .set('Authorization', header)
      .send({ attendanceCorrectionWindowDays: 30 });
    expect(updated.status).toBe(200);
    expect(updated.body.attendanceCorrectionWindowDays).toBe(30);

    const invalid = await request(app)
      .put('/api/academic/settings')
      .set('Authorization', header)
      .send({ attendanceCorrectionWindowDays: -5 });
    expect(invalid.status).toBe(400);

    const reloaded = await request(app).get('/api/academic/settings').set('Authorization', header);
    expect(reloaded.body.attendanceCorrectionWindowDays).toBe(30);
  });
});
