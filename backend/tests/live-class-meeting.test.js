const request = require('supertest');
const { buildTestApp } = require('./helpers/testApp');
const { prisma, resetDb, getDB } = require('./helpers/db');
const { createUser, tokenFor } = require('./helpers/factories');
const { inAppRoomForSession, jitsiRoomUrl } = require('../src/services/jitsi');

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

async function createSession(header, overrides = {}) {
  const res = await request(app)
    .post('/api/live-classes')
    .set('Authorization', header)
    .send({
      title: 'Data Structures',
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      durationMinutes: 60,
      createMeetLink: false,
      ...overrides,
    });
  if (res.status !== 201) {
    throw new Error(`session create failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

function getMeeting(id, header) {
  return request(app).get(`/api/live-classes/${id}/meeting`).set('Authorization', header);
}

describe('in-app meeting endpoint (teacher start / student join)', () => {
  it('returns a stable, embeddable Jitsi room plus the caller identity for the host', async () => {
    const faculty = await createUser({ role: 'faculty', name: 'Dr. Rao' });
    const header = auth(faculty);
    const session = await createSession(header);

    const first = await getMeeting(session.id, header);
    expect(first.status).toBe(200);
    expect(first.body.room_url).toMatch(/^https:\/\/meet\.jit\.si\/vishva-erp-/);
    expect(first.body.is_host).toBe(true);
    expect(first.body.display_name).toBe('Dr. Rao');
    expect(first.body.role).toBe('faculty');
    expect(first.body.status).toBe('scheduled');
    // No stored meeting link yet → provider is null, not a fake one.
    expect(first.body.meeting_provider).toBeNull();
    // Public meet.jit.si needs no JWT, and no signing secret ships to the app.
    expect(first.body.token).toBeNull();

    // The room is deterministic: the same session yields the same room on
    // every call (teacher and students land in one conference), and it is the
    // room derived from the session id.
    const second = await getMeeting(session.id, header);
    expect(second.body.room_url).toBe(first.body.room_url);
    expect(first.body.room_url).toBe(inAppRoomForSession({ _id: session.id }));
    expect(first.body.room_url).toBe(jitsiRoomUrl(`live_class-${session.id}`));
  });

  it('lets a student in the same college join, but never marks them the host', async () => {
    const faculty = await createUser({ role: 'faculty', name: 'Dr. Rao' });
    const student = await createUser({ role: 'student', name: 'Asha' });
    const header = auth(faculty);
    const session = await createSession(header);

    const res = await getMeeting(session.id, auth(student));
    expect(res.status).toBe(200);
    expect(res.body.is_host).toBe(false);
    expect(res.body.display_name).toBe('Asha');
    expect(res.body.role).toBe('student');
    // Student and teacher get the identical room.
    const hostView = await getMeeting(session.id, header);
    expect(res.body.room_url).toBe(hostView.body.room_url);
  });

  it('reuses an existing Jitsi meeting URL verbatim', async () => {
    const faculty = await createUser({ role: 'faculty' });
    const header = auth(faculty);
    const session = await createSession(header);

    const jitsiUrl = 'https://meet.jit.si/custom-shared-room-42';
    const patch = await request(app)
      .patch(`/api/live-classes/${session.id}`)
      .set('Authorization', header)
      .send({ meetingUrl: jitsiUrl });
    expect(patch.status).toBe(200);

    const res = await getMeeting(session.id, header);
    expect(res.status).toBe(200);
    expect(res.body.room_url).toBe(jitsiUrl);
    expect(res.body.meeting_url).toBe(jitsiUrl);
    expect(res.body.meeting_provider).toBe('jitsi');
  });

  it('still provides an embeddable Jitsi room when the stored link is Google Meet', async () => {
    const faculty = await createUser({ role: 'faculty' });
    const header = auth(faculty);
    const session = await createSession(header);

    const googleUrl = 'https://meet.google.com/abc-defg-hij';
    await request(app)
      .patch(`/api/live-classes/${session.id}`)
      .set('Authorization', header)
      .send({ meetingUrl: googleUrl });

    const res = await getMeeting(session.id, header);
    expect(res.status).toBe(200);
    // Google Meet can never be embedded, so it is reported as such…
    expect(res.body.meeting_provider).toBe('google');
    expect(res.body.meeting_url).toBe(googleUrl);
    // …while the in-app flow gets a Jitsi room that IS embeddable.
    expect(res.body.room_url).toMatch(/^https:\/\/meet\.jit\.si\//);
    expect(res.body.room_url).not.toBe(googleUrl);
  });

  it('never leaks meeting details across colleges (tenant isolation)', async () => {
    const collegeA = await createCollege('Alpha College');
    const collegeB = await createCollege('Beta College');
    const facultyA = await createUser({ role: 'faculty', collegeId: collegeA });
    const studentB = await createUser({ role: 'student', collegeId: collegeB });
    const session = await createSession(auth(facultyA));

    const outsider = await getMeeting(session.id, auth(studentB));
    expect(outsider.status).toBe(404);

    // An unknown id is a plain 404 too, not a different error shape.
    const missing = await getMeeting('ffffffffffffffffffffffff', auth(facultyA));
    expect(missing.status).toBe(404);
  });

  it('requires authentication', async () => {
    const faculty = await createUser({ role: 'faculty' });
    const session = await createSession(auth(faculty));

    const anon = await request(app).get(`/api/live-classes/${session.id}/meeting`);
    expect(anon.status).toBe(401);
  });
});
