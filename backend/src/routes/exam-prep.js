/**
 * exam-prep.js — All-in-One MCQ & Exam Preparation System
 *
 * Question Bank (per-college MongoDB store):
 *   GET    /exam-prep/questions          — list with filters (all auth; students never see answers)
 *   GET    /exam-prep/questions/stats    — subject/difficulty breakdown
 *   POST   /exam-prep/questions          — create question (faculty+)
 *   PATCH  /exam-prep/questions/:id      — edit question (faculty+)
 *   DELETE /exam-prep/questions/:id      — delete question (faculty+)
 *   POST   /exam-prep/questions/bulk     — JSON-array bulk import (faculty+, max 500)
 *                                           returns { inserted, skipped, errors:[{row,reason}] }
 *   POST   /exam-prep/questions/upload   — multipart file import (faculty+, 10 MB max)
 *                                           .xlsx → exceljs, .csv → RFC4180 parser,
 *                                           .pdf  → text extraction → LLM extraction
 *                                           returns { inserted, skipped, errors, sheets,
 *                                                     unused_sheets, truncated }
 *
 * AI Question Generation:
 *   POST   /exam-prep/generate-ai        — AI → MCQ questions (faculty+, count clamped to 1-20)
 *   POST   /exam-prep/extract-image      — ocr_text → questions (faculty+)
 *
 * Quiz Builder & Scheduling:
 *   POST   /exam-prep/quizzes            — create quiz from question bank (faculty+)
 *   GET    /exam-prep/quizzes            — list quizzes (faculty+ sees all, student sees published)
 *   GET    /exam-prep/quizzes/:id        — quiz details (students: published only)
 *   PATCH  /exam-prep/quizzes/:id        — edit quiz (faculty+)
 *   DELETE /exam-prep/quizzes/:id        — delete quiz (faculty+)
 *   POST   /exam-prep/quizzes/:id/schedule — set window (faculty+, validates end > start)
 *   GET    /exam-prep/quizzes/:id/analytics — stats, distribution, leaderboard, attempts (faculty+)
 *
 * Student Practice:
 *   GET    /exam-prep/dashboard          — personalised dashboard (student)
 *   POST   /exam-prep/practice/start     — start untimed practice session (student)
 *   POST   /exam-prep/practice/:sid/answer — record answer + get explanation (student)
 *   POST   /exam-prep/practice/:sid/submit — finish session, get report (student)
 *
 * Student Quiz Attempts (against faculty-created quizzes, separate from skill assessments):
 *   POST   /exam-prep/quizzes/:id/start  — start timed quiz attempt (student)
 *   POST   /exam-prep/attempts/:aid/answer — autosave answer (student)
 *   POST   /exam-prep/attempts/:aid/submit — server-side score + explanations (student)
 *   GET    /exam-prep/attempts/:aid      — resume in-progress attempt, or frozen result
 *   GET    /exam-prep/attempts/:aid/result — result breakdown (student)
 *   GET    /exam-prep/my-attempts        — history incl. expired (student)
 *
 * Bookmarks:
 *   GET    /exam-prep/bookmarks          — bookmarked questions (students: answers hidden)
 *   POST   /exam-prep/bookmarks          — add bookmark
 *   DELETE /exam-prep/bookmarks/:qid     — remove bookmark
 *
 * Recommendations:
 *   GET    /exam-prep/recommendations    — AI-personalized suggestions (student)
 *
 * Invariants enforced here — keep these true when editing:
 *   - Scoring is server-only. No client-supplied correctness/score field is ever read.
 *   - The answer index is bounds-checked against the option list on every write path.
 *   - attempts.expiresAt is enforced on autosave AND on submit; past the grace
 *     window only autosaved answers count and the attempt is marked 'expired'.
 *   - An expired attempt is graded once and can never be upgraded to 'submitted'.
 *   - Expired attempts consume one of the quiz's maxAttempts.
 *   - Students never receive an answer key outside a graded result payload.
 *   - Shuffles are seeded per attempt and resolved through
 *     resolveQuestionForAttempt(), so scoring always matches what was shown.
 */

const express = require('express');
const { getDB, oid } = require('../db');
const { sendError, nowIso, roomForUser } = require('../utils');
const { collegeFilter } = require('../auth');
const multer = require('multer');
const { generateAIResponse } = require('../ml/llmService');
const {
  MAX_ROWS,
  parseCsvQuestions,
  parseXlsxQuestions,
  extractPdfText,
  clampQuestionCells,
} = require('../importQuestions');

// File uploads arrive as memory buffers — no disk staging, and a hard
// ceiling so an uploaded file cannot exhaust the process.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

// Grace window for late submits
const SUBMIT_GRACE_SECONDS = 30;

// Upper bound on the option index a client may store in an answer slot.
const MAX_OPTION_INDEX = 9;

// Allowed education levels, from school through competitive exams.
const EDUCATION_LEVELS = ['school', 'college', 'competitive'];

// Escape user input before it is used in a $regex (prevents ReDoS / injection).
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Clamp a client-supplied education level, defaulting to 'college'.
function normalizeEducationLevel(value) {
  const level = String(value || '').trim().toLowerCase();
  return EDUCATION_LEVELS.includes(level) ? level : 'college';
}

/**
 * Normalise a raw MCQ payload into the stored question shape.
 * Shared by manual create, bulk import and AI generation so every write
 * path enforces the same rules.
 *
 * Returns { ok: true, doc } or { ok: false, error, row }.
 */
function buildQuestionDoc(raw, context = {}) {
  const {
    collegeId = null,
    createdById = null,
    createdByName = '',
    source = 'manual',
    subjectFallback = '',
    educationLevelFallback = 'college',
    row = null,
  } = context;

  const question = String(raw?.question ?? raw?.q ?? '').trim();
  if (!question) return { ok: false, error: 'question is required', row };

  const options = (Array.isArray(raw?.options) ? raw.options : [])
    .map(o => String(o ?? '').trim())
    .filter(o => o.length > 0);
  if (options.length < 2) return { ok: false, error: 'at least 2 options are required', row };
  if (options.length > MAX_OPTION_INDEX + 1) {
    return { ok: false, error: `too many options (max ${MAX_OPTION_INDEX + 1})`, row };
  }

  // Reject duplicate option text — it makes the answer ambiguous and unscorable.
  if (new Set(options).size !== options.length) {
    return { ok: false, error: 'options must be unique', row };
  }

  const answerRaw = raw?.answer ?? raw?.correct;
  const answer = Number(answerRaw);
  if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) {
    return {
      ok: false,
      error: `answer must be an integer between 0 and ${options.length - 1}`,
      row,
    };
  }

  return {
    ok: true,
    doc: {
      collegeId,
      subject: String(raw?.subject || subjectFallback || '').trim(),
      topic: String(raw?.topic || '').trim(),
      subtopic: String(raw?.subtopic || '').trim(),
      question,
      options,
      answer,
      difficulty: ['easy', 'medium', 'hard'].includes(raw?.difficulty) ? raw.difficulty : 'medium',
      educationLevel: normalizeEducationLevel(raw?.education_level ?? raw?.educationLevel ?? educationLevelFallback),
      explanation: String(raw?.explanation || '').trim(),
      tags: Array.isArray(raw?.tags) ? raw.tags.map(String) : [],
      imageUrl: raw?.image_url || raw?.imageUrl || null,
      source,
      createdById,
      createdByName,
      createdAt: nowIso(),
    },
  };
}

const QUIZ_STATUSES = ['draft', 'published', 'closed'];

/**
 * Validate and normalise the schedulable fields of a quiz patch.
 * Returns { ok: true, updates } or { ok: false, error }.
 */
function buildQuizScheduleUpdates(body, existing = {}) {
  const updates = {};

  if (body.status !== undefined) {
    const status = String(body.status).trim().toLowerCase();
    if (!QUIZ_STATUSES.includes(status)) {
      return { ok: false, error: `status must be one of: ${QUIZ_STATUSES.join(', ')}` };
    }
    updates.status = status;
  }

  if (body.duration_minutes !== undefined) {
    const minutes = Number(body.duration_minutes);
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 600) {
      return { ok: false, error: 'duration_minutes must be between 1 and 600' };
    }
    updates.durationMinutes = Math.round(minutes);
  }

  if (body.pass_score !== undefined) {
    const pass = Number(body.pass_score);
    if (!Number.isFinite(pass) || pass < 0 || pass > 100) {
      return { ok: false, error: 'pass_score must be between 0 and 100' };
    }
    updates.passScore = pass;
  }

  if (body.max_attempts !== undefined) {
    updates.maxAttempts = body.max_attempts ? Number(body.max_attempts) : null;
  }

  const windowStart = body.window_start !== undefined ? body.window_start : existing.windowStart;
  const windowEnd = body.window_end !== undefined ? body.window_end : existing.windowEnd;
  if (body.window_start !== undefined) updates.windowStart = body.window_start;
  if (body.window_end !== undefined) updates.windowEnd = body.window_end;

  if (windowStart && windowEnd) {
    const start = new Date(windowStart).getTime();
    const end = new Date(windowEnd).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) {
      return { ok: false, error: 'window_start and window_end must be valid ISO dates' };
    }
    if (end <= start) {
      return { ok: false, error: 'window_end must be after window_start' };
    }
  }

  return { ok: true, updates };
}

