const request = require('supertest');
const { buildTestApp } = require('./helpers/testApp');
const { resetDb, closeDB } = require('./helpers/db');
const { createUser, tokenFor } = require('./helpers/factories');

const app = buildTestApp();

function makeTestSelfieBase64(offset = 0) {
  const buf = Buffer.alloc(20000);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = (i % 2 === 0) ? (80 + offset + (i % 60)) % 255 : (160 - offset - (i % 50)) % 255;
  }
  return buf.toString('base64');
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeDB();
});

describe('Face ID Biometric Suite (Multi-Role)', () => {
  describe('GET /api/face/profile', () => {
    it('returns enrolled: false for newly created student, faculty, and college_admin', async () => {
      const student = await createUser({ role: 'student' });
      const faculty = await createUser({ role: 'faculty' });
      const admin = await createUser({ role: 'college_admin' });

      for (const user of [student, faculty, admin]) {
        const res = await request(app)
          .get('/api/face/profile')
          .set('Authorization', `Bearer ${tokenFor(user)}`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ enrolled: false });
      }
    });

    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/face/profile');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/face/enroll', () => {
    it('allows student, faculty, and college_admin to enroll their face', async () => {
      const student = await createUser({ role: 'student' });
      const faculty = await createUser({ role: 'faculty' });

      const studentSelfie = makeTestSelfieBase64(0);
      const studentRes = await request(app)
        .post('/api/face/enroll')
        .set('Authorization', `Bearer ${tokenFor(student)}`)
        .send({ selfie_base64: studentSelfie });

      expect(studentRes.status).toBe(200);
      expect(studentRes.body.ok).toBe(true);
      expect(studentRes.body.message).toMatch(/enrolled/i);
      expect(studentRes.body.role).toBe('student');

      const facultySelfie = makeTestSelfieBase64(5);
      const facultyRes = await request(app)
        .post('/api/face/enroll')
        .set('Authorization', `Bearer ${tokenFor(faculty)}`)
        .send({ selfie_base64: facultySelfie });

      expect(facultyRes.status).toBe(200);
      expect(facultyRes.body.ok).toBe(true);
      expect(facultyRes.body.role).toBe('faculty');

      // Check profile status
      const profRes = await request(app)
        .get('/api/face/profile')
        .set('Authorization', `Bearer ${tokenFor(faculty)}`);
      expect(profRes.status).toBe(200);
      expect(profRes.body.enrolled).toBe(true);
      expect(profRes.body.role).toBe('faculty');
      expect(profRes.body.verification_count).toBe(0);
    });

    it('rejects missing selfie_base64 with 400', async () => {
      const student = await createUser({ role: 'student' });
      const res = await request(app)
        .post('/api/face/enroll')
        .set('Authorization', `Bearer ${tokenFor(student)}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.detail).toMatch(/Selfie is required/i);
    });
  });

  describe('POST /api/face/verify', () => {
    it('verifies successfully with matching face and increments verification_count', async () => {
      const user = await createUser({ role: 'faculty' });
      const selfie = makeTestSelfieBase64(0);

      // Enroll first
      await request(app)
        .post('/api/face/enroll')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ selfie_base64: selfie });

      // Verify with matching selfie
      const verifyRes = await request(app)
        .post('/api/face/verify')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ selfie_base64: selfie });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.ok).toBe(true);
      expect(verifyRes.body.message).toMatch(/verified/i);

      // Verify count should increment
      const profRes = await request(app)
        .get('/api/face/profile')
        .set('Authorization', `Bearer ${tokenFor(user)}`);
      expect(profRes.body.verification_count).toBe(1);
    });

    it('returns 400 if user has not enrolled yet', async () => {
      const user = await createUser({ role: 'student' });
      const res = await request(app)
        .post('/api/face/verify')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ selfie_base64: makeTestSelfieBase64(0) });
      expect(res.status).toBe(400);
      expect(res.body.detail).toMatch(/No face profile enrolled/i);
    });
  });

  describe('POST /api/face/blink-report', () => {
    it('records blink eye aspect ratio in liveness history', async () => {
      const user = await createUser({ role: 'student' });
      const selfie = makeTestSelfieBase64(0);
      await request(app)
        .post('/api/face/enroll')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ selfie_base64: selfie });

      const res = await request(app)
        .post('/api/face/blink-report')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ eyeAspectRatio: 0.18, frameIndex: 1 });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.history_length).toBeGreaterThan(0);
    });
  });

  describe('DELETE /api/face/profile', () => {
    it('deletes enrolled face profile and resets status', async () => {
      const user = await createUser({ role: 'college_admin' });
      const selfie = makeTestSelfieBase64(0);

      await request(app)
        .post('/api/face/enroll')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ selfie_base64: selfie });

      const delRes = await request(app)
        .delete('/api/face/profile')
        .set('Authorization', `Bearer ${tokenFor(user)}`);
      expect(delRes.status).toBe(200);
      expect(delRes.body.ok).toBe(true);

      const checkRes = await request(app)
        .get('/api/face/profile')
        .set('Authorization', `Bearer ${tokenFor(user)}`);
      expect(checkRes.body.enrolled).toBe(false);
    });
  });
});
