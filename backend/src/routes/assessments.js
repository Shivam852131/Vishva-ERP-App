const express = require('express');
const { getDB, oid } = require('../db');
const { sendError, nowIso, roomForUser } = require('../utils');
const { ensureCareerSeed, QUESTION_BANK, SKILL_BY_KEY } = require('../careerData');
const { applyAssessmentResult } = require('../skillProfile');

// Grace window so a slow network round-trip on submit doesn't fail a student
// who answered inside the limit.
const SUBMIT_GRACE_SECONDS = 20;

function serializeAssessment(doc, extra = {}) {
  return {
    id: String(doc._id),
    key: doc.key,
    title: doc.title,
    description: doc.description,
    skill_key: doc.skillKey,
    skill_name: doc.skillName || SKILL_BY_KEY.get(doc.skillKey)?.name || doc.skillKey,
    category: doc.category,
    duration_minutes: doc.durationMinutes,
    total_questions: doc.totalQuestions,
    pass_score: doc.passScore,
    difficulty: doc.difficulty,
    attempts: doc.attempts || 0,
    ...extra,
  };
}

// Deterministic per-attempt shuffle: the same attempt always renders the same
// question order across refreshes, but two students get different orders.
function seededShuffle(items, seed) {
  const arr = [...items];
  let state = 0;
  for (let i = 0; i < seed.length; i++) state = (state * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    state = (state * 1103515245 + 12345) >>> 0;
    const j = state % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createAssessmentsRouter(io) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const db = getDB();
    await ensureCareerSeed(db);

    const filter = { isActive: { $ne: false } };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.skillKey) filter.skillKey = req.query.skillKey;
    if (req.query.difficulty) filter.difficulty = req.query.difficulty;

    const assessments = await db.collection('assessments').find(filter).sort({ category: 1, title: 1 }).toArray();

    const myAttempts = await db.collection('assessment_attempts')
      .find({ studentId: oid(req.user._id), status: 'submitted' })
      .sort({ submittedAt: -1 })
      .toArray();

    const bestByAssessment = new Map();
    for (const attempt of myAttempts) {
      const key = String(attempt.assessmentId);
      const prev = bestByAssessment.get(key);
      if (!prev || attempt.scorePercent > prev.scorePercent) bestByAssessment.set(key, attempt);
    }

    const inProgress = await db.collection('assessment_attempts')
      .find({ studentId: oid(req.user._id), status: 'in_progress' })
      .toArray();
    const inProgressMap = new Map(inProgress.map(a => [String(a.assessmentId), a]));

    res.json(assessments.map(a => {
      const best = bestByAssessment.get(String(a._id));
      const active = inProgressMap.get(String(a._id));
      return serializeAssessment(a, {
        my_attempts: myAttempts.filter(m => String(m.assessmentId) === String(a._id)).length,
        best_score: best ? best.scorePercent : null,
        passed: best ? best.passed : false,
        in_progress_attempt_id: active ? String(active._id) : null,
      });
    }));
  });

  router.get('/history', async (req, res) => {
    const db = getDB();
    const attempts = await db.collection('assessment_attempts')
      .find({ studentId: oid(req.user._id), status: 'submitted' })
      .sort({ submittedAt: -1 })
      .limit(50)
      .toArray();

    res.json(attempts.map(a => ({
      id: String(a._id),
      assessment_id: String(a.assessmentId),
      assessment_title: a.assessmentTitle,
      skill_key: a.skillKey,
      score_percent: a.scorePercent,
      correct: a.correctCount,
      total: a.totalQuestions,
      passed: a.passed,
      time_taken_seconds: a.timeTakenSeconds,
      submitted_at: a.submittedAt,
    })));
  });

  router.get('/leaderboard', async (req, res) => {
    const db = getDB();
    const filter = { status: 'submitted' };
    if (req.query.assessmentId) filter.assessmentId = oid(req.query.assessmentId);

    const rows = await db.collection('assessment_attempts').aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$studentId',
          studentName: { $first: '$studentName' },
          bestScore: { $max: '$scorePercent' },
          attempts: { $sum: 1 },
          passed: { $sum: { $cond: ['$passed', 1, 0] } },
          avgScore: { $avg: '$scorePercent' },
        },
      },
      { $sort: { bestScore: -1, passed: -1, attempts: 1 } },
      { $limit: 25 },
    ]).toArray();

    res.json(rows.map((r, i) => ({
      rank: i + 1,
      student_id: String(r._id),
      student_name: r.studentName,
      best_score: r.bestScore,
      average_score: Math.round(r.avgScore),
      attempts: r.attempts,
      passed: r.passed,
      is_me: String(r._id) === String(req.user._id),
    })));
  });

  // ── Attempts ───────────────────────────────────────────────────────────────
  router.post('/:id/start', async (req, res) => {
    const db = getDB();
    await ensureCareerSeed(db);

    const assessment = await db.collection('assessments').findOne({ _id: oid(req.params.id) });
    if (!assessment) return sendError(res, 'Assessment not found.', 404);

    const existing = await db.collection('assessment_attempts').findOne({
      assessmentId: assessment._id,
      studentId: oid(req.user._id),
      status: 'in_progress',
    });
    if (existing) {
      const expired = Date.now() > new Date(existing.expiresAt).getTime();
      if (!expired) {
        return res.json(buildAttemptPayload(assessment, existing));
      }
      await db.collection('assessment_attempts').updateOne(
        { _id: existing._id },
        { $set: { status: 'expired' } },
      );
    }

    const bank = QUESTION_BANK[assessment.skillKey] || [];
    if (!bank.length) return sendError(res, 'This assessment has no questions configured.', 500);

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + assessment.durationMinutes * 60000);

    const doc = {
      assessmentId: assessment._id,
      assessmentTitle: assessment.title,
      skillKey: assessment.skillKey,
      studentId: oid(req.user._id),
      studentName: req.user.name,
      status: 'in_progress',
      answers: {},
      totalQuestions: Math.min(assessment.totalQuestions, bank.length),
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const { insertedId } = await db.collection('assessment_attempts').insertOne(doc);
    await db.collection('assessments').updateOne({ _id: assessment._id }, { $inc: { attempts: 1 } });

    res.status(201).json(buildAttemptPayload(assessment, { ...doc, _id: insertedId }));
  });

  // Questions are served without the answer key; grading happens server-side only.
  function buildAttemptPayload(assessment, attempt) {
    const bank = QUESTION_BANK[assessment.skillKey] || [];
    const selected = seededShuffle(bank, String(attempt._id)).slice(0, attempt.totalQuestions);

    return {
      attempt_id: String(attempt._id),
      assessment: serializeAssessment(assessment),
      started_at: attempt.startedAt,
      expires_at: attempt.expiresAt,
      seconds_remaining: Math.max(0, Math.round((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000)),
      answers: attempt.answers || {},
      questions: selected.map((q, i) => ({
        index: i,
        question: q.q,
        options: q.options,
        difficulty: q.difficulty,
      })),
    };
  }

  router.get('/attempts/:attemptId', async (req, res) => {
    const db = getDB();
    const attempt = await db.collection('assessment_attempts').findOne({
      _id: oid(req.params.attemptId),
      studentId: oid(req.user._id),
    });
    if (!attempt) return sendError(res, 'Attempt not found.', 404);

    const assessment = await db.collection('assessments').findOne({ _id: attempt.assessmentId });
    if (!assessment) return sendError(res, 'Assessment not found.', 404);

    if (attempt.status === 'submitted') {
      return res.json(buildResultPayload(assessment, attempt));
    }
    res.json(buildAttemptPayload(assessment, attempt));
  });

  router.post('/attempts/:attemptId/answer', async (req, res) => {
    const db = getDB();
    const attempt = await db.collection('assessment_attempts').findOne({
      _id: oid(req.params.attemptId),
      studentId: oid(req.user._id),
    });
    if (!attempt) return sendError(res, 'Attempt not found.', 404);
    if (attempt.status !== 'in_progress') return sendError(res, 'This attempt is already closed.', 409);
    if (Date.now() > new Date(attempt.expiresAt).getTime() + SUBMIT_GRACE_SECONDS * 1000) {
      return sendError(res, 'Time is up for this attempt.', 409);
    }

    const index = Number(req.body?.index);
    const optionIndex = Number(req.body?.optionIndex);
    if (!Number.isInteger(index) || index < 0 || index >= attempt.totalQuestions) {
      return sendError(res, 'Invalid question index.', 400);
    }
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 5) {
      return sendError(res, 'Invalid option index.', 400);
    }

    await db.collection('assessment_attempts').updateOne(
      { _id: attempt._id },
      { $set: { [`answers.${index}`]: optionIndex } },
    );
    res.json({ success: true, index, optionIndex });
  });

  function buildResultPayload(assessment, attempt) {
    const bank = QUESTION_BANK[assessment.skillKey] || [];
    const selected = seededShuffle(bank, String(attempt._id)).slice(0, attempt.totalQuestions);

    return {
      attempt_id: String(attempt._id),
      assessment: serializeAssessment(assessment),
      score_percent: attempt.scorePercent,
      correct: attempt.correctCount,
      total: attempt.totalQuestions,
      passed: attempt.passed,
      time_taken_seconds: attempt.timeTakenSeconds,
      submitted_at: attempt.submittedAt,
      certificate_id: attempt.certificateId || null,
      breakdown: selected.map((q, i) => ({
        index: i,
        question: q.q,
        options: q.options,
        difficulty: q.difficulty,
        correct_index: q.answer,
        selected_index: attempt.answers?.[i] ?? attempt.answers?.[String(i)] ?? null,
        correct: (attempt.answers?.[i] ?? attempt.answers?.[String(i)]) === q.answer,
      })),
      by_difficulty: ['easy', 'medium', 'hard'].map(level => {
        const subset = selected
          .map((q, i) => ({ q, i }))
          .filter(({ q }) => q.difficulty === level);
        const correct = subset.filter(({ q, i }) => (attempt.answers?.[i] ?? attempt.answers?.[String(i)]) === q.answer).length;
        return {
          difficulty: level,
          total: subset.length,
          correct,
          percent: subset.length ? Math.round((correct / subset.length) * 100) : 0,
        };
      }).filter(d => d.total > 0),
    };
  }

  router.post('/attempts/:attemptId/submit', async (req, res) => {
    const db = getDB();
    const attempt = await db.collection('assessment_attempts').findOne({
      _id: oid(req.params.attemptId),
      studentId: oid(req.user._id),
    });
    if (!attempt) return sendError(res, 'Attempt not found.', 404);
    if (attempt.status === 'submitted') {
      const assessment = await db.collection('assessments').findOne({ _id: attempt.assessmentId });
      return res.json(buildResultPayload(assessment, attempt));
    }

    const assessment = await db.collection('assessments').findOne({ _id: attempt.assessmentId });
    if (!assessment) return sendError(res, 'Assessment not found.', 404);

    // Merge any answers sent with the submit call (covers an auto-submit at
    // timeout where the last selection never round-tripped).
    const answers = { ...(attempt.answers || {}) };
    if (req.body?.answers && typeof req.body.answers === 'object') {
      for (const [key, value] of Object.entries(req.body.answers)) {
        const index = Number(key);
        const option = Number(value);
        if (Number.isInteger(index) && index >= 0 && index < attempt.totalQuestions && Number.isInteger(option)) {
          answers[index] = option;
        }
      }
    }

    const bank = QUESTION_BANK[assessment.skillKey] || [];
    const selected = seededShuffle(bank, String(attempt._id)).slice(0, attempt.totalQuestions);

    const correctCount = selected.filter((q, i) => (answers[i] ?? answers[String(i)]) === q.answer).length;
    const scorePercent = selected.length ? Math.round((correctCount / selected.length) * 100) : 0;
    const passed = scorePercent >= assessment.passScore;
    const submittedAt = nowIso();
    const timeTakenSeconds = Math.max(
      0,
      Math.round((new Date(submittedAt).getTime() - new Date(attempt.startedAt).getTime()) / 1000),
    );

    let certificateId = null;
    if (passed) {
      const cert = {
        studentId: oid(req.user._id),
        title: `${assessment.title} — Verified`,
        issuer: 'Vishva Skill Assessments',
        skillKey: assessment.skillKey,
        credentialId: `VSA-${String(attempt._id).slice(-8).toUpperCase()}`,
        credentialUrl: null,
        issuedAt: submittedAt,
        expiresAt: null,
        source: 'assessment',
        attemptId: attempt._id,
        scorePercent,
        createdAt: submittedAt,
      };
      const existingCert = await db.collection('student_certifications').findOne({ attemptId: attempt._id });
      if (existingCert) {
        certificateId = String(existingCert._id);
      } else {
        const { insertedId } = await db.collection('student_certifications').insertOne(cert);
        certificateId = String(insertedId);
      }
    }

    await db.collection('assessment_attempts').updateOne(
      { _id: attempt._id },
      {
        $set: {
          status: 'submitted',
          answers,
          correctCount,
          scorePercent,
          passed,
          submittedAt,
          timeTakenSeconds,
          certificateId,
        },
      },
    );

    const updatedSkill = await applyAssessmentResult(req.user._id, assessment.skillKey, scorePercent);

    io.to(roomForUser(req.user._id)).emit('assessment:submitted', {
      assessment_id: String(assessment._id),
      score_percent: scorePercent,
      passed,
      skill: updatedSkill,
    });

    if (updatedSkill) {
      io.to(roomForUser(req.user._id)).emit('skills:updated', {
        skillKey: assessment.skillKey,
        skill: updatedSkill,
      });
    }

    const final = await db.collection('assessment_attempts').findOne({ _id: attempt._id });
    res.json({ ...buildResultPayload(assessment, final), skill: updatedSkill });
  });

  router.post('/attempts/:attemptId/abandon', async (req, res) => {
    const db = getDB();
    const result = await db.collection('assessment_attempts').updateOne(
      { _id: oid(req.params.attemptId), studentId: oid(req.user._id), status: 'in_progress' },
      { $set: { status: 'abandoned', abandonedAt: nowIso() } },
    );
    if (!result.matchedCount) return sendError(res, 'Attempt not found.', 404);
    res.json({ success: true });
  });

  return router;
}

module.exports = { createAssessmentsRouter };