/**
 * Pull MCQ JSON objects out of an LLM response and validate each one.
 * Models routinely wrap JSON in prose, so we scan for object literals and
 * silently drop anything that fails validation instead of throwing.
 */
function parseAiQuestions(text, context = {}) {
  const jsonLines = String(text || '').match(/\{[^{}]+\}/g) || [];
  const out = [];
  const seen = new Set();
  for (const line of jsonLines) {
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    const built = buildQuestionDoc(obj, context);
    if (!built.ok) continue;
    // Drop exact duplicates — models often repeat themselves.
    const key = built.doc.question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(built.doc);
  }
  return out;
}

/** API-facing shape for AI-generated questions (no persistence fields). */
function toAiQuestion(doc, { subject = '', educationLevel = 'college' } = {}) {
  return {
    question: doc.question,
    options: doc.options,
    answer: doc.answer,
    explanation: doc.explanation,
    difficulty: doc.difficulty,
    subject: subject || doc.subject || '',
    education_level: educationLevel || doc.educationLevel,
  };
}

/**
 * Fetch a quiz's questions and return them in the exact order the student
 * saw them. Shuffling over a `$in` fetch is only reproducible if the input
 * order is stable, so we always re-align to quiz.questionIds first.
 */
async function orderQuestionsForAttempt(db, quiz, attempt) {
  const fetched = await db.collection('exam_prep_questions')
    .find({ _id: { $in: quiz.questionIds } })
    .toArray();

  const position = new Map(quiz.questionIds.map((id, i) => [String(id), i]));
  const ordered = fetched
    .slice()
    .sort((a, b) => (position.get(String(a._id)) ?? 0) - (position.get(String(b._id)) ?? 0));

  return quiz.shuffleQuestions ? seededShuffle(ordered, String(attempt._id)) : ordered;
}

// ─── Role helpers ─────────────────────────────────────────────────
function isFacultyOrAbove(req) {
  const r = req.user?.role;
  return r === 'faculty' || r === 'college_admin' || r === 'super_admin' ||
    r === 'collegeAdmin' || r === 'superadmin';
}

// Student-only endpoints are owner-scoped by studentId, but that is not a
// substitute for an explicit role check: without it a faculty token could
// address these routes at all.
function isStudent(req) {
  return req.user?.role === 'student';
}

function requireStudent(req, res) {
  if (!isStudent(req)) {
    sendError(res, 'Permission denied.', 403);
    return false;
  }
  return true;
}

/**
 * Combine query fragments that may each carry their own `$or`.
 * Object spread silently overwrites duplicate keys, and collegeFilter()
 * returns an `$or`, so `{...a, ...collegeFilter(req)}` drops `a`'s `$or`.
 */
function andFilters(...parts) {
  const clauses = parts.filter(p => p && Object.keys(p).length > 0);
  if (!clauses.length) return {};
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
}

// ─── Serialisers ──────────────────────────────────────────────────
function serializeQuestion(q, { hideAnswer = true } = {}) {
  const base = {
    id: String(q._id),
    college_id: q.collegeId ? String(q.collegeId) : null,
    subject: q.subject || '',
    topic: q.topic || '',
    subtopic: q.subtopic || '',
    question: q.question,
    options: q.options || [],
    difficulty: q.difficulty || 'medium',
    education_level: q.educationLevel || 'college',
    explanation: q.explanation || '',
    tags: q.tags || [],
    source: q.source || 'manual',
    created_by_name: q.createdByName || '',
    created_at: q.createdAt,
    image_url: q.imageUrl || null,
  };
  if (!hideAnswer) base.answer = q.answer;
  return base;
}

function serializeQuiz(q) {
  return {
    id: String(q._id),
    title: q.title,
    description: q.description || '',
    subject: q.subject || '',
    topic: q.topic || '',
    education_level: q.educationLevel || 'college',
    difficulty: q.difficulty || 'mixed',
    total_questions: q.totalQuestions || 0,
    duration_minutes: q.durationMinutes || 30,
    pass_score: q.passScore || 60,
    max_attempts: q.maxAttempts || null,
    is_practice: q.isPractice || false,
    shuffle_questions: q.shuffleQuestions !== false,
    shuffle_options: q.shuffleOptions !== false,
    status: q.status || 'draft',
    window_start: q.windowStart || null,
    window_end: q.windowEnd || null,
    created_by_name: q.createdByName || '',
    created_at: q.createdAt,
    attempt_count: q.attemptCount || 0,
    question_ids: (q.questionIds || []).map(String),
  };
}

// ─── Seeded shuffle (deterministic per attempt) ───────────────────
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

