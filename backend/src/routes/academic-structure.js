const express = require('express');
const { getDB, oid } = require('../db');
const { requireRole, collegeFilter } = require('../auth');
const { sendError, nowIso, paginationParams } = require('../utils');

/**
 * Structured academic management.
 *
 * Hierarchy: College → Academic session → Program (B.Tech/BCA/…) → Branch (CSE/…)
 *            → Year → Semester → Subject → Faculty assignment → Student enrollment.
 *
 * NOTE ON NAMING: the pre-existing `courses` collection is subject-level
 * (CS301 "Computer Networks") and is already referenced by attendance, exams,
 * assignments and timetable. It therefore stays the SUBJECT level here and is
 * extended with optional hierarchy fields; programs live in their own collection.
 * Every new field is optional so legacy documents keep working untouched.
 */

// Managing the structure is an administrative duty; faculty and students read.
const MANAGE = requireRole('college_admin', 'super_admin');
const READ = requireRole('college_admin', 'super_admin', 'faculty', 'student');

const SUBJECT_TYPES = ['theory', 'practical', 'lab', 'elective'];
const DEFAULT_SETTINGS = {
  allowCoTeaching: true,
  // Days back from today that faculty may correct. 0 = no window (open).
  attendanceCorrectionWindowDays: 0,
};