// ─── Router factory ───────────────────────────────────────────────
function createExamPrepRouter(io) {
  const router = express.Router();

  // ════════════════════════════════════════════════════════════════
  // QUESTION BANK
  // ════════════════════════════════════════════════════════════════

  // GET /exam-prep/questions/stats  — MUST come before /:id routes
  router.get('/questions/stats', async (req, res) => {
    const db = getDB();
    const filter = { ...collegeFilter(req) };

    const [bySubject, byDifficulty, bySource, total] = await Promise.all([
      db.collection('exam_prep_questions').aggregate([
        { $match: filter },
        { $group: { _id: '$subject', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).toArray(),
      db.collection('exam_prep_questions').aggregate([
        { $match: filter },
        { $group: { _id: '$difficulty', count: { $sum: 1 } } },
      ]).toArray(),
      db.collection('exam_prep_questions').aggregate([
        { $match: filter },
        { $group: { _id: '$source', count: { $sum: 1 } } },
      ]).toArray(),
      db.collection('exam_prep_questions').countDocuments(filter),
    ]);

    res.json({ total, by_subject: bySubject, by_difficulty: byDifficulty, by_source: bySource });
  });

  // GET /exam-prep/questions
  router.get('/questions', async (req, res) => {
    const db = getDB();
    const filter = { ...collegeFilter(req) };
    const { subject, topic, difficulty, education_level, search, limit = '50', skip = '0' } = req.query;

    if (subject) filter.subject = subject;
    if (topic) filter.topic = topic;
    if (difficulty) filter.difficulty = difficulty;
    if (education_level) filter.educationLevel = normalizeEducationLevel(education_level);
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: 'i' };
      filter.$or = [{ question: rx }, { topic: rx }, { tags: rx }];
    }

    const hideAnswer = req.user.role === 'student';
    const take = Math.min(parseInt(limit, 10) || 50, 200);
    const offset = Math.max(parseInt(skip, 10) || 0, 0);
    const questions = await db.collection('exam_prep_questions')
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(take)
      .toArray();

    const total = await db.collection('exam_prep_questions').countDocuments(filter);
    res.set('X-Total-Count', String(total));
    res.json(questions.map(q => serializeQuestion(q, { hideAnswer })));
  });

  // POST /exam-prep/questions
  router.post('/questions', async (req, res) => {
    if (!isFacultyOrAbove(req)) return sendError(res, 'Permission denied.', 403);
    const db = getDB();
    const body = req.body || {};

    const built = buildQuestionDoc(body, {
      collegeId: oid(req.userCollegeId),
      createdById: oid(req.user._id),
      createdByName: req.user.name,
      source: body.source || 'manual',
    });
    if (!built.ok) return sendError(res, built.error, 400);

    const doc = built.doc;
    const { insertedId } = await db.collection('exam_prep_questions').insertOne(doc);
    res.status(201).json(serializeQuestion({ ...doc, _id: insertedId }, { hideAnswer: false }));
  });

  // POST /exam-prep/questions/bulk — JSON array of question objects
  router.post('/questions/bulk', async (req, res) => {
    if (!isFacultyOrAbove(req)) return sendError(res, 'Permission denied.', 403);
    const db = getDB();
    const { questions, subject, education_level } = req.body || {};

    if (!Array.isArray(questions) || !questions.length) {
      return sendError(res, 'questions array is required.', 400);
    }
    if (questions.length > 500) {
      return sendError(res, 'Bulk import is limited to 500 questions per request.', 400);
    }

    const docs = [];
    const errors = [];
    questions.forEach((q, i) => {
      const built = buildQuestionDoc(q, {
        collegeId: oid(req.userCollegeId),
        createdById: oid(req.user._id),
        createdByName: req.user.name,
        source: 'import',
        subjectFallback: subject,
        educationLevelFallback: education_level,
        row: i + 1,
      });
      if (built.ok) docs.push(built.doc);
      else errors.push({ row: built.row, reason: built.error, question: String(q?.question || q?.q || '').slice(0, 80) });
    });

    if (!docs.length) {
      return sendError(res, `No valid questions found in the import (${errors.length} row(s) rejected).`, 400);
    }

    const { insertedCount } = await db.collection('exam_prep_questions').insertMany(docs);
    res.status(201).json({ inserted: insertedCount, skipped: questions.length - insertedCount, errors });
  });

  // POST /exam-prep/questions/upload — multipart file import (.xlsx/.csv/.pdf)
  // The parsed rows go through exactly the same buildQuestionDoc() validation
  // as manual creation, so a file cannot smuggle in an unscorable answer.
  router.post('/questions/upload', (req, res, next) => {
    if (!isFacultyOrAbove(req)) return sendError(res, 'Permission denied.', 403);
    upload.single('file')(req, res, err => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return sendError(res, 'File is too large (max 10 MB).', 413);
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return sendError(res, 'Unexpected file field.', 400);
      }
      return sendError(res, `Upload failed: ${err.message}`, 400);
    });
  }, async (req, res) => {
    const db = getDB();
    const file = req.file;
    if (!file) return sendError(res, 'No file received. Send it as multipart field "file".', 400);

    const originalName = String(file.originalname || '').toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    const isXlsx = originalName.endsWith('.xlsx') || originalName.endsWith('.xlsm') || mime.includes('sheet');
    const isCsv = originalName.endsWith('.csv') || mime === 'text/csv' || originalName.endsWith('.txt');
    const isPdf = originalName.endsWith('.pdf') || mime === 'application/pdf';

    if (!isXlsx && !isCsv && !isPdf) {
      return sendError(res, 'Unsupported file type. Use .xlsx, .csv or .pdf.', 400);
    }

    const { subject, education_level } = req.body || {};
    let parsed;
    let sheets = [];
    let unusedSheets = [];

    try {
      if (isXlsx) {
        const out = await parseXlsxQuestions(file.buffer);
        parsed = out.questions;
        sheets = out.sheets || [];
        unusedSheets = out.unused_sheets || [];
        if (out.errors?.length && !parsed.length) {
          return sendError(res, out.errors[0].reason || 'Spreadsheet could not be read.', 400);
        }
      } else if (isCsv) {
        const out = parseCsvQuestions(file.buffer.toString('utf8'));
        parsed = out.questions;
        if (!parsed.length) {
          return sendError(res, out.errors[0]?.reason || 'No questions found in the CSV.', 400);
        }
      } else {
        // PDFs have no reliable tabular structure — hand the extracted text
        // to the same LLM pipeline used by /extract-image.
        const text = await extractPdfText(file.buffer);
        if (!text.ok) return sendError(res, text.error, 400);

        const prompt = `Extract all MCQ questions from the following text. For each question, output a JSON object on a single line:
{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"...","difficulty":"medium"}

Rules:
- "answer" is the 0-based index of the correct option if you can identify it, otherwise 0.
- If the text has numbered options (A,B,C,D or 1,2,3,4), extract them into the options array.
- Only output JSON lines. No other text.

Text content:
${text.text}`;

        const aiResult = await generateAIResponse('question_extractor', prompt, req.user._id);
        parsed = parseAiQuestions(aiResult.response || '', { subjectFallback: subject, educationLevelFallback: education_level });
        if (!parsed.length) {
          const detail = aiResult.success === false
            ? (aiResult.error || 'AI provider is busy. Please retry shortly.')
            : 'AI could not find questions in this PDF. Try extracting the text first.';
          return sendError(res, detail, aiResult.success === false ? 429 : 422);
        }
      }
    } catch (err) {
      return sendError(res, `Could not parse file: ${err.message}`, 422);
    }

    parsed = clampQuestionCells(parsed);

    const docs = [];
    const errors = [];
    parsed.forEach((q, i) => {
      const built = buildQuestionDoc(q, {
        collegeId: oid(req.userCollegeId),
        createdById: oid(req.user._id),
        createdByName: req.user.name,
        source: isPdf ? 'ai' : 'import',
        subjectFallback: subject,
        educationLevelFallback: education_level,
        row: i + 1,
      });
      if (built.ok) docs.push(built.doc);
      else errors.push({ row: built.row, reason: built.error, question: String(q?.question || '').slice(0, 80) });
    });

    if (!docs.length) {
      return sendError(res, `No valid questions found in the file (${errors.length} row(s) rejected).`, 400);
    }

    const { insertedCount } = await db.collection('exam_prep_questions').insertMany(docs);
    res.status(201).json({
      inserted: insertedCount,
      skipped: parsed.length - insertedCount,
      errors,
      source: isPdf ? 'ai' : 'import',
      sheets,
      unused_sheets: unusedSheets,
      truncated: parsed.length >= MAX_ROWS,
    });
  });

  // PATCH /exam-prep/questions/:id
  router.patch('/questions/:id', async (req, res) => {
    if (!isFacultyOrAbove(req)) return sendError(res, 'Permission denied.', 403);
    const db = getDB();
    const _id = oid(req.params.id);
    if (!_id) return sendError(res, 'Invalid id.', 400);

    const existing = await db.collection('exam_prep_questions').findOne({ _id, ...collegeFilter(req) });
    if (!existing) return sendError(res, 'Question not found.', 404);

    const body = req.body || {};
    const updates = {};
    const next = {
      question: body.question !== undefined ? String(body.question).trim() : existing.question,
      options: body.options !== undefined ? body.options.map(o => String(o).trim()) : existing.options,
      answer: body.answer !== undefined ? Number(body.answer) : existing.answer,
    };

    // Re-validate the merged result so an edit cannot store an unscorable key.
    const check = buildQuestionDoc(next, {
      collegeId: existing.collegeId,
      createdById: existing.createdById,
      createdByName: existing.createdByName,
      source: existing.source,
    });
    if (!check.ok) return sendError(res, check.error, 400);

    if (body.question !== undefined) updates.question = next.question;
    if (body.options !== undefined) updates.options = next.options;
    if (body.answer !== undefined) updates.answer = next.answer;
    if (body.difficulty !== undefined) updates.difficulty = body.difficulty;
    if (body.subject !== undefined) updates.subject = String(body.subject).trim();
    if (body.topic !== undefined) updates.topic = String(body.topic).trim();
    if (body.subtopic !== undefined) updates.subtopic = String(body.subtopic).trim();
    if (body.explanation !== undefined) updates.explanation = String(body.explanation).trim();
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.image_url !== undefined) updates.imageUrl = body.image_url;
    if (body.education_level !== undefined) updates.educationLevel = normalizeEducationLevel(body.education_level);
    updates.updatedAt = nowIso();

    await db.collection('exam_prep_questions').updateOne({ _id, ...collegeFilter(req) }, { $set: updates });
    const updated = await db.collection('exam_prep_questions').findOne({ _id });
    res.json(serializeQuestion(updated, { hideAnswer: false }));
  });

  // DELETE /exam-prep/questions/:id
  router.delete('/questions/:id', async (req, res) => {
    if (!isFacultyOrAbove(req)) return sendError(res, 'Permission denied.', 403);
    const db = getDB();
    const _id = oid(req.params.id);
    if (!_id) return sendError(res, 'Invalid id.', 400);

    const result = await db.collection('exam_prep_questions').deleteOne({ _id, ...collegeFilter(req) });
    if (!result.deletedCount) return sendError(res, 'Question not found.', 404);
    res.json({ ok: true });
  });

  // ════════════════════════════════════════════════════════════════
  // AI QUESTION GENERATION
  // ════════════════════════════════════════════════════════════════

  router.post('/generate-ai', async (req, res) => {
    if (!isFacultyOrAbove(req)) return sendError(res, 'Permission denied.', 403);
    const db = getDB();
    const { subject, topic, difficulty, save = false } = req.body || {};
    // Clamp the request: unbounded `count` let a client trigger hundreds of
    // paid LLM generations in a single call.
    const count = Math.min(Math.max(parseInt(req.body?.count, 10) || 5, 1), 20);
    const educationLevel = normalizeEducationLevel(req.body?.education_level);

    if (!subject) return sendError(res, 'subject is required.', 400);

    const levelLabel = { school: 'school level (grades 6-10)', college: 'college/university level', competitive: 'competitive exam level (JEE/NEET/GATE/UPSC equivalent)' }[educationLevel] || 'college level';

    const prompt = `Generate exactly ${count} multiple-choice questions on the topic: "${topic || subject}" for ${subject} at ${levelLabel}. Difficulty: ${difficulty || 'medium'}.

For EACH question, output a JSON object on a single line with these exact fields:
{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"...","difficulty":"${difficulty || 'medium'}"}

- "answer" is the 0-based index of the correct option.
- "explanation" must be 1-2 sentences explaining why the answer is correct.
- Options must be different from each other.
- Do NOT number the questions. Output only the JSON lines, nothing else.`;

    const aiResult = await generateAIResponse('question_generator', prompt, req.user._id);
    const text = aiResult.response || '';

    const context = {
      collegeId: null,
      subjectFallback: subject,
      educationLevelFallback: educationLevel,
    };
    let parsed = parseAiQuestions(text, context);

    // One retry — models occasionally emit malformed JSON on the first pass.
    if (!parsed.length) {
      const retry = await generateAIResponse('question_generator', prompt, req.user._id);
      parsed = parseAiQuestions(retry.response || '', context);
    }

    if (!parsed.length) {
      if (aiResult.success === false) {
        // The provider rate-limited us; report that honestly instead of a 500.
        return sendError(res, aiResult.error || 'AI provider is busy. Please retry shortly.', 429);
      }
      return sendError(res, 'AI could not generate valid questions. Please rephrase your topic.', 500);
    }

    let savedIds = [];
    if (save) {
      const docs = parsed.map(q => ({
        ...q,
        subject: String(subject || '').trim(),
        topic: String(topic || '').trim(),
        educationLevel,
        tags: ['ai-generated'],
        source: 'ai',
        collegeId: oid(req.userCollegeId),
        createdById: oid(req.user._id),
        createdByName: req.user.name,
        createdAt: nowIso(),
      }));
      const { insertedIds } = await db.collection('exam_prep_questions').insertMany(docs);
      savedIds = Object.values(insertedIds).map(String);
    }

    res.json({
      questions: parsed.map(q => toAiQuestion(q, { subject, educationLevel })),
      saved: save,
      saved_ids: savedIds,
      source: aiResult.source,
    });
  });

  // POST /exam-prep/extract-image — extract questions from base64 image/PDF text
  router.post('/extract-image', async (req, res) => {
    if (!isFacultyOrAbove(req)) return sendError(res, 'Permission denied.', 403);
    const { image_base64, ocr_text, subject } = req.body || {};
    const educationLevel = normalizeEducationLevel(req.body?.education_level);

    if (!image_base64 && !ocr_text) {
      return sendError(res, 'image_base64 or ocr_text is required.', 400);
    }

    const prompt = `Extract all MCQ questions from the following text (or image description). For each question found, output a JSON object on a single line:
{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"...","difficulty":"medium"}

Rules:
- "answer" is the 0-based index of the correct option if you can identify it, otherwise 0.
- If the text has numbered options (A,B,C,D or 1,2,3,4), extract them into the options array.
- Only output JSON lines. No other text.

Text content:
${ocr_text || '[Image content — extract any visible MCQ questions]'}`;

    const aiResult = await generateAIResponse('question_extractor', prompt, req.user._id);
    const parsed = parseAiQuestions(aiResult.response || '', { educationLevelFallback: educationLevel })
      .map(q => toAiQuestion(q, { subject: subject || '', educationLevel }));

    res.json({ questions: parsed, extracted_count: parsed.length, source: aiResult.source });
  });

  // ════════════════════════════════════════════════════════════════
  // QUIZ BUILDER
  // ════════════════════════════════════════════════════════════════

  // POST /exam-prep/quizzes
  router.post('/quizzes', async (req, res) => {
    if (!isFacultyOrAbove(req)) return sendError(res, 'Permission denied.', 403);
    const db = getDB();
    const body = req.body || {};
    const title = String(body.title || '').trim();
    if (!title) return sendError(res, 'title is required.', 400);

    // question_ids: array of question IDs to include in the quiz
    const questionIds = (body.question_ids || []).map(id => oid(id)).filter(Boolean);
    if (!questionIds.length) return sendError(res, 'question_ids (non-empty array) is required.', 400);

    // Verify questions exist and belong to this college
    const questions = await db.collection('exam_prep_questions')
      .find({ _id: { $in: questionIds }, ...collegeFilter(req) })
      .toArray();

    if (!questions.length) return sendError(res, 'None of the specified questions were found.', 400);

    const doc = {
      collegeId: oid(req.userCollegeId),
      title,
      description: String(body.description || '').trim(),
      subject: String(body.subject || '').trim(),
      topic: String(body.topic || '').trim(),
      educationLevel: normalizeEducationLevel(body.education_level),
      difficulty: body.difficulty || 'mixed',
      questionIds: questions.map(q => q._id),
      totalQuestions: questions.length,
      durationMinutes: Number(body.duration_minutes || 30),
      passScore: Number(body.pass_score || 60),
      maxAttempts: body.max_attempts ? Number(body.max_attempts) : null,
      isPractice: Boolean(body.is_practice),
      shuffleQuestions: body.shuffle_questions !== false,
      shuffleOptions: body.shuffle_options !== false,
      status: body.status || 'draft',
      windowStart: body.window_start || null,
      windowEnd: body.window_end || null,
      createdById: oid(req.user._id),
      createdByName: req.user.name,
      attemptCount: 0,
      createdAt: nowIso(),
    };

    const { insertedId } = await db.collection('exam_prep_quizzes').insertOne(doc);
    res.status(201).json(serializeQuiz({ ...doc, _id: insertedId }));
  });

  // GET /exam-prep/quizzes
  router.get('/quizzes', async (req, res) => {
    const db = getDB();
    const filter = { ...collegeFilter(req) };

    // Students only see published quizzes that are within the window
    if (req.user.role === 'student') {
      filter.status = 'published';
    }

    const { subject, education_level, difficulty } = req.query;
    if (subject) filter.subject = subject;
    if (education_level) filter.educationLevel = education_level;
    if (difficulty) filter.difficulty = difficulty;

    const quizzes = await db.collection('exam_prep_quizzes')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    res.json(quizzes.map(serializeQuiz));
  });

  // GET /exam-prep/quizzes/:id
  router.get('/quizzes/:id', async (req, res) => {
    const db = getDB();
    const _id = oid(req.params.id);
    if (!_id) return sendError(res, 'Invalid id.', 400);

    const quiz = await db.collection('exam_prep_quizzes').findOne({ _id, ...collegeFilter(req) });
    if (!quiz) return sendError(res, 'Quiz not found.', 404);

    // Students must not be able to read unpublished quizzes — the payload
    // includes the question id list.
    if (req.user.role === 'student' && quiz.status !== 'published') {
      return sendError(res, 'Quiz not found.', 404);
    }

    res.json(serializeQuiz(quiz));
  });

  // PATCH /exam-prep/quizzes/:id
  router.patch('/quizzes/:id', async (req, res) => {
    if (!isFacultyOrAbove(req)) return sendError(res, 'Permission denied.', 403);
    const db = getDB();
    const _id = oid(req.params.id);
    if (!_id) return sendError(res, 'Invalid id.', 400);

    const existing = await db.collection('exam_prep_quizzes').findOne({ _id, ...collegeFilter(req) });
    if (!existing) return sendError(res, 'Quiz not found.', 404);

    const body = req.body || {};
    const updates = { updatedAt: nowIso() };

    if (body.title !== undefined) updates.title = String(body.title).trim();
    if (body.description !== undefined) updates.description = String(body.description).trim();
    if (body.education_level !== undefined) updates.educationLevel = normalizeEducationLevel(body.education_level);
    if (body.is_practice !== undefined) updates.isPractice = Boolean(body.is_practice);
    if (body.shuffle_questions !== undefined) updates.shuffleQuestions = Boolean(body.shuffle_questions);
    if (body.shuffle_options !== undefined) updates.shuffleOptions = Boolean(body.shuffle_options);

    const schedule = buildQuizScheduleUpdates(body, existing);
    if (!schedule.ok) return sendError(res, schedule.error, 400);
    Object.assign(updates, schedule.updates);

    if (body.question_ids !== undefined) {
      const qIds = body.question_ids.map(id => oid(id)).filter(Boolean);
      const questions = await db.collection('exam_prep_questions')
        .find({ _id: { $in: qIds }, ...collegeFilter(req) })
        .toArray();
      updates.questionIds = questions.map(q => q._id);
      updates.totalQuestions = questions.length;
    }

    await db.collection('exam_prep_quizzes').updateOne({ _id, ...collegeFilter(req) }, { $set: updates });
    const updated = await db.collection('exam_prep_quizzes').findOne({ _id });
    res.json(serializeQuiz(updated));
  });

  // DELETE /exam-prep/quizzes/:id
  router.delete('/quizzes/:id', async (req, res) => {
    if (!isFacultyOrAbove(req)) return sendError(res, 'Permission denied.', 403);
    const db = getDB();
    const _id = oid(req.params.id);
    if (!_id) return sendError(res, 'Invalid id.', 400);

    const result = await db.collection('exam_prep_quizzes').deleteOne({ _id, ...collegeFilter(req) });
    if (!result.deletedCount) return sendError(res, 'Quiz not found.', 404);
    res.json({ ok: true });
  });

  // POST /exam-prep/quizzes/:id/schedule
  router.post('/quizzes/:id/schedule', async (req, res) => {
    if (!isFacultyOrAbove(req)) return sendError(res, 'Permission denied.', 403);
    const db = getDB();
    const _id = oid(req.params.id);
    if (!_id) return sendError(res, 'Invalid id.', 400);

    const existing = await db.collection('exam_prep_quizzes').findOne({ _id, ...collegeFilter(req) });
    if (!existing) return sendError(res, 'Quiz not found.', 404);

    const body = req.body || {};
    // Backwards compatible: omitting `status` still publishes the quiz.
    if (body.status === undefined) body.status = 'published';

    const schedule = buildQuizScheduleUpdates(body, existing);
    if (!schedule.ok) return sendError(res, schedule.error, 400);

    const updates = { updatedAt: nowIso(), ...schedule.updates };

    const result = await db.collection('exam_prep_quizzes').updateOne(
      { _id, ...collegeFilter(req) },
      { $set: updates }
    );
    if (!result.matchedCount) return sendError(res, 'Quiz not found.', 404);

    const updated = await db.collection('exam_prep_quizzes').findOne({ _id });
    res.json(serializeQuiz(updated));
  });

  // GET /exam-prep/quizzes/:id/analytics — faculty only
  router.get('/quizzes/:id/analytics', async (req, res) => {
    if (!isFacultyOrAbove(req)) return sendError(res, 'Permission denied.', 403);
    const db = getDB();
    const _id = oid(req.params.id);
    if (!_id) return sendError(res, 'Invalid id.', 400);

    const quiz = await db.collection('exam_prep_quizzes').findOne({ _id, ...collegeFilter(req) });
    if (!quiz) return sendError(res, 'Quiz not found.', 404);

    const attempts = await db.collection('exam_prep_attempts')
      .find({ quizId: _id, status: 'submitted', ...collegeFilter(req) })
      .toArray();

    const total = attempts.length;
    const passed = attempts.filter(a => a.passed).length;
    const scores = attempts.map(a => a.scorePercent || 0);
    const avg = total ? Math.round(scores.reduce((s, v) => s + v, 0) / total) : 0;
    const highest = total ? Math.max(...scores) : 0;
    const lowest = total ? Math.min(...scores) : 0;

    // Score distribution buckets 0-20 … 80-100. The top bucket is inclusive
    // so a score of exactly 100 is counted.
    const buckets = [0, 20, 40, 60, 80, 100];
    const distribution = buckets.slice(0, -1).map((low, i) => ({
      range: `${low}-${buckets[i + 1]}`,
      count: scores.filter(s => s >= low && (i === buckets.length - 2 ? s <= buckets[i + 1] : s < buckets[i + 1])).length,
    }));

    const ranked = [...attempts].sort((a, b) => (b.scorePercent || 0) - (a.scorePercent || 0));

    return res.json({
      quiz: serializeQuiz(quiz),
      stats: { total_attempts: total, passed, failed: total - passed, pass_rate: total ? Math.round((passed / total) * 100) : 0, average_score: avg, highest_score: highest, lowest_score: lowest },
      distribution,
      top_students: ranked
        .slice(0, 10)
        .map((a, i) => ({ rank: i + 1, student_name: a.studentName, student_id: String(a.studentId), score: a.scorePercent, passed: a.passed, submitted_at: a.submittedAt })),
      attempts: ranked
        .slice(0, 100)
        .map(a => ({
          attempt_id: String(a._id),
          student_name: a.studentName,
          student_id: String(a.studentId),
          score: a.scorePercent || 0,
          correct: a.correctCount || 0,
          total: a.totalQuestions || 0,
          passed: Boolean(a.passed),
          time_taken_seconds: a.timeTakenSeconds || 0,
          submitted_at: a.submittedAt,
        })),
    });
  });

  // ════════════════════════════════════════════════════════════════
  // STUDENT QUIZ ATTEMPTS
  // ════════════════════════════════════════════════════════════════

  function resolveQuestionForAttempt(q, i, attemptId, quiz) {
    if (!quiz.shuffleOptions) {
      return { options: q.options, answerIndex: q.answer };
    }
    const shuffled = seededShuffle(q.options, String(attemptId) + i);
    const originalText = q.options[q.answer];
    const newIndex = shuffled.indexOf(originalText);
    return {
      options: shuffled,
      answerIndex: newIndex >= 0 ? newIndex : q.answer,
    };
  }

  /**
   * `questions` must already be in the student's viewing order — pass the
   * result of orderQuestionsForAttempt(). Shuffling here would silently
   * diverge from the order used at scoring time.
   */
  function buildAttemptPayload(quiz, attempt, orderedQuestions) {
    return {
      attempt_id: String(attempt._id),
      quiz: serializeQuiz(quiz),
      started_at: attempt.startedAt,
      expires_at: attempt.expiresAt,
      seconds_remaining: attempt.expiresAt
        ? Math.max(0, Math.round((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000))
        : null,
      answers: attempt.answers || {},
      is_practice: quiz.isPractice || false,
      questions: orderedQuestions.map((q, i) => {
        const resolved = resolveQuestionForAttempt(q, i, attempt._id, quiz);
        return {
          index: i,
          question_id: String(q._id),
          question: q.question,
          options: resolved.options,
          difficulty: q.difficulty,
          image_url: q.imageUrl || null,
        };
      }),
    };
  }

  /**
   * Score an attempt from scratch and persist the outcome exactly once.
   *
   * This is the single place where correctness is decided. It is called from
   * the submit route and from the lazy-expiry path, so an attempt can never be
   * scored twice or resurrected after its timer has passed.
   *
   * @returns {Promise<object>} the result payload
   */
  async function finalizeAttempt({ req, db, io, attempt, quiz, answers, status }) {
    const ordered = await orderQuestionsForAttempt(db, quiz, attempt);

    // Server-side scoring, accounting for the per-question option shuffle.
    const resolvedQuestions = ordered.map((q, i) => ({
      q,
      ...resolveQuestionForAttempt(q, i, attempt._id, quiz),
    }));

    const correctCount = resolvedQuestions.filter(({ answerIndex }, i) => (answers[i] ?? answers[String(i)]) === answerIndex).length;
    const scorePercent = ordered.length ? Math.round((correctCount / ordered.length) * 100) : 0;
    const passed = scorePercent >= quiz.passScore;
    const submittedAt = nowIso();
    const timeTakenSeconds = Math.max(
      0,
      Math.round((new Date(submittedAt).getTime() - new Date(attempt.startedAt).getTime()) / 1000)
    );

    const set = {
      status,
      answers,
      correctCount,
      scorePercent,
      passed,
      submittedAt,
      timeTakenSeconds,
    };
    // An expired attempt was closed by the clock, not by the student.
    if (status === 'expired') set.expiredAt = submittedAt;

    await db.collection('exam_prep_attempts').updateOne(
      { _id: attempt._id, status: 'in_progress' },
      { $set: set }
    );

    // Track mastery per topic
    const topicStats = {};
    for (const [i, { q, answerIndex }] of resolvedQuestions.entries()) {
      const topic = q.topic || q.subject || 'general';
      if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 };
      topicStats[topic].total++;
      if ((answers[i] ?? answers[String(i)]) === answerIndex) topicStats[topic].correct++;
    }

    await Promise.all(Object.entries(topicStats).map(([topic, stats]) =>
      db.collection('exam_prep_mastery').updateOne(
        { studentId: oid(req.user._id), topic, collegeId: oid(req.userCollegeId) },
        {
          $inc: { totalAttempts: stats.total, correctAttempts: stats.correct },
          $set: { updatedAt: submittedAt },
          $setOnInsert: { createdAt: submittedAt },
        },
        { upsert: true }
      )
    ));

    io.to(roomForUser(req.user._id)).emit('exam-prep:submitted', {
      quiz_id: String(quiz._id),
      score_percent: scorePercent,
      passed,
      expired: status === 'expired',
    });

    const finalAttempt = await db.collection('exam_prep_attempts').findOne({ _id: attempt._id });
    return { ...buildResultPayload(quiz, finalAttempt, ordered), expired: status === 'expired' };
  }

  // POST /exam-prep/quizzes/:id/start
  router.post('/quizzes/:id/start', async (req, res) => {
    if (req.user.role !== 'student') return sendError(res, 'Only students can start quiz attempts.', 403);
    const db = getDB();
    const quizId = oid(req.params.id);
    if (!quizId) return sendError(res, 'Invalid quiz id.', 400);

    const quiz = await db.collection('exam_prep_quizzes').findOne({ _id: quizId, ...collegeFilter(req) });
    if (!quiz) return sendError(res, 'Quiz not found.', 404);
    if (quiz.status !== 'published') return sendError(res, 'This quiz is not available yet.', 400);

    // Check window
    const now = new Date();
    if (quiz.windowStart && now < new Date(quiz.windowStart)) {
      return sendError(res, `This quiz opens on ${new Date(quiz.windowStart).toLocaleString()}.`, 400);
    }
    if (quiz.windowEnd && now > new Date(quiz.windowEnd)) {
      return sendError(res, 'This quiz window has closed.', 400);
    }

    // Close any stale in-progress attempt first. It is graded from whatever
    // was autosaved, so abandoning a quiz no longer yields a free retry.
    const existing = await db.collection('exam_prep_attempts').findOne({
      quizId,
      studentId: oid(req.user._id),
      status: 'in_progress',
    });
    if (existing) {
      const expired = existing.expiresAt && Date.now() > new Date(existing.expiresAt).getTime();
      if (!expired) {
        const questions = await orderQuestionsForAttempt(db, quiz, existing);
        return res.json(buildAttemptPayload(quiz, existing, questions));
      }
      await finalizeAttempt({
        req, db, io,
        attempt: existing,
        quiz,
        answers: existing.answers || {},
        status: 'expired',
      });
    }

    // Check max attempts — expired attempts consume one as well.
    if (quiz.maxAttempts) {
      const prevCount = await db.collection('exam_prep_attempts').countDocuments({
        quizId,
        studentId: oid(req.user._id),
        status: { $in: ['submitted', 'expired'] },
      });
      if (prevCount >= quiz.maxAttempts) {
        return sendError(res, `You have reached the maximum of ${quiz.maxAttempts} attempt(s) for this quiz.`, 409);
      }
    }

    const startedAt = new Date();
    const expiresAt = quiz.isPractice ? null : new Date(startedAt.getTime() + quiz.durationMinutes * 60000);

    const doc = {
      quizId,
      quizTitle: quiz.title,
      studentId: oid(req.user._id),
      studentName: req.user.name,
      collegeId: oid(req.userCollegeId),
      status: 'in_progress',
      answers: {},
      totalQuestions: quiz.questionIds.length,
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      isPractice: quiz.isPractice || false,
    };

    const { insertedId } = await db.collection('exam_prep_attempts').insertOne(doc);
    await db.collection('exam_prep_quizzes').updateOne({ _id: quizId }, { $inc: { attemptCount: 1 } });

    const created = { ...doc, _id: insertedId };
    const questions = await orderQuestionsForAttempt(db, quiz, created);

    res.status(201).json(buildAttemptPayload(quiz, created, questions));
  });

  // POST /exam-prep/attempts/:aid/answer — autosave
  router.post('/attempts/:aid/answer', async (req, res) => {
    if (req.user.role !== 'student') return sendError(res, 'Only students can save quiz answers.', 403);
    const db = getDB();
    const attempt = await db.collection('exam_prep_attempts').findOne({
      _id: oid(req.params.aid),
      studentId: oid(req.user._id),
    });
    if (!attempt) return sendError(res, 'Attempt not found.', 404);
    if (attempt.status !== 'in_progress') return sendError(res, 'This attempt is already closed.', 409);

    // Check timer (skip for practice)
    if (!attempt.isPractice && attempt.expiresAt) {
      if (Date.now() > new Date(attempt.expiresAt).getTime() + SUBMIT_GRACE_SECONDS * 1000) {
        return sendError(res, 'Time is up for this attempt.', 409);
      }
    }

    const index = Number(req.body?.index);
    const optionIndex = Number(req.body?.optionIndex);

    if (!Number.isInteger(index) || index < 0 || index >= attempt.totalQuestions) {
      return sendError(res, 'Invalid question index.', 400);
    }
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > MAX_OPTION_INDEX) {
      return sendError(res, 'Invalid option index.', 400);
    }

    await db.collection('exam_prep_attempts').updateOne(
      { _id: attempt._id },
      { $set: { [`answers.${index}`]: optionIndex, lastAnsweredAt: nowIso() } }
    );

    // For practice mode: also return the correct answer and explanation
    if (attempt.isPractice) {
      const quiz = await db.collection('exam_prep_quizzes').findOne({ _id: attempt.quizId });
      if (quiz) {
        const ordered = await orderQuestionsForAttempt(db, quiz, attempt);
        const q = ordered[index];
        if (q) {
          // Resolve through the same shuffle the student was shown, so the
          // reported index matches the option they actually tapped.
          const resolved = resolveQuestionForAttempt(q, index, attempt._id, quiz);
          return res.json({
            success: true,
            index,
            optionIndex,
            correct: resolved.answerIndex === optionIndex,
            correct_index: resolved.answerIndex,
            explanation: q.explanation || '',
          });
        }
      }
    }

    res.json({ success: true, index, optionIndex });
  });

  // POST /exam-prep/attempts/:aid/submit — server-side scoring
  router.post('/attempts/:aid/submit', async (req, res) => {
    if (req.user.role !== 'student') return sendError(res, 'Only students can submit quiz attempts.', 403);
    const db = getDB();
    const attempt = await db.collection('exam_prep_attempts').findOne({
      _id: oid(req.params.aid),
      studentId: oid(req.user._id),
    });
    if (!attempt) return sendError(res, 'Attempt not found.', 404);

    // Already settled — always return the frozen result, never re-score.
    if (attempt.status !== 'in_progress') {
      const quiz = await db.collection('exam_prep_quizzes').findOne({ _id: attempt.quizId });
      if (!quiz) return sendError(res, 'Quiz not found.', 404);
      if (attempt.scorePercent === undefined) {
        return sendError(res, 'This attempt has expired and was not submitted in time.', 409);
      }
      const ordered = await orderQuestionsForAttempt(db, quiz, attempt);
      return res.json({ ...buildResultPayload(quiz, attempt, ordered), expired: attempt.status === 'expired' });
    }

    const quiz = await db.collection('exam_prep_quizzes').findOne({ _id: attempt.quizId });
    if (!quiz) return sendError(res, 'Quiz not found.', 404);

    // Timer enforcement. Past the grace window only the autosaved answers
    // count — a late client payload can no longer extend the attempt.
    const pastDeadline = !attempt.isPractice && !!attempt.expiresAt &&
      Date.now() > new Date(attempt.expiresAt).getTime() + SUBMIT_GRACE_SECONDS * 1000;

    const answers = { ...(attempt.answers || {}) };
    if (!pastDeadline && req.body?.answers && typeof req.body.answers === 'object') {
      for (const [key, value] of Object.entries(req.body.answers)) {
        const idx = Number(key);
        const opt = Number(value);
        if (
          Number.isInteger(idx) && idx >= 0 && idx < attempt.totalQuestions &&
          Number.isInteger(opt) && opt >= 0 && opt <= MAX_OPTION_INDEX
        ) {
          answers[idx] = opt;
        }
      }
    }

    const result = await finalizeAttempt({
      req, db, io,
      attempt,
      quiz,
      answers,
      status: pastDeadline ? 'expired' : 'submitted',
    });
    res.json(result);
  });

  function buildResultPayload(quiz, attempt, orderedQuestions) {
    const answers = attempt.answers || {};
    return {
      attempt_id: String(attempt._id),
      quiz: serializeQuiz(quiz),
      score_percent: attempt.scorePercent,
      correct: attempt.correctCount,
      total: attempt.totalQuestions,
      passed: attempt.passed,
      time_taken_seconds: attempt.timeTakenSeconds,
      submitted_at: attempt.submittedAt,
      breakdown: orderedQuestions.map((q, i) => {
        const resolved = resolveQuestionForAttempt(q, i, attempt._id, quiz);
        const selected = answers[i] ?? answers[String(i)] ?? null;
        return {
          index: i,
          question: q.question,
          options: resolved.options,
          difficulty: q.difficulty,
          correct_index: resolved.answerIndex,
          selected_index: selected,
          correct: selected === resolved.answerIndex,
          explanation: q.explanation || '',
        };
      }),
      by_difficulty: ['easy', 'medium', 'hard'].map(level => {
        const subset = orderedQuestions.map((q, i) => ({
          q,
          i,
          resolved: resolveQuestionForAttempt(q, i, attempt._id, quiz),
        })).filter(({ q }) => q.difficulty === level);
        const correct = subset.filter(({ i, resolved }) => (answers[i] ?? answers[String(i)]) === resolved.answerIndex).length;
        return { difficulty: level, total: subset.length, correct, percent: subset.length ? Math.round((correct / subset.length) * 100) : 0 };
      }).filter(d => d.total > 0),
    };
  }

  // GET /exam-prep/attempts/:aid — get attempt (in_progress or result)
  router.get('/attempts/:aid', async (req, res) => {
    const db = getDB();
    const attempt = await db.collection('exam_prep_attempts').findOne({
      _id: oid(req.params.aid),
      studentId: oid(req.user._id),
    });
    if (!attempt) return sendError(res, 'Attempt not found.', 404);

    const quiz = await db.collection('exam_prep_quizzes').findOne({ _id: attempt.quizId });
    if (!quiz) return sendError(res, 'Quiz not found.', 404);

    if (attempt.status === 'submitted' || (attempt.status === 'expired' && attempt.scorePercent !== undefined)) {
      const ordered = await orderQuestionsForAttempt(db, quiz, attempt);
      return res.json({ ...buildResultPayload(quiz, attempt, ordered), expired: attempt.status === 'expired' });
    }

    if (!attempt.isPractice && attempt.expiresAt && Date.now() > new Date(attempt.expiresAt).getTime()) {
      await db.collection('exam_prep_attempts').updateOne({ _id: attempt._id }, { $set: { status: 'expired', expiredAt: nowIso() } });
      return sendError(res, 'This attempt has expired.', 409);
    }

    const ordered = await orderQuestionsForAttempt(db, quiz, attempt);
    return res.json(buildAttemptPayload(quiz, attempt, ordered));
  });

  // GET /exam-prep/attempts/:aid/result
  router.get('/attempts/:aid/result', async (req, res) => {
    const db = getDB();
    const attempt = await db.collection('exam_prep_attempts').findOne({
      _id: oid(req.params.aid),
      studentId: oid(req.user._id),
    });
    if (!attempt) return sendError(res, 'Attempt not found.', 404);
    if (attempt.status !== 'submitted') return sendError(res, 'Attempt not yet submitted.', 400);

    const quiz = await db.collection('exam_prep_quizzes').findOne({ _id: attempt.quizId });
    if (!quiz) return sendError(res, 'Quiz not found.', 404);

    const ordered = await orderQuestionsForAttempt(db, quiz, attempt);

    res.json({ ...buildResultPayload(quiz, attempt, ordered), expired: false });
  });

  // GET /exam-prep/my-attempts
  router.get('/my-attempts', async (req, res) => {
    if (!requireStudent(req, res)) return;
    const db = getDB();
    const attempts = await db.collection('exam_prep_attempts')
      .find(andFilters(
        { studentId: oid(req.user._id) },
        // Only settled attempts that actually carry a score.
        { $or: [{ status: 'submitted' }, { status: 'expired', scorePercent: { $exists: true } }] },
        collegeFilter(req),
      ))
      .sort({ submittedAt: -1 })
      .limit(50)
      .toArray();

    res.json(attempts.map(a => ({
      id: String(a._id),
      quiz_id: String(a.quizId),
      quiz_title: a.quizTitle,
      score_percent: a.scorePercent ?? null,
      correct: a.correctCount ?? null,
      total: a.totalQuestions,
      passed: Boolean(a.passed),
      time_taken_seconds: a.timeTakenSeconds,
      submitted_at: a.submittedAt,
      is_practice: a.isPractice || false,
      expired: a.status === 'expired',
    })));
  });

  // ════════════════════════════════════════════════════════════════
  // PRACTICE MODE (untimed, question-by-question with explanations)
  // ════════════════════════════════════════════════════════════════

  // POST /exam-prep/practice/start
  router.post('/practice/start', async (req, res) => {
    if (!requireStudent(req, res)) return;
    const db = getDB();
    const { subject, topic, difficulty, count = 10 } = req.body || {};

    // Default to the student's own level when they have one, but never
    // filter when nothing is set — that would hide every existing question.
    const requestedLevel = req.body?.education_level || req.user?.educationLevel;
    const filter = { ...collegeFilter(req) };
    if (subject) filter.subject = subject;
    if (topic) filter.topic = topic;
    if (difficulty && difficulty !== 'mixed') filter.difficulty = difficulty;
    if (requestedLevel) filter.educationLevel = normalizeEducationLevel(requestedLevel);

    const take = Math.min(Math.max(parseInt(count, 10) || 10, 1), 50);
    let questions = await db.collection('exam_prep_questions')
      .find(filter)
      .limit(take * 3)
      .toArray();

    // Shuffle and select count
    questions = seededShuffle(questions, Date.now().toString()).slice(0, take);

    if (!questions.length) {
      return sendError(res, 'No questions found for the selected filters. Ask your faculty to add questions.', 404);
    }

    const doc = {
      collegeId: oid(req.userCollegeId),
      studentId: oid(req.user._id),
      studentName: req.user.name,
      type: 'practice',
      subject: subject || null,
      topic: topic || null,
      questionIds: questions.map(q => q._id),
      totalQuestions: questions.length,
      answers: {},
      status: 'in_progress',
      startedAt: nowIso(),
    };

    const { insertedId } = await db.collection('exam_prep_practice_sessions').insertOne(doc);

    res.status(201).json({
      session_id: String(insertedId),
      total_questions: questions.length,
      questions: questions.map((q, i) => ({
        index: i,
        question_id: String(q._id),
        question: q.question,
        options: q.options,
        difficulty: q.difficulty,
        image_url: q.imageUrl || null,
      })),
    });
  });

  // POST /exam-prep/practice/:sid/answer — returns explanation immediately
  router.post('/practice/:sid/answer', async (req, res) => {
    if (!requireStudent(req, res)) return;
    const db = getDB();
    const session = await db.collection('exam_prep_practice_sessions').findOne({
      _id: oid(req.params.sid),
      studentId: oid(req.user._id),
    });
    if (!session) return sendError(res, 'Session not found.', 404);
    if (session.status === 'completed') return sendError(res, 'Session already completed.', 409);

    const index = Number(req.body?.index);
    const optionIndex = Number(req.body?.optionIndex);

    if (!Number.isInteger(index) || index < 0 || index >= session.totalQuestions) {
      return sendError(res, 'Invalid question index.', 400);
    }
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > MAX_OPTION_INDEX) {
      return sendError(res, 'Invalid option index.', 400);
    }

    await db.collection('exam_prep_practice_sessions').updateOne(
      { _id: session._id },
      { $set: { [`answers.${index}`]: optionIndex, lastAnsweredAt: nowIso() } }
    );

    // Index into questionIds — the stored order the student was shown.
    const questionId = session.questionIds[index];
    const q = await db.collection('exam_prep_questions').findOne({ _id: questionId });

    if (!q) return res.json({ success: true, index, optionIndex });

    res.json({
      success: true,
      index,
      optionIndex,
      correct: q.answer === optionIndex,
      correct_index: q.answer,
      correct_option: q.options[q.answer],
      explanation: q.explanation || 'No explanation available.',
    });
  });

  // POST /exam-prep/practice/:sid/submit
  router.post('/practice/:sid/submit', async (req, res) => {
    if (!requireStudent(req, res)) return;
    const db = getDB();
    const session = await db.collection('exam_prep_practice_sessions').findOne({
      _id: oid(req.params.sid),
      studentId: oid(req.user._id),
    });
    if (!session) return sendError(res, 'Session not found.', 404);

    const answers = { ...(session.answers || {}) };

    // Re-align to the session's own ordering. A `$in` fetch returns rows in
    // an arbitrary order, so scoring against it mislabels every answer.
    const fetched = await db.collection('exam_prep_questions')
      .find({ _id: { $in: session.questionIds } }).toArray();
    const byId = new Map(fetched.map(q => [String(q._id), q]));
    const questions = session.questionIds
      .map(id => byId.get(String(id)))
      .filter(Boolean);

    const correctCount = questions.filter((q, i) => (answers[i] ?? answers[String(i)]) === q.answer).length;
    const scorePercent = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;

    await db.collection('exam_prep_practice_sessions').updateOne(
      { _id: session._id },
      { $set: { status: 'completed', correctCount, scorePercent, completedAt: nowIso() } }
    );

    res.json({
      session_id: String(session._id),
      score_percent: scorePercent,
      correct: correctCount,
      total: questions.length,
      breakdown: questions.map((q, i) => {
        const selected = answers[i] ?? answers[String(i)] ?? null;
        return {
          index: i,
          question: q.question,
          options: q.options,
          correct_index: q.answer,
          selected_index: selected,
          correct: selected === q.answer,
          explanation: q.explanation || '',
        };
      }),
    });
  });

  // ════════════════════════════════════════════════════════════════
  // BOOKMARKS
  // ════════════════════════════════════════════════════════════════

  router.get('/bookmarks', async (req, res) => {
    const db = getDB();
    const bookmarks = await db.collection('exam_prep_bookmarks')
      .find({ studentId: oid(req.user._id), ...collegeFilter(req) })
      .sort({ createdAt: -1 })
      .toArray();

    const questionIds = bookmarks.map(b => b.questionId);
    const questions = await db.collection('exam_prep_questions')
      .find({ _id: { $in: questionIds } }).toArray();

    // Students must not receive the answer key here — these are the same
    // questions that appear in quizzes they have not yet taken.
    const hideAnswer = req.user.role === 'student';

    const qMap = new Map(questions.map(q => [String(q._id), q]));
    res.json(bookmarks.map(b => ({
      id: String(b._id),
      question_id: String(b.questionId),
      note: b.note || '',
      created_at: b.createdAt,
      question: qMap.has(String(b.questionId)) ? serializeQuestion(qMap.get(String(b.questionId)), { hideAnswer }) : null,
    })));
  });

  router.post('/bookmarks', async (req, res) => {
    const db = getDB();
    const questionId = oid(req.body?.question_id);
    if (!questionId) return sendError(res, 'question_id is required.', 400);

    const question = await db.collection('exam_prep_questions').findOne({ _id: questionId, ...collegeFilter(req) });
    if (!question) return sendError(res, 'Question not found.', 404);

    const existing = await db.collection('exam_prep_bookmarks').findOne({
      studentId: oid(req.user._id),
      questionId,
    });
    if (existing) return res.json({ id: String(existing._id), already_bookmarked: true });

    const doc = {
      collegeId: oid(req.userCollegeId),
      studentId: oid(req.user._id),
      questionId,
      note: String(req.body?.note || '').trim(),
      createdAt: nowIso(),
    };
    const { insertedId } = await db.collection('exam_prep_bookmarks').insertOne(doc);
    res.status(201).json({ id: String(insertedId), already_bookmarked: false });
  });

  router.delete('/bookmarks/:qid', async (req, res) => {
    const db = getDB();
    const questionId = oid(req.params.qid);
    const result = await db.collection('exam_prep_bookmarks').deleteOne({
      studentId: oid(req.user._id),
      questionId,
    });
    if (!result.deletedCount) return sendError(res, 'Bookmark not found.', 404);
    res.json({ ok: true });
  });

  // ════════════════════════════════════════════════════════════════
  // STUDENT DASHBOARD & RECOMMENDATIONS
  // ════════════════════════════════════════════════════════════════

  router.get('/dashboard', async (req, res) => {
    if (!requireStudent(req, res)) return;
    const db = getDB();
    const studentId = oid(req.user._id);
    const colFilter = collegeFilter(req);
    // Settled attempts that carry a score (expired ones are graded too).
    const scoredAttempt = {
      $or: [{ status: 'submitted' }, { status: 'expired', scorePercent: { $exists: true } }],
    };

    const scoredFilter = andFilters({ studentId }, scoredAttempt, colFilter);

    const [recentAttempts, practiceSessions, mastery, bookmarkCount, availableQuizzes, totalAttempts, totalPractice, avgAgg] = await Promise.all([
      db.collection('exam_prep_attempts')
        .find(scoredFilter)
        .sort({ submittedAt: -1 })
        .limit(5)
        .toArray(),
      db.collection('exam_prep_practice_sessions')
        .find(andFilters({ studentId, status: 'completed' }, colFilter))
        .sort({ completedAt: -1 })
        .limit(5)
        .toArray(),
      db.collection('exam_prep_mastery')
        .find(andFilters({ studentId }, colFilter))
        .sort({ updatedAt: -1 })
        .toArray(),
      db.collection('exam_prep_bookmarks').countDocuments(andFilters({ studentId }, colFilter)),
      db.collection('exam_prep_quizzes')
        .find(andFilters({ status: 'published' }, colFilter))
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray(),
      db.collection('exam_prep_attempts').countDocuments(scoredFilter),
      db.collection('exam_prep_practice_sessions').countDocuments(andFilters({ studentId, status: 'completed' }, colFilter)),
      // Average across every scored attempt, not just the five most recent.
      db.collection('exam_prep_attempts')
        .aggregate([
          { $match: scoredFilter },
          { $group: { _id: null, avg: { $avg: { $ifNull: ['$scorePercent', 0] } } } },
        ])
        .toArray(),
    ]);

    // Compute mastery scores per topic
    const topicMastery = mastery.map(m => ({
      topic: m.topic,
      total: m.totalAttempts,
      correct: m.correctAttempts,
      mastery_percent: m.totalAttempts ? Math.round((m.correctAttempts / m.totalAttempts) * 100) : 0,
    })).sort((a, b) => a.mastery_percent - b.mastery_percent);

    const weakAreas = topicMastery.filter(t => t.mastery_percent < 60).slice(0, 5);
    const strongAreas = [...topicMastery].sort((a, b) => b.mastery_percent - a.mastery_percent).slice(0, 3);

    const avgScore = Math.round(avgAgg[0]?.avg || 0);

    res.json({
      stats: {
        total_quiz_attempts: totalAttempts,
        total_practice_sessions: totalPractice,
        bookmarked_questions: bookmarkCount,
        average_score: avgScore,
        topics_mastered: topicMastery.filter(t => t.mastery_percent >= 80).length,
      },
      weak_areas: weakAreas,
      strong_areas: strongAreas,
      topic_mastery: topicMastery,
      recent_attempts: recentAttempts.map(a => ({
        id: String(a._id),
        quiz_id: String(a.quizId),
        quiz_title: a.quizTitle,
        score_percent: a.scorePercent,
        passed: a.passed,
        submitted_at: a.submittedAt,
        expired: a.status === 'expired',
      })),
      available_quizzes: availableQuizzes.map(serializeQuiz),
      recommendations: buildRecommendations(weakAreas, strongAreas),
    });
  });

  function buildRecommendations(weakAreas, strongAreas) {
    const recs = [];
    for (const area of weakAreas.slice(0, 3)) {
      recs.push({
        type: 'practice',
        priority: 'high',
        title: `Practice ${area.topic}`,
        body: `Your mastery for ${area.topic} is ${area.mastery_percent}%. Focused practice will help.`,
        action: `practice:${area.topic}`,
      });
    }
    if (strongAreas.length) {
      recs.push({
        type: 'advance',
        priority: 'medium',
        title: `Level up on ${strongAreas[0].topic}`,
        body: `You're strong here (${strongAreas[0].mastery_percent}%). Try harder difficulty questions.`,
        action: `advance:${strongAreas[0].topic}`,
      });
    }
    if (!recs.length) {
      recs.push({
        type: 'start',
        priority: 'medium',
        title: 'Start practicing',
        body: 'Take a few practice sessions to see personalized recommendations.',
        action: 'practice',
      });
    }
    return recs;
  }

  // GET /exam-prep/recommendations — AI-powered
  router.get('/recommendations', async (req, res) => {
    if (!requireStudent(req, res)) return;
    const db = getDB();
    const studentId = oid(req.user._id);
    const colFilter = collegeFilter(req);

    const mastery = await db.collection('exam_prep_mastery')
      .find(andFilters({ studentId }, colFilter))
      .toArray();

    const weakAreas = mastery
      .filter(m => m.totalAttempts >= 3)
      .map(m => ({ topic: m.topic, mastery: m.totalAttempts ? Math.round((m.correctAttempts / m.totalAttempts) * 100) : 0 }))
      .filter(m => m.mastery < 60)
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 5);

    if (!weakAreas.length) {
      return res.json({ recommendations: 'Keep up the great work! Try harder quizzes or explore new topics.', source: 'system' });
    }

    const prompt = `A student has the following weak areas in exam preparation:
${weakAreas.map(w => `- ${w.topic}: ${w.mastery}% mastery`).join('\n')}

Give 3 specific, actionable study recommendations to improve. For each, include:
1. What to study first
2. Suggested technique (spaced repetition, practice tests, etc.)
3. Estimated time needed

Be concise and encouraging. Keep to 150 words total.`;

    const aiResult = await generateAIResponse('study_coach', prompt, req.user._id);
    res.json({ recommendations: aiResult.response, weak_areas: weakAreas, source: aiResult.source });
  });

  return router;
}

module.exports = { createExamPrepRouter };