function createAcademicRouter() {
  const router = express.Router();

  // ── shared helpers ────────────────────────────────────────────────────────

  function normalizeName(value) {
    return String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  }

  function safeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    return !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
  }

  function toPositiveInt(value, fallback) {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return fallback;
    return n;
  }

  function initialsOf(name) {
    const words = normalizeName(name).split(' ').filter(Boolean);
    if (!words.length) return 'NA';
    if (words.length === 1) return words[0].substring(0, 4).toUpperCase();
    return words.map((w) => w[0]).join('').substring(0, 6).toUpperCase();
  }

  function slugCode(name) {
    return normalizeName(name).replace(/[^A-Za-z0-9]+/g, '').substring(0, 12).toUpperCase() || 'NEW';
  }

  /**
   * Loads a document by id, scoped to the caller's college. Returns a
   * discriminated result so handlers can bail with 400 (malformed) or 404
   * (missing *or* another tenant's — never leaking cross-college existence).
   */
  async function loadScoped(db, req, collection, rawId, label = 'record') {
    const id = oid(rawId);
    if (!id) return { status: 400, message: `Invalid ${label} id.` };
    const doc = await db.collection(collection).findOne({ _id: id, ...collegeFilter(req) });
    if (!doc) return { status: 404, message: `${label[0].toUpperCase()}${label.slice(1)} not found.` };
    return { doc };
  }

  /**
   * Loads a user by id. Unlike other collections, legacy users may carry no
   * collegeId at all (it was never backfilled), so those are treated as
   * unattached-but-visible rather than missing; users belonging to another
   * college are still never returned (tenant isolation).
   */
  async function loadUserScoped(db, req, rawId, label = 'user') {
    const id = oid(rawId);
    if (!id) return { status: 400, message: `Invalid ${label} id.` };
    const cid = oid(req.userCollegeId);
    const scope = req.isSuperAdmin || !cid
      ? {}
      : { $or: [{ collegeId: cid }, { collegeId: String(cid) }, { collegeId: null }, { collegeId: { $exists: false } }] };
    const doc = await db.collection('users').findOne({ _id: id, ...scope });
    if (!doc) return { status: 404, message: `${label[0].toUpperCase()}${label.slice(1)} not found.` };
    return { doc };
  }

  /** Resolves the college a new document belongs to (super admin may target one). */
  function targetCollegeId(req) {
    return oid(req.body && req.body.college_id) || oid(req.userCollegeId) || null;
  }

  async function getSettings(db, req) {
    const cid = oid(req.userCollegeId);
    if (!cid) return { ...DEFAULT_SETTINGS };
    const college = await db.collection('colleges').findOne({ _id: cid });
    return { ...DEFAULT_SETTINGS, ...(college && college.settings ? college.settings : {}) };
  }

  /** Course ids a faculty member is allowed to touch (owned + assigned). */
  async function taughtCourseIds(db, req, userId) {
    const uid = oid(userId);
    const values = [uid, String(userId)].filter(Boolean);
    const cf = collegeFilter(req);
    const [owned, assigned] = await Promise.all([
      db.collection('courses').find({ facultyId: { $in: values }, ...cf }).toArray(),
      db.collection('faculty_assignments').find({ facultyId: { $in: values }, ...cf }).toArray(),
    ]);
    return [...new Set([...owned.map((c) => String(c._id)), ...assigned.map((a) => String(a.courseId))])];
  }

  /** Course ids a student is enrolled in (via the subject-level enrollments). */
  async function enrolledCourseIds(db, req, userId) {
    const uid = oid(userId);
    const values = [uid, String(userId)].filter(Boolean);
    const rows = await db
      .collection('course_enrollments')
      .find({ studentId: { $in: values }, ...collegeFilter(req) })
      .toArray();
    return [...new Set(rows.map((r) => String(r.courseId)))];
  }

  /** Mongo needs both ObjectId and string forms to match legacy seeded rows. */
  function bothForms(ids) {
    const out = new Set();
    for (const raw of ids) {
      const asOid = oid(raw);
      if (asOid) out.add(asOid);
      out.add(raw);
    }
    return [...out];
  }

  async function validateSessions(db, req, raw) {
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const ids = [];
    for (const value of list) {
      const { status, doc } = await loadScoped(db, req, 'academic_sessions', value, 'academic session');
      if (status) return { status, message: 'Invalid academic session id.' };
      ids.push(doc._id);
    }
    if (!ids.length) {
      // New subjects default to the session flagged as current, if there is one.
      const current = await db
        .collection('academic_sessions')
        .findOne({ isCurrent: true, active: { $ne: false }, ...collegeFilter(req) });
      if (current) ids.push(current._id);
    }
    return { ids };
  }

  function serializeSession(doc) {
    return {
      id: String(doc._id),
      name: doc.name,
      start_date: doc.startDate || null,
      end_date: doc.endDate || null,
      active: doc.active !== false,
      is_current: !!doc.isCurrent,
      created_at: doc.createdAt,
    };
  }

  function serializeProgram(doc) {
    return {
      id: String(doc._id),
      code: doc.code,
      name: doc.name,
      level: doc.level || 'undergraduate',
      duration_years: doc.durationYears || 3,
      semesters_per_year: doc.semestersPerYear || 2,
      total_semesters: doc.totalSemesters || (doc.durationYears || 3) * (doc.semestersPerYear || 2),
      active: doc.active !== false,
      created_at: doc.createdAt,
    };
  }

  function serializeBranch(doc) {
    return {
      id: String(doc._id),
      program_id: String(doc.programId),
      name: doc.name,
      code: doc.code,
      active: doc.active !== false,
    };
  }

  function serializeSection(doc) {
    return {
      id: String(doc._id),
      program_id: String(doc.programId),
      branch_id: doc.branchId ? String(doc.branchId) : null,
      year: doc.year,
      name: doc.name,
      active: doc.active !== false,
    };
  }

  function serializeSubject(doc) {
    return {
      id: String(doc._id),
      code: doc.code,
      name: doc.name,
      program_id: doc.programId ? String(doc.programId) : null,
      branch_id: doc.branchId ? String(doc.branchId) : null,
      year: doc.year || null,
      semester: doc.semester || null,
      subject_type: doc.subjectType || 'theory',
      credits: doc.credits == null ? null : doc.credits,
      session_ids: (doc.sessionIds || []).map(String),
      active: doc.active !== false,
      department: doc.department || undefined,
      faculty_id: doc.facultyId ? String(doc.facultyId) : null,
    };
  }

  function serializeAssignment(doc, courseMap, facultyMap, sectionMap) {
    const course = courseMap.get(String(doc.courseId));
    const faculty = facultyMap.get(String(doc.facultyId));
    const section = sectionMap.get(String(doc.sectionId));
    return {
      id: String(doc._id),
      session_id: String(doc.sessionId),
      course_id: String(doc.courseId),
      course_name: course ? course.name : null,
      course_code: course ? course.code : null,
      program_id: doc.programId ? String(doc.programId) : null,
      branch_id: doc.branchId ? String(doc.branchId) : null,
      year: doc.year || null,
      semester: doc.semester || null,
      section_id: doc.sectionId ? String(doc.sectionId) : null,
      section_name: section ? section.name : null,
      faculty_id: String(doc.facultyId),
      faculty_name: faculty ? faculty.name : null,
      active: doc.active !== false,
      created_at: doc.createdAt,
    };
  }

  function serializeEnrollment(doc, userMap, sectionMap) {
    const user = userMap.get(String(doc.studentId));
    const section = sectionMap.get(String(doc.sectionId));
    return {
      id: String(doc._id),
      student_id: String(doc.studentId),
      student_name: user ? user.name : 'Unknown student',
      student_code: user && user.studentCode ? user.studentCode : null,
      session_id: String(doc.sessionId),
      program_id: String(doc.programId),
      branch_id: doc.branchId ? String(doc.branchId) : null,
      year: doc.year,
      semester: doc.semester,
      section_id: doc.sectionId ? String(doc.sectionId) : null,
      section_name: section ? section.name : null,
      status: doc.status || 'active',
      enrolled_at: doc.createdAt,
      promoted_to: doc.promotedTo || null,
    };
  }

  // ── Academic sessions ─────────────────────────────────────────────────────

  router.get('/academic/sessions', READ, async (req, res) => {
    const db = getDB();
    const filter = { ...collegeFilter(req) };
    if (req.query.active === '1') filter.active = { $ne: false };
    const sessions = await db
      .collection('academic_sessions')
      .find(filter)
      .sort({ startDate: -1, createdAt: -1 })
      .toArray();
    res.json(sessions.map(serializeSession));
  });

  router.post('/academic/sessions', MANAGE, async (req, res) => {
    const db = getDB();
    const name = normalizeName(req.body.name);
    if (!name) return sendError(res, 'Academic session name is required.', 400);

    const startDate = req.body.start_date || req.body.startDate;
    const endDate = req.body.end_date || req.body.endDate;
    if (startDate && !isValidDate(startDate)) return sendError(res, 'Start date must be YYYY-MM-DD.', 400);
    if (endDate && !isValidDate(endDate)) return sendError(res, 'End date must be YYYY-MM-DD.', 400);
    if (startDate && endDate && startDate > endDate) {
      return sendError(res, 'End date must be on or after the start date.', 400);
    }

    const collegeId = targetCollegeId(req);
    if (!collegeId) return sendError(res, 'Select a college first.', 400);

    const dupe = await db.collection('academic_sessions')
      .findOne({ collegeId, name: { $regex: `^${safeRegex(name)}$`, $options: 'i' } });
    if (dupe) return sendError(res, 'An academic session with this name already exists.', 409);

    const isCurrent = !!req.body.is_current;
    if (isCurrent) {
      await db.collection('academic_sessions').updateMany(
        { collegeId },
        { $set: { isCurrent: false } },
      );
    }

    const doc = {
      name,
      startDate: startDate || null,
      endDate: endDate || null,
      isCurrent,
      active: req.body.active === undefined ? true : !!req.body.active,
      collegeId,
      createdAt: nowIso(),
    };
    const { insertedId } = await db.collection('academic_sessions').insertOne(doc);
    res.status(201).json(serializeSession({ _id: insertedId, ...doc }));
  });

  router.put('/academic/sessions/:id', MANAGE, async (req, res) => {
    const db = getDB();
    const { status, message, doc } = await loadScoped(db, req, 'academic_sessions', req.params.id, 'academic session');
    if (status) return sendError(res, message, status);

    const $set = {};
    if (req.body.name !== undefined) {
      const name = normalizeName(req.body.name);
      if (!name) return sendError(res, 'Academic session name cannot be empty.', 400);
      const dupe = await db.collection('academic_sessions').findOne({
        collegeId: doc.collegeId,
        name: { $regex: `^${safeRegex(name)}$`, $options: 'i' },
        _id: { $ne: doc._id },
      });
      if (dupe) return sendError(res, 'An academic session with this name already exists.', 409);
      $set.name = name;
    }
    if (req.body.start_date !== undefined || req.body.startDate !== undefined) {
      const v = req.body.start_date || req.body.startDate;
      if (v && !isValidDate(v)) return sendError(res, 'Start date must be YYYY-MM-DD.', 400);
      $set.startDate = v || null;
    }
    if (req.body.end_date !== undefined || req.body.endDate !== undefined) {
      const v = req.body.end_date || req.body.endDate;
      if (v && !isValidDate(v)) return sendError(res, 'End date must be YYYY-MM-DD.', 400);
      $set.endDate = v || null;
    }
    if (req.body.active !== undefined) $set.active = !!req.body.active;

    if (req.body.is_current === true) {
      await db.collection('academic_sessions').updateMany(
        { collegeId: doc.collegeId, _id: { $ne: doc._id } },
        { $set: { isCurrent: false } },
      );
      $set.isCurrent = true;
    } else if (req.body.is_current === false) {
      $set.isCurrent = false;
    }

    await db.collection('academic_sessions').updateOne({ _id: doc._id }, { $set });
    res.json(serializeSession({ ...doc, ...$set }));
  });

  // ── Programs (the "Course" level: B.Tech, BCA, MBA …) ─────────────────────

  router.get('/academic/programs', READ, async (req, res) => {
    const db = getDB();
    const filter = { ...collegeFilter(req) };
    if (req.query.active === '1') filter.active = { $ne: false };
    const programs = await db.collection('programs').find(filter).sort({ name: 1 }).toArray();
    res.json(programs.map(serializeProgram));
  });

  router.post('/academic/programs', MANAGE, async (req, res) => {
    const db = getDB();
    const name = normalizeName(req.body.name);
    if (!name) return sendError(res, 'Programme name is required.', 400);

    const collegeId = targetCollegeId(req);
    if (!collegeId) return sendError(res, 'Select a college first.', 400);

    const dupe = await db.collection('programs')
      .findOne({ collegeId, name: { $regex: `^${safeRegex(name)}$`, $options: 'i' } });
    if (dupe) return sendError(res, 'A programme with this name already exists.', 409);

    const durationYears = toPositiveInt(req.body.durationYears ?? req.body.duration_years, 3);
    const semestersPerYear = toPositiveInt(req.body.semestersPerYear ?? req.body.semesters_per_year, 2);
    if (durationYears < 1 || durationYears > 10) return sendError(res, 'Duration must be between 1 and 10 years.', 400);
    if (semestersPerYear < 1 || semestersPerYear > 4) return sendError(res, 'Semesters per year must be between 1 and 4.', 400);

    const code = normalizeName(req.body.code) ? normalizeName(req.body.code).toUpperCase() : slugCode(name);
    const doc = {
      name,
      code,
      level: normalizeName(req.body.level) || 'undergraduate',
      durationYears,
      semestersPerYear,
      totalSemesters: toPositiveInt(req.body.totalSemesters ?? req.body.total_semesters, durationYears * semestersPerYear),
      active: req.body.active === undefined ? true : !!req.body.active,
      collegeId,
      createdAt: nowIso(),
    };
    const { insertedId } = await db.collection('programs').insertOne(doc);
    res.status(201).json(serializeProgram({ _id: insertedId, ...doc }));
  });

  router.put('/academic/programs/:id', MANAGE, async (req, res) => {
    const db = getDB();
    const { status, message, doc } = await loadScoped(db, req, 'programs', req.params.id, 'programme');
    if (status) return sendError(res, message, status);

    const $set = {};
    if (req.body.name !== undefined) {
      const name = normalizeName(req.body.name);
      if (!name) return sendError(res, 'Programme name cannot be empty.', 400);
      const dupe = await db.collection('programs').findOne({
        collegeId: doc.collegeId,
        name: { $regex: `^${safeRegex(name)}$`, $options: 'i' },
        _id: { $ne: doc._id },
      });
      if (dupe) return sendError(res, 'A programme with this name already exists.', 409);
      $set.name = name;
    }
    if (req.body.code !== undefined && normalizeName(req.body.code)) {
      $set.code = normalizeName(req.body.code).toUpperCase();
    }
    if (req.body.level !== undefined) $set.level = normalizeName(req.body.level) || 'undergraduate';
    if (req.body.duration_years !== undefined || req.body.durationYears !== undefined) {
      const v = toPositiveInt(req.body.duration_years ?? req.body.durationYears, doc.durationYears || 3);
      if (v < 1 || v > 10) return sendError(res, 'Duration must be between 1 and 10 years.', 400);
      $set.durationYears = v;
    }
    if (req.body.semesters_per_year !== undefined || req.body.semestersPerYear !== undefined) {
      const v = toPositiveInt(req.body.semesters_per_year ?? req.body.semestersPerYear, doc.semestersPerYear || 2);
      if (v < 1 || v > 4) return sendError(res, 'Semesters per year must be between 1 and 4.', 400);
      $set.semestersPerYear = v;
    }
    if (req.body.active !== undefined) $set.active = !!req.body.active;
    $set.totalSemesters = ($set.durationYears || doc.durationYears || 3) * ($set.semestersPerYear || doc.semestersPerYear || 2);

    await db.collection('programs').updateOne({ _id: doc._id }, { $set });
    res.json(serializeProgram({ ...doc, ...$set }));
  });

  // ── Branches ──────────────────────────────────────────────────────────────

  router.get('/academic/branches', READ, async (req, res) => {
    const db = getDB();
    const filter = { ...collegeFilter(req) };
    if (req.query.program_id || req.query.programId) {
      const pid = oid(req.query.program_id || req.query.programId);
      if (!pid) return sendError(res, 'Invalid program id.', 400);
      filter.programId = pid;
    }
    if (req.query.active === '1') filter.active = { $ne: false };
    const branches = await db.collection('branches').find(filter).sort({ code: 1, name: 1 }).toArray();
    res.json(branches.map(serializeBranch));
  });

  router.post('/academic/branches', MANAGE, async (req, res) => {
    const db = getDB();
    const name = normalizeName(req.body.name);
    if (!name) return sendError(res, 'Branch name is required.', 400);

    const { status, message, doc: program } = await loadScoped(db, req, 'programs', req.body.program_id ?? req.body.programId, 'programme');
    if (status) return sendError(res, message, status);

    const code = (normalizeName(req.body.code) || initialsOf(name)).toUpperCase();
    const dupe = await db.collection('branches').findOne({ programId: program._id, code });
    if (dupe) return sendError(res, `Branch code ${code} already exists in ${program.name}.`, 409);

    const doc = {
      programId: program._id,
      name,
      code,
      active: req.body.active === undefined ? true : !!req.body.active,
      collegeId: program.collegeId,
      createdAt: nowIso(),
    };
    const { insertedId } = await db.collection('branches').insertOne(doc);
    res.status(201).json(serializeBranch({ _id: insertedId, ...doc }));
  });

  router.put('/academic/branches/:id', MANAGE, async (req, res) => {
    const db = getDB();
    const { status, message, doc } = await loadScoped(db, req, 'branches', req.params.id, 'branch');
    if (status) return sendError(res, message, status);

    const $set = {};
    if (req.body.name !== undefined) {
      const name = normalizeName(req.body.name);
      if (!name) return sendError(res, 'Branch name cannot be empty.', 400);
      $set.name = name;
    }
    if (req.body.code !== undefined && normalizeName(req.body.code)) {
      const code = normalizeName(req.body.code).toUpperCase();
      const dupe = await db.collection('branches').findOne({ programId: doc.programId, code, _id: { $ne: doc._id } });
      if (dupe) return sendError(res, `Branch code ${code} already exists in this programme.`, 409);
      $set.code = code;
    }
    if (req.body.active !== undefined) $set.active = !!req.body.active;

    await db.collection('branches').updateOne({ _id: doc._id }, { $set });
    res.json(serializeBranch({ ...doc, ...$set }));
  });

  // ── Sections (class / division) ───────────────────────────────────────────

  router.get('/academic/sections', READ, async (req, res) => {
    const db = getDB();
    const filter = { ...collegeFilter(req) };
    const programId = req.query.program_id || req.query.programId;
    if (programId) {
      const pid = oid(programId);
      if (!pid) return sendError(res, 'Invalid program id.', 400);
      filter.programId = pid;
    }
    const branchId = req.query.branch_id || req.query.branchId;
    if (branchId) {
      const bid = oid(branchId);
      if (!bid) return sendError(res, 'Invalid branch id.', 400);
      filter.branchId = bid;
    }
    if (req.query.year) filter.year = toPositiveInt(req.query.year, 1);
    if (req.query.active === '1') filter.active = { $ne: false };
    const sections = await db.collection('sections').find(filter).sort({ year: 1, name: 1 }).toArray();
    res.json(sections.map(serializeSection));
  });

  router.post('/academic/sections', MANAGE, async (req, res) => {
    const db = getDB();
    const name = normalizeName(req.body.name).toUpperCase();
    const year = toPositiveInt(req.body.year, NaN);
    if (!name) return sendError(res, 'Section name is required.', 400);
    if (Number.isNaN(year) || year < 1 || year > 10) return sendError(res, 'A valid year (1-10) is required.', 400);

    const { status, message, doc: program } = await loadScoped(db, req, 'programs', req.body.program_id ?? req.body.programId, 'programme');
    if (status) return sendError(res, message, status);

    let branchId = null;
    if (req.body.branch_id ?? req.body.branchId) {
      const { status: bStatus, message: bMsg, doc: branch } = await loadScoped(db, req, 'branches', req.body.branch_id ?? req.body.branchId, 'branch');
      if (bStatus) return sendError(res, bMsg, bStatus);
      if (String(branch.programId) !== String(program._id)) {
        return sendError(res, 'That branch does not belong to the selected programme.', 400);
      }
      branchId = branch._id;
    }

    const dupe = await db.collection('sections').findOne({
      collegeId: program.collegeId,
      programId: program._id,
      branchId,
      year,
      name,
    });
    if (dupe) return sendError(res, `Section ${name} already exists for year ${year}.`, 409);

    const doc = {
      programId: program._id,
      branchId,
      year,
      name,
      active: req.body.active === undefined ? true : !!req.body.active,
      collegeId: program.collegeId,
      createdAt: nowIso(),
    };
    const { insertedId } = await db.collection('sections').insertOne(doc);
    res.status(201).json(serializeSection({ _id: insertedId, ...doc }));
  });

  router.put('/academic/sections/:id', MANAGE, async (req, res) => {
    const db = getDB();
    const { status, message, doc } = await loadScoped(db, req, 'sections', req.params.id, 'section');
    if (status) return sendError(res, message, status);

    const $set = {};
    if (req.body.name !== undefined) {
      const name = normalizeName(req.body.name).toUpperCase();
      if (!name) return sendError(res, 'Section name cannot be empty.', 400);
      $set.name = name;
    }
    if (req.body.year !== undefined) {
      const year = toPositiveInt(req.body.year, NaN);
      if (Number.isNaN(year) || year < 1 || year > 10) return sendError(res, 'A valid year (1-10) is required.', 400);
      $set.year = year;
    }
    if (req.body.active !== undefined) $set.active = !!req.body.active;

    await db.collection('sections').updateOne({ _id: doc._id }, { $set });
    res.json(serializeSection({ ...doc, ...$set }));
  });

  // ── Subjects (extends the existing `courses` collection) ──────────────────

  router.get('/academic/subjects', READ, async (req, res) => {
    const db = getDB();
    const user = req.user;
    const filter = { ...collegeFilter(req) };

    const sessionId = req.query.session_id || req.query.sessionId;
    if (sessionId) {
      const sid = oid(sessionId);
      if (!sid) return sendError(res, 'Invalid academic session id.', 400);
      filter.sessionIds = sid;
    }
    const programId = req.query.program_id || req.query.programId;
    if (programId) {
      const pid = oid(programId);
      if (!pid) return sendError(res, 'Invalid program id.', 400);
      filter.programId = pid;
    }
    const branchId = req.query.branch_id || req.query.branchId;
    if (branchId) {
      const bid = oid(branchId);
      if (!bid) return sendError(res, 'Invalid branch id.', 400);
      filter.branchId = bid;
    }
    if (req.query.year) filter.year = toPositiveInt(req.query.year, 1);
    if (req.query.semester) filter.semester = toPositiveInt(req.query.semester, 1);
    if (req.query.active === '1') filter.active = { $ne: false };
    if (req.query.q) {
      const rx = { $regex: safeRegex(req.query.q), $options: 'i' };
      // Wrapped in $and so the college's `$or` scope from collegeFilter survives.
      filter.$and = [{ $or: [{ name: rx }, { code: rx }] }];
    }

    // Faculty see only subjects they own or are assigned; students only what
    // they are enrolled in. Admins see the whole college.
    if (user.role === 'faculty') {
      filter._id = { $in: bothForms(await taughtCourseIds(db, req, user._id)) };
    } else if (user.role === 'student') {
      filter._id = { $in: bothForms(await enrolledCourseIds(db, req, user._id)) };
    }

    const subjects = await db.collection('courses').find(filter).sort({ semester: 1, name: 1 }).toArray();
    res.json(subjects.map(serializeSubject));
  });

  router.post('/academic/subjects', MANAGE, async (req, res) => {
    const db = getDB();
    const name = normalizeName(req.body.name);
    const code = normalizeName(req.body.code).toUpperCase();
    if (!name) return sendError(res, 'Subject name is required.', 400);
    if (!code) return sendError(res, 'Subject code is required.', 400);

    const collegeId = targetCollegeId(req);
    if (!collegeId) return sendError(res, 'Select a college first.', 400);

    // Subject code is unique within the college (application-level so legacy
    // documents with duplicate codes are never invalidated by an index).
    const dupe = await db.collection('courses').findOne({ collegeId, code });
    if (dupe) return sendError(res, `Subject code ${code} already exists in this college.`, 409);

    const { status, message, doc: program } = await loadScoped(db, req, 'programs', req.body.program_id ?? req.body.programId, 'programme');
    if (status) return sendError(res, message, status);

    let branch = null;
    if (req.body.branch_id ?? req.body.branchId) {
      const r = await loadScoped(db, req, 'branches', req.body.branch_id ?? req.body.branchId, 'branch');
      if (r.status) return sendError(res, r.message, r.status);
      if (String(r.doc.programId) !== String(program._id)) {
        return sendError(res, 'That branch does not belong to the selected programme.', 400);
      }
      branch = r.doc;
    }

    const year = toPositiveInt(req.body.year, NaN);
    const semester = toPositiveInt(req.body.semester, NaN);
    if (Number.isNaN(year) || year < 1 || year > 10) return sendError(res, 'A valid academic year (1-10) is required.', 400);
    if (Number.isNaN(semester) || semester < 1 || semester > 12) return sendError(res, 'A valid semester (1-12) is required.', 400);

    const subjectType = String(req.body.subject_type || req.body.subjectType || 'theory').toLowerCase();
    if (!SUBJECT_TYPES.includes(subjectType)) {
      return sendError(res, `Subject type must be one of: ${SUBJECT_TYPES.join(', ')}.`, 400);
    }

    const creditsRaw = req.body.credits;
    const credits = creditsRaw === undefined || creditsRaw === null || creditsRaw === '' ? 3 : Number(creditsRaw);
    if (Number.isNaN(credits) || credits < 0 || credits > 20) {
      return sendError(res, 'Credits must be a number between 0 and 20.', 400);
    }

    // Duplicate subject inside the applicable scope (session + program + branch
    // + year + semester), by name.
    const scopeRx = { $regex: `^${safeRegex(name)}$`, $options: 'i' };
    const scopeQuery = {
      programId: program._id,
      year,
      semester,
      name: scopeRx,
      ...collegeFilter(req),
    };
    if (branch) scopeQuery.branchId = branch._id;
    const scopeDupe = await db.collection('courses').findOne(scopeQuery);
    if (scopeDupe) {
      return sendError(res, `${name} already exists in year ${year}, semester ${semester} of ${program.name}.`, 409);
    }

    const sessions = await validateSessions(db, req, req.body.session_ids ?? req.body.sessionId);
    if (sessions.status) return sendError(res, sessions.message, sessions.status);

    const doc = {
      code,
      name,
      // Keep `department` meaningful for the legacy dashboards that group by it.
      department: branch ? (branch.code || branch.name) : (normalizeName(req.body.department) || ''),
      credits,
      semester,
      year,
      programId: program._id,
      branchId: branch ? branch._id : null,
      subjectType,
      sessionIds: sessions.ids,
      active: req.body.active === undefined ? true : !!req.body.active,
      facultyId: null,
      college: program.name,
      collegeId,
      createdAt: nowIso(),
    };
    const { insertedId } = await db.collection('courses').insertOne(doc);
    res.status(201).json(serializeSubject({ _id: insertedId, ...doc }));
  });

  router.put('/academic/subjects/:id', MANAGE, async (req, res) => {
    const db = getDB();
    const { status, message, doc } = await loadScoped(db, req, 'courses', req.params.id, 'subject');
    if (status) return sendError(res, message, status);

    // Only scalar curriculum fields are ever written here. Attendance records,
    // exams and timetable entries reference this id and are never touched, so
    // historical records survive any edit (1.3).
    const $set = {};

    if (req.body.name !== undefined) {
      const name = normalizeName(req.body.name);
      if (!name) return sendError(res, 'Subject name cannot be empty.', 400);
      $set.name = name;
    }
    if (req.body.code !== undefined) {
      const code = normalizeName(req.body.code).toUpperCase();
      if (!code) return sendError(res, 'Subject code cannot be empty.', 400);
      const dupe = await db.collection('courses').findOne({ collegeId: doc.collegeId, code, _id: { $ne: doc._id } });
      if (dupe) return sendError(res, `Subject code ${code} already exists in this college.`, 409);
      $set.code = code;
    }
    if (req.body.subject_type !== undefined || req.body.subjectType !== undefined) {
      const subjectType = String(req.body.subject_type || req.body.subjectType).toLowerCase();
      if (!SUBJECT_TYPES.includes(subjectType)) {
        return sendError(res, `Subject type must be one of: ${SUBJECT_TYPES.join(', ')}.`, 400);
      }
      $set.subjectType = subjectType;
    }
    if (req.body.credits !== undefined && req.body.credits !== '') {
      const credits = Number(req.body.credits);
      if (Number.isNaN(credits) || credits < 0 || credits > 20) {
        return sendError(res, 'Credits must be a number between 0 and 20.', 400);
      }
      $set.credits = credits;
    }
    if (req.body.year !== undefined) {
      const year = toPositiveInt(req.body.year, NaN);
      if (Number.isNaN(year) || year < 1 || year > 10) return sendError(res, 'A valid academic year (1-10) is required.', 400);
      $set.year = year;
    }
    if (req.body.semester !== undefined) {
      const semester = toPositiveInt(req.body.semester, NaN);
      if (Number.isNaN(semester) || semester < 1 || semester > 12) return sendError(res, 'A valid semester (1-12) is required.', 400);
      $set.semester = semester;
    }
    if (req.body.active !== undefined) $set.active = !!req.body.active;
    if (req.body.session_ids !== undefined || req.body.sessionId !== undefined) {
      const sessions = await validateSessions(db, req, req.body.session_ids ?? req.body.sessionId);
      if (sessions.status) return sendError(res, sessions.message, sessions.status);
      $set.sessionIds = sessions.ids;
    }
    if ((req.body.branch_id ?? req.body.branchId) !== undefined) {
      const raw = req.body.branch_id ?? req.body.branchId;
      if (raw) {
        const r = await loadScoped(db, req, 'branches', raw, 'branch');
        if (r.status) return sendError(res, r.message, r.status);
        $set.branchId = r.doc._id;
        $set.department = r.doc.code || r.doc.name;
      } else {
        $set.branchId = null;
      }
    }

    await db.collection('courses').updateOne({ _id: doc._id }, { $set });
    res.json(serializeSubject({ ...doc, ...$set }));
  });

  // ── Faculty assignments ───────────────────────────────────────────────────

  router.get('/academic/assignments', requireRole('college_admin', 'super_admin', 'faculty'), async (req, res) => {
    const db = getDB();
    const filter = { ...collegeFilter(req) };

    const sessionId = req.query.session_id || req.query.sessionId;
    if (sessionId) {
      const sid = oid(sessionId);
      if (!sid) return sendError(res, 'Invalid academic session id.', 400);
      filter.sessionId = sid;
    }
    const courseId = req.query.course_id || req.query.courseId;
    if (courseId) {
      const cid = oid(courseId);
      if (!cid) return sendError(res, 'Invalid subject id.', 400);
      filter.courseId = cid;
    }
    const sectionId = req.query.section_id || req.query.sectionId;
    if (sectionId) {
      const sec = oid(sectionId);
      if (!sec) return sendError(res, 'Invalid section id.', 400);
      filter.sectionId = sec;
    }
    if (req.query.active === '1') filter.active = { $ne: false };

    // Faculty only ever see their own assignments.
    if (req.user.role === 'faculty') filter.facultyId = { $in: [oid(req.user._id), String(req.user._id)].filter(Boolean) };
    else if (req.query.faculty_id || req.query.facultyId) {
      const fid = oid(req.query.faculty_id || req.query.facultyId);
      if (!fid) return sendError(res, 'Invalid faculty id.', 400);
      filter.facultyId = fid;
    }

    const rows = await db.collection('faculty_assignments').find(filter).sort({ createdAt: -1 }).toArray();

    const courseIds = [...new Set(rows.map((r) => String(r.courseId)))];
    const facultyIds = [...new Set(rows.map((r) => String(r.facultyId)))];
    const sectionIds = [...new Set(rows.map((r) => String(r.sectionId)).filter(Boolean))];

    const [courses, faculty, sections] = await Promise.all([
      courseIds.length
        ? db.collection('courses').find({ _id: { $in: bothForms(courseIds) } }).toArray()
        : Promise.resolve([]),
      facultyIds.length
        ? db.collection('users').find({ _id: { $in: bothForms(facultyIds) } }).toArray()
        : Promise.resolve([]),
      sectionIds.length
        ? db.collection('sections').find({ _id: { $in: bothForms(sectionIds) } }).toArray()
        : Promise.resolve([]),
    ]);

    const courseMap = new Map(courses.map((c) => [String(c._id), c]));
    const facultyMap = new Map(faculty.map((f) => [String(f._id), f]));
    const sectionMap = new Map(sections.map((s) => [String(s._id), s]));

    res.json(rows.map((row) => serializeAssignment(row, courseMap, facultyMap, sectionMap)));
  });

  router.post('/academic/assignments', MANAGE, async (req, res) => {
    const db = getDB();

    const sessionId = oid(req.body.session_id ?? req.body.sessionId);
    const courseId = oid(req.body.course_id ?? req.body.courseId);
    const facultyId = oid(req.body.faculty_id ?? req.body.facultyId);
    const sectionId = oid(req.body.section_id ?? req.body.sectionId);
    if (!sessionId) return sendError(res, 'Select an academic session.', 400);
    if (!courseId) return sendError(res, 'Select a subject.', 400);
    if (!facultyId) return sendError(res, 'Select a faculty member.', 400);
    if (!sectionId) return sendError(res, 'Select a section.', 400);

    const { status, message, doc: session } = await loadScoped(db, req, 'academic_sessions', sessionId, 'academic session');
    if (status) return sendError(res, message, status);
    const courseResult = await loadScoped(db, req, 'courses', courseId, 'subject');
    if (courseResult.status) return sendError(res, courseResult.message, courseResult.status);
    const facultyResult = await loadUserScoped(db, req, facultyId, 'faculty member');
    if (facultyResult.status) return sendError(res, facultyResult.message, facultyResult.status);
    const sectionResult = await loadScoped(db, req, 'sections', sectionId, 'section');
    if (sectionResult.status) return sendError(res, sectionResult.message, sectionResult.status);

    const course = courseResult.doc;
    const facultyUser = facultyResult.doc;
    const section = sectionResult.doc;

    if (facultyUser.role !== 'faculty' && facultyUser.role !== 'college_admin') {
      return sendError(res, 'Assignments can only be given to faculty members.', 400);
    }
    if (facultyUser.isActive === false || facultyUser.status === 'inactive') {
      return sendError(res, `${facultyUser.name}'s account is deactivated and cannot be assigned.`, 400);
    }
    if (course.active === false) {
      return sendError(res, 'This subject is inactive and cannot be assigned.', 400);
    }
    if (section.active === false) {
      return sendError(res, 'This section is inactive and cannot be assigned.', 400);
    }
    if (String(section.collegeId || '') !== String(course.collegeId || '')) {
      return sendError(res, 'Section and subject belong to different colleges.', 400);
    }

    const cf = collegeFilter(req);
    const exact = await db.collection('faculty_assignments').findOne({
      sessionId: session._id,
      courseId: course._id,
      sectionId: section._id,
      facultyId: facultyUser._id,
      active: { $ne: false },
      ...cf,
    });
    if (exact) return sendError(res, 'This faculty member is already assigned to that subject and section.', 409);

    // College policy may disallow co-teaching of one subject in one section.
    const settings = await getSettings(db, req);
    if (settings.allowCoTeaching === false) {
      const conflict = await db.collection('faculty_assignments').findOne({
        sessionId: session._id,
        courseId: course._id,
        sectionId: section._id,
        facultyId: { $ne: facultyUser._id },
        active: { $ne: false },
        ...cf,
      });
      if (conflict) {
        const other = await db.collection('users').findOne({ _id: conflict.facultyId }).catch(() => null);
        return sendError(
          res,
          `${course.name} is already taught in this section by ${other ? other.name : 'another faculty member'}.`,
          409,
        );
      }
    }

    const doc = {
      sessionId: session._id,
      courseId: course._id,
      sectionId: section._id,
      facultyId: facultyUser._id,
      programId: course.programId || null,
      branchId: course.branchId || section.branchId || null,
      year: course.year || section.year || null,
      semester: course.semester || null,
      active: true,
      collegeId: session.collegeId || course.collegeId,
      createdAt: nowIso(),
    };
    const { insertedId } = await db.collection('faculty_assignments').insertOne(doc);

    // Mirror onto the subject so legacy single-faculty views keep working.
    await db.collection('courses').updateOne(
      { _id: course._id, facultyId: null },
      { $set: { facultyId: facultyUser._id } },
    );

    res.status(201).json(serializeAssignment(
      { _id: insertedId, ...doc },
      new Map([[String(course._id), course]]),
      new Map([[String(facultyUser._id), facultyUser]]),
      new Map([[String(section._id), section]]),
    ));
  });

  router.put('/academic/assignments/:id', MANAGE, async (req, res) => {
    const db = getDB();
    const { status, message, doc } = await loadScoped(db, req, 'faculty_assignments', req.params.id, 'assignment');
    if (status) return sendError(res, message, status);

    const $set = {};
    if (req.body.faculty_id !== undefined || req.body.facultyId !== undefined) {
      const facultyResult = await loadUserScoped(db, req, req.body.faculty_id ?? req.body.facultyId, 'faculty member');
      if (facultyResult.status) return sendError(res, facultyResult.message, facultyResult.status);
      if (facultyResult.doc.role !== 'faculty') return sendError(res, 'Assignments can only be given to faculty members.', 400);
      if (facultyResult.doc.isActive === false || facultyResult.doc.status === 'inactive') {
        return sendError(res, `${facultyResult.doc.name}'s account is deactivated and cannot be assigned.`, 400);
      }
      $set.facultyId = facultyResult.doc._id;
    }
    if (req.body.section_id !== undefined || req.body.sectionId !== undefined) {
      const sectionResult = await loadScoped(db, req, 'sections', req.body.section_id ?? req.body.sectionId, 'section');
      if (sectionResult.status) return sendError(res, sectionResult.message, sectionResult.status);
      $set.sectionId = sectionResult.doc._id;
      $set.year = sectionResult.doc.year;
    }
    if (req.body.active !== undefined) $set.active = !!req.body.active;

    await db.collection('faculty_assignments').updateOne({ _id: doc._id }, { $set });

    const [courses, faculty, sections] = await Promise.all([
      db.collection('courses').findOne({ _id: doc.courseId }),
      db.collection('users').findOne({ _id: ($set.facultyId || doc.facultyId) }),
      db.collection('sections').findOne({ _id: ($set.sectionId || doc.sectionId) }),
    ]);
    res.json(serializeAssignment(
      { ...doc, ...$set },
      courses ? new Map([[String(courses._id), courses]]) : new Map(),
      faculty ? new Map([[String(faculty._id), faculty]]) : new Map(),
      sections ? new Map([[String(sections._id), sections]]) : new Map(),
    ));
  });

  // Soft-delete: the assignment stays for historical reporting but stops applying.
  router.delete('/academic/assignments/:id', MANAGE, async (req, res) => {
    const db = getDB();
    const { status, message, doc } = await loadScoped(db, req, 'faculty_assignments', req.params.id, 'assignment');
    if (status) return sendError(res, message, status);
    await db.collection('faculty_assignments').updateOne({ _id: doc._id }, { $set: { active: false } });
    res.json({ ok: true, id: String(doc._id), active: false });
  });

  // ── Student enrollment (structural) ───────────────────────────────────────

  async function enrollmentScope(db, req) {
    const user = req.user;
    if (user.role === 'student') return { studentIds: [String(user._id)] };
    if (user.role === 'faculty') {
      const taught = await taughtCourseIds(db, req, user._id);
      if (!taught.length) return { studentIds: [] };
      const rows = await db.collection('course_enrollments')
        .find({ courseId: { $in: bothForms(taught) }, ...collegeFilter(req) })
        .toArray();
      return { studentIds: [...new Set(rows.map((r) => String(r.studentId)))] };
    }
    return { studentIds: null }; // admins see their whole college
  }

  router.get('/academic/enrollments', READ, async (req, res) => {
    const db = getDB();
    const { skip, limit: pgLimit, page, pageSize } = paginationParams(req.query, { defaultSize: 50, maxSize: 200 });
    const filter = { ...collegeFilter(req) };

    const session = oid(req.query.session_id || req.query.sessionId);
    if (req.query.session_id || req.query.sessionId) {
      if (!session) return sendError(res, 'Invalid academic session id.', 400);
      filter.sessionId = session;
    }
    const program = oid(req.query.program_id || req.query.programId);
    if (req.query.program_id || req.query.programId) {
      if (!program) return sendError(res, 'Invalid program id.', 400);
      filter.programId = program;
    }
    const branch = oid(req.query.branch_id || req.query.branchId);
    if (req.query.branch_id || req.query.branchId) {
      if (!branch) return sendError(res, 'Invalid branch id.', 400);
      filter.branchId = branch;
    }
    const section = oid(req.query.section_id || req.query.sectionId);
    if (req.query.section_id || req.query.sectionId) {
      if (!section) return sendError(res, 'Invalid section id.', 400);
      filter.sectionId = section;
    }
    if (req.query.year) filter.year = toPositiveInt(req.query.year, 1);
    if (req.query.semester) filter.semester = toPositiveInt(req.query.semester, 1);
    // Default view = students currently in this structure; history
    // (promoted/withdrawn) is available via ?status=
    if (req.query.status) filter.status = String(req.query.status);
    else filter.status = 'active';

    const scope = await enrollmentScope(db, req);
    let scopeIds = scope.studentIds; // null = unrestricted (admin)

    // Name / roll-number search resolves against `users` BEFORE counting so the
    // pagination totals stay exact for the visible page set.
    const q = normalizeName(req.query.q);
    if (q) {
      const rx = { $regex: safeRegex(q), $options: 'i' };
      const cf = collegeFilter(req);
      const studentQuery = { role: 'student', $and: [{ $or: [{ name: rx }, { studentCode: rx }] }] };
      if (cf.$or) studentQuery.$and.push({ $or: cf.$or });
      const matched = await db.collection('users').find(studentQuery).toArray();
      const matchedIds = matched.map((u) => String(u._id));
      scopeIds = scopeIds ? matchedIds.filter((id) => scopeIds.includes(id)) : matchedIds;
    }

    if (scopeIds) {
      filter.studentId = { $in: bothForms(scopeIds) };
      if (!scopeIds.length) {
        return res.json({ items: [], total: 0, page, pageSize });
      }
    }

    const total = await db.collection('student_enrollments').countDocuments(filter);
    const rows = await db.collection('student_enrollments')
      .find(filter)
      .sort({ year: 1, semester: 1, studentId: 1 })
      .skip(skip)
      .limit(pgLimit)
      .toArray();

    const studentIds = [...new Set(rows.map((r) => String(r.studentId)))];
    const sectionIds = [...new Set(rows.map((r) => String(r.sectionId)).filter(Boolean))];
    const [users, sections] = await Promise.all([
      studentIds.length
        ? db.collection('users').find({ _id: { $in: bothForms(studentIds) } }).toArray()
        : Promise.resolve([]),
      sectionIds.length
        ? db.collection('sections').find({ _id: { $in: bothForms(sectionIds) } }).toArray()
        : Promise.resolve([]),
    ]);
    const userMap = new Map(users.map((u) => [String(u._id), u]));
    const sectionMap = new Map(sections.map((s) => [String(s._id), s]));

    res.json({
      items: rows.map((row) => serializeEnrollment(row, userMap, sectionMap)),
      total,
      page,
      pageSize,
    });
  });

  router.post('/academic/enrollments', MANAGE, async (req, res) => {
    const db = getDB();
    const sessionId = oid(req.body.session_id ?? req.body.sessionId);
    const programId = oid(req.body.program_id ?? req.body.programId);
    const year = toPositiveInt(req.body.year, NaN);
    const semester = toPositiveInt(req.body.semester, NaN);
    const rawStudentIds = Array.isArray(req.body.studentIds) ? req.body.studentIds : [];

    if (!sessionId) return sendError(res, 'Select an academic session.', 400);
    if (!programId) return sendError(res, 'Select a programme.', 400);
    if (Number.isNaN(year) || year < 1 || year > 10) return sendError(res, 'A valid year (1-10) is required.', 400);
    if (Number.isNaN(semester) || semester < 1 || semester > 12) return sendError(res, 'A valid semester (1-12) is required.', 400);
    if (!rawStudentIds.length) return sendError(res, 'Select at least one student.', 400);
    if (rawStudentIds.length > 500) return sendError(res, 'Enroll at most 500 students at a time.', 400);

    const sessionResult = await loadScoped(db, req, 'academic_sessions', sessionId, 'academic session');
    if (sessionResult.status) return sendError(res, sessionResult.message, sessionResult.status);
    const programResult = await loadScoped(db, req, 'programs', programId, 'programme');
    if (programResult.status) return sendError(res, programResult.message, programResult.status);

    let branchId = null;
    if (req.body.branch_id ?? req.body.branchId) {
      const r = await loadScoped(db, req, 'branches', req.body.branch_id ?? req.body.branchId, 'branch');
      if (r.status) return sendError(res, r.message, r.status);
      branchId = r.doc._id;
    }
    let sectionId = null;
    if (req.body.section_id ?? req.body.sectionId) {
      const r = await loadScoped(db, req, 'sections', req.body.section_id ?? req.body.sectionId, 'section');
      if (r.status) return sendError(res, r.message, r.status);
      sectionId = r.doc._id;
    }

    const cf = collegeFilter(req);
    const studentOids = [];
    const seen = new Set();
    for (const raw of rawStudentIds) {
      const id = oid(raw);
      if (!id) return sendError(res, 'One or more student ids are invalid.', 400);
      if (seen.has(String(id))) continue;
      seen.add(String(id));
      const student = await loadUserScoped(db, req, id, 'student');
      if (student.status) return sendError(res, 'One or more students were not found in this college.', student.status);
      if (student.doc.role !== 'student') return sendError(res, `${student.doc.name} is not a student.`, 400);
      studentOids.push(id);
    }

    let created = 0;
    let skipped = 0;
    for (const studentId of studentOids) {
      const existing = await db.collection('student_enrollments').findOne({
        studentId,
        sessionId: sessionResult.doc._id,
        year,
        semester,
        sectionId,
        status: { $ne: 'inactive' },
        ...cf,
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      await db.collection('student_enrollments').insertOne({
        studentId,
        sessionId: sessionResult.doc._id,
        programId: programResult.doc._id,
        branchId,
        year,
        semester,
        sectionId,
        status: 'active',
        collegeId: programResult.doc.collegeId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      created += 1;
    }

    res.status(201).json({ created, skipped, total: studentOids.length });
  });

  // Soft-withdraw an enrollment (never deletes — history is preserved).
  router.delete('/academic/enrollments/:id', MANAGE, async (req, res) => {
    const db = getDB();
    const { status, message, doc } = await loadScoped(db, req, 'student_enrollments', req.params.id, 'enrollment');
    if (status) return sendError(res, message, status);
    await db.collection('student_enrollments').updateOne(
      { _id: doc._id },
      { $set: { status: 'inactive', updatedAt: nowIso() } },
    );
    res.json({ ok: true, id: String(doc._id), status: 'inactive' });
  });

  /**
   * Promote students to the next year/semester. The previous enrollment document
   * is retained (marked `promoted`) and subject enrollments are left untouched,
   * so historical attendance stays attached to the semester it belongs to.
   */
  router.post('/academic/enrollments/promote', MANAGE, async (req, res) => {
    const db = getDB();
    const sessionId = oid(req.body.session_id ?? req.body.sessionId);
    const toYear = toPositiveInt(req.body.to_year ?? req.body.toYear, NaN);
    const toSemester = toPositiveInt(req.body.to_semester ?? req.body.toSemester, NaN);
    const rawStudentIds = Array.isArray(req.body.studentIds) ? req.body.studentIds : [];

    if (!sessionId) return sendError(res, 'Select an academic session.', 400);
    if (Number.isNaN(toYear) || toYear < 1 || toYear > 10) return sendError(res, 'A valid target year (1-10) is required.', 400);
    if (Number.isNaN(toSemester) || toSemester < 1 || toSemester > 12) return sendError(res, 'A valid target semester (1-12) is required.', 400);
    if (!rawStudentIds.length) return sendError(res, 'Select at least one student.', 400);
    if (rawStudentIds.length > 500) return sendError(res, 'Promote at most 500 students at a time.', 400);

    let toSectionId = null;
    if (req.body.to_section_id ?? req.body.toSectionId) {
      const r = await loadScoped(db, req, 'sections', req.body.to_section_id ?? req.body.toSectionId, 'section');
      if (r.status) return sendError(res, r.message, r.status);
      toSectionId = r.doc._id;
    }

    const cf = collegeFilter(req);
    const now = nowIso();
    let promoted = 0;
    let alreadyAtTarget = 0;

    for (const raw of rawStudentIds) {
      const studentId = oid(raw);
      if (!studentId) return sendError(res, 'One or more student ids are invalid.', 400);

      const target = await db.collection('student_enrollments').findOne({
        studentId,
        sessionId: oid(sessionId),
        year: toYear,
        semester: toSemester,
        status: { $ne: 'inactive' },
        ...cf,
      });
      if (target) {
        alreadyAtTarget += 1;
        continue;
      }

      const current = await db.collection('student_enrollments').findOne(
        { studentId, sessionId: oid(sessionId), status: 'active', ...cf },
        { sort: { year: -1, semester: -1 } },
      );
      if (!current) continue;

      await db.collection('student_enrollments').updateOne(
        { _id: current._id },
        {
          $set: {
            status: 'promoted',
            promotedAt: now,
            promotedTo: { year: toYear, semester: toSemester, sectionId: toSectionId },
            updatedAt: now,
          },
        },
      );
      await db.collection('student_enrollments').insertOne({
        studentId,
        sessionId: current.sessionId,
        programId: current.programId,
        branchId: current.branchId || null,
        year: toYear,
        semester: toSemester,
        sectionId: toSectionId,
        status: 'active',
        collegeId: current.collegeId,
        createdAt: now,
        updatedAt: now,
        promotedFrom: { year: current.year, semester: current.semester, sectionId: current.sectionId || null },
      });
      promoted += 1;
    }

    res.json({ promoted, already_at_target: alreadyAtTarget, total: rawStudentIds.length });
  });

  /**
   * Bulk subject enrollment: links students to `course_enrollments` so rosters,
   * attendance and dashboards see them. Deduplicates against both ObjectId and
   * string-keyed legacy rows.
   */
  router.post('/academic/enrollments/subjects', MANAGE, async (req, res) => {
    const db = getDB();
    const programId = oid(req.body.program_id ?? req.body.programId);
    const year = toPositiveInt(req.body.year, NaN);
    const semester = toPositiveInt(req.body.semester, NaN);
    if (Number.isNaN(year) || year < 1 || year > 10) return sendError(res, 'A valid year (1-10) is required.', 400);
    if (Number.isNaN(semester) || semester < 1 || semester > 12) return sendError(res, 'A valid semester (1-12) is required.', 400);

    const cf = collegeFilter(req);
    const rawCourseIds = Array.isArray(req.body.courseIds) && req.body.courseIds.length
      ? req.body.courseIds
      : null;

    let courseIds;
    if (rawCourseIds) {
      const docs = [];
      for (const raw of rawCourseIds) {
        const r = await loadScoped(db, req, 'courses', raw, 'subject');
        if (r.status) return sendError(res, r.message, r.status);
        docs.push(r.doc);
      }
      courseIds = docs.map((d) => d._id);
    } else {
      if (!programId) return sendError(res, 'Select a programme (or pass courseIds explicitly).', 400);
      const query = { programId: oid(programId), year, semester, active: { $ne: false }, ...cf };
      const branchId = oid(req.body.branch_id ?? req.body.branchId);
      if (req.body.branch_id ?? req.body.branchId) {
        if (!branchId) return sendError(res, 'Invalid branch id.', 400);
        query.branchId = branchId;
      }
      const docs = await db.collection('courses').find(query).toArray();
      if (!docs.length) return sendError(res, 'No active subjects found for that year and semester.', 404);
      courseIds = docs.map((d) => d._id);
    }

    // Target students: explicit list, or everyone active in the given structure.
    let studentOids;
    if (Array.isArray(req.body.studentIds) && req.body.studentIds.length) {
      studentOids = [];
      const seen = new Set();
      for (const raw of req.body.studentIds) {
        const id = oid(raw);
        if (!id) return sendError(res, 'One or more student ids are invalid.', 400);
        if (seen.has(String(id))) continue;
        seen.add(String(id));
        const student = await loadUserScoped(db, req, id, 'student');
        if (student.status) return sendError(res, 'One or more students were not found in this college.', student.status);
        if (student.doc.role !== 'student') return sendError(res, `${student.doc.name} is not a student.`, 400);
        studentOids.push(id);
      }
    } else {
      const query = { status: 'active', year, semester, ...cf };
      const sessionId = oid(req.body.session_id ?? req.body.sessionId);
      if (req.body.session_id ?? req.body.sessionId) {
        if (!sessionId) return sendError(res, 'Invalid academic session id.', 400);
        query.sessionId = sessionId;
      }
      if (programId) query.programId = programId;
      const branchId = oid(req.body.branch_id ?? req.body.branchId);
      if (req.body.branch_id ?? req.body.branchId) {
        if (!branchId) return sendError(res, 'Invalid branch id.', 400);
        query.branchId = branchId;
      }
      const sectionId = oid(req.body.section_id ?? req.body.sectionId);
      if (req.body.section_id ?? req.body.sectionId) {
        if (!sectionId) return sendError(res, 'Invalid section id.', 400);
        query.sectionId = sectionId;
      }
      const rows = await db.collection('student_enrollments').find(query).toArray();
      studentOids = [...new Set(rows.map((r) => r.studentId))];
      if (!studentOids.length) return sendError(res, 'No students found in that class structure.', 404);
    }

    const sessionId = oid(req.body.session_id ?? req.body.sessionId) || null;
    const collegeId = oid(req.userCollegeId);
    let created = 0;
    let skipped = 0;

    for (const studentId of studentOids) {
      for (const courseId of courseIds) {
        const existing = await db.collection('course_enrollments').findOne({
          studentId: { $in: [studentId, String(studentId)] },
          courseId: { $in: [courseId, String(courseId)] },
        });
        if (existing) {
          skipped += 1;
          continue;
        }
        await db.collection('course_enrollments').insertOne({
          studentId,
          courseId,
          sessionId,
          collegeId: existing ? undefined : collegeId,
          createdAt: nowIso(),
          enrolledAt: new Date(),
        });
        created += 1;
      }
    }

    res.status(201).json({
      created,
      skipped,
      students: studentOids.length,
      subjects: courseIds.length,
    });
  });

  // ── College settings (assignment + correction policy) ─────────────────────

  router.get('/academic/settings', MANAGE, async (req, res) => {
    res.json(await getSettings(getDB(), req));
  });

  router.put('/academic/settings', MANAGE, async (req, res) => {
    const db = getDB();
    const collegeId = oid(req.userCollegeId);
    if (!collegeId) return sendError(res, 'No college is linked to this account.', 400);

    const settings = await getSettings(db, req);
    if (req.body.allowCoTeaching !== undefined) settings.allowCoTeaching = !!req.body.allowCoTeaching;
    if (req.body.attendanceCorrectionWindowDays !== undefined && req.body.attendanceCorrectionWindowDays !== null) {
      const days = toPositiveInt(req.body.attendanceCorrectionWindowDays, NaN);
      if (Number.isNaN(days) || days < 0 || days > 3650) {
        return sendError(res, 'Correction window must be between 0 and 3650 days.', 400);
      }
      settings.attendanceCorrectionWindowDays = days;
    }

    await db.collection('colleges').updateOne({ _id: collegeId }, { $set: { settings } });
    res.json(settings);
  });

  return router;
}

module.exports = { createAcademicRouter };
