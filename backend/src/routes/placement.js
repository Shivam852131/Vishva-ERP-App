const express = require('express');
const { getDB, oid } = require('../db');
const { sendError, nowIso, roomForUser } = require('../utils');
const { requireRole } = require('../auth');
const { ensureCareerSeed, SKILL_BY_KEY, PLACEMENT_ROUNDS, departmentMatches } = require('../careerData');
const { getSkillMap } = require('../skillProfile');

const APPLICATION_STAGES = ['applied', 'shortlisted', 'in_process', 'offered', 'accepted', 'rejected', 'withdrawn'];

function serializeDrive(doc, extra = {}) {
  return {
    id: String(doc._id),
    company: doc.company,
    role: doc.role,
    sector: doc.sector || null,
    package_lpa: doc.packageLpa,
    package_label: doc.packageLabel,
    location: doc.location,
    job_type: doc.jobType,
    description: doc.description || '',
    min_cgpa: doc.minCgpa ?? null,
    min_attendance: doc.minAttendance ?? null,
    max_backlogs: doc.maxBacklogs ?? null,
    allowed_departments: doc.allowedDepartments || [],
    required_skills: (doc.requiredSkills || []).map(key => ({
      skill_key: key,
      name: SKILL_BY_KEY.get(key)?.name || key,
    })),
    rounds: doc.rounds || PLACEMENT_ROUNDS,
    deadline: doc.deadline,
    drive_date: doc.driveDate || null,
    openings: doc.openings ?? null,
    status: doc.status,
    application_count: doc.applicationCount || 0,
    created_at: doc.createdAt,
    ...extra,
  };
}

function serializeApplication(doc, extra = {}) {
  return {
    id: String(doc._id),
    drive_id: String(doc.driveId),
    student_id: String(doc.studentId),
    student_name: doc.studentName,
    company: doc.company,
    role: doc.role,
    package_label: doc.packageLabel,
    status: doc.status,
    current_round: doc.currentRound || 0,
    rounds: doc.rounds || [],
    resume_url: doc.resumeUrl || null,
    cover_note: doc.coverNote || null,
    applied_at: doc.appliedAt,
    updated_at: doc.updatedAt || doc.appliedAt,
    offer: doc.offer || null,
    timeline: doc.timeline || [],
    ...extra,
  };
}

// Eligibility is evaluated against the student's live academic record and
// verified skill profile — never against self-declared fields.
async function evaluateEligibility(drive, student, skillMap, academics) {
  const checks = [];

  if (drive.minCgpa != null) {
    const cgpa = academics.cgpa;
    checks.push({
      key: 'cgpa',
      label: `Minimum CGPA ${drive.minCgpa}`,
      required: String(drive.minCgpa),
      actual: cgpa == null ? 'Not available' : String(cgpa),
      passed: cgpa != null && cgpa >= drive.minCgpa,
    });
  }

  if (drive.minAttendance != null) {
    // A student with no attendance records yet has no evidence either way;
    // surface the check as unverified rather than locking them out.
    const unverified = academics.attendance == null;
    checks.push({
      key: 'attendance',
      label: `Minimum attendance ${drive.minAttendance}%`,
      required: `${drive.minAttendance}%`,
      actual: unverified ? 'Not available' : `${academics.attendance}%`,
      unverified,
      passed: unverified || academics.attendance >= drive.minAttendance,
    });
  }

  if (drive.maxBacklogs != null) {
    checks.push({
      key: 'backlogs',
      label: drive.maxBacklogs === 0 ? 'No active backlogs' : `At most ${drive.maxBacklogs} backlogs`,
      required: String(drive.maxBacklogs),
      actual: String(academics.backlogs),
      passed: academics.backlogs <= drive.maxBacklogs,
    });
  }

  if ((drive.allowedDepartments || []).length) {
    checks.push({
      key: 'department',
      label: `Open to ${drive.allowedDepartments.join(', ')}`,
      required: drive.allowedDepartments.join(', '),
      actual: student.department || 'Not set',
      passed: departmentMatches(drive.allowedDepartments, student.department),
    });
  }

  const skillGaps = (drive.requiredSkills || [])
    .map(key => ({
      skill_key: key,
      name: SKILL_BY_KEY.get(key)?.name || key,
      score: skillMap.get(key)?.score || 0,
    }))
    .filter(s => s.score < 50);

  const hardChecks = checks.filter(c => !c.passed);

  return {
    eligible: hardChecks.length === 0,
    checks,
    failed_checks: hardChecks.map(c => c.label),
    skill_gaps: skillGaps,
    // Skill readiness is advisory — it does not block the application.
    skill_readiness: (drive.requiredSkills || []).length
      ? Math.round(
          drive.requiredSkills.reduce((sum, key) => sum + (skillMap.get(key)?.score || 0), 0) /
            drive.requiredSkills.length,
        )
      : 100,
  };
}

async function loadAcademics(student) {
  const db = getDB();
  const studentId = student._id;
  const sid = oid(studentId);

  const [records, results] = await Promise.all([
    db.collection('attendance_records').find({ $or: [{ studentId: sid }, { studentId: String(studentId) }] }).toArray(),
    db.collection('exam_results').find({ $or: [{ studentId: sid }, { studentId: String(studentId) }] }).toArray(),
  ]);

  const attendance = records.length
    ? Math.round((records.filter(r => r.status === 'present').length / records.length) * 100)
    : null;

  // Exam results store raw marks; convert the mean to a 10-point CGPA. Fall back
  // to the CGPA on the student record when no results have been published yet.
  const cgpa = results.length
    ? Number(((results.reduce((sum, r) => sum + (r.marks || 0), 0) / results.length) / 10).toFixed(2))
    : (typeof student.cgpa === 'number' ? student.cgpa : null);

  const backlogs = results.filter(r => {
    const max = r.maxMarks || r.max_marks || 100;
    return (r.marks || 0) < max * 0.4;
  }).length;

  return { attendance, cgpa, backlogs };
}

function createPlacementRouter(io) {
  const router = express.Router();

  router.get('/drives', async (req, res) => {
    const db = getDB();
    await ensureCareerSeed(db);

    const { status, jobType, sector, minPackage, search, eligibleOnly } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (jobType) filter.jobType = jobType;
    if (sector) filter.sector = sector;
    if (minPackage) filter.packageLpa = { $gte: Number(minPackage) };
    if (search) {
      filter.$or = [
        { company: { $regex: String(search), $options: 'i' } },
        { role: { $regex: String(search), $options: 'i' } },
      ];
    }

    const drives = await db.collection('placement_drives').find(filter).sort({ deadline: 1 }).toArray();

    const [skillMap, academics, myApplications] = await Promise.all([
      getSkillMap(req.user._id),
      loadAcademics(req.user),
      db.collection('placement_applications').find({ studentId: oid(req.user._id) }).toArray(),
    ]);

    const appliedMap = new Map(myApplications.map(a => [String(a.driveId), a]));

    const enriched = await Promise.all(drives.map(async drive => {
      const eligibility = await evaluateEligibility(drive, req.user, skillMap, academics);
      const application = appliedMap.get(String(drive._id));
      const daysLeft = Math.ceil((new Date(drive.deadline) - Date.now()) / 86400000);

      return serializeDrive(drive, {
        eligibility,
        applied: !!application,
        application_status: application?.status || null,
        application_id: application ? String(application._id) : null,
        days_left: daysLeft,
        closing_soon: daysLeft >= 0 && daysLeft <= 3,
      });
    }));

    res.json(eligibleOnly === 'true' ? enriched.filter(d => d.eligibility.eligible) : enriched);
  });

  router.get('/drives/:id', async (req, res) => {
    const db = getDB();
    const drive = await db.collection('placement_drives').findOne({ _id: oid(req.params.id) });
    if (!drive) return sendError(res, 'Drive not found.', 404);

    const [skillMap, academics, application] = await Promise.all([
      getSkillMap(req.user._id),
      loadAcademics(req.user),
      db.collection('placement_applications').findOne({ driveId: drive._id, studentId: oid(req.user._id) }),
    ]);

    const eligibility = await evaluateEligibility(drive, req.user, skillMap, academics);
    res.json(serializeDrive(drive, {
      eligibility,
      applied: !!application,
      application: application ? serializeApplication(application) : null,
      days_left: Math.ceil((new Date(drive.deadline) - Date.now()) / 86400000),
    }));
  });

  router.post('/drives', requireRole('college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const { company, role, packageLpa, packageLabel, location, jobType, description, minCgpa, minAttendance, maxBacklogs, allowedDepartments, requiredSkills, rounds, deadline, driveDate, openings, sector } = req.body || {};
    if (!company || !role) return sendError(res, 'company and role are required.', 400);
    if (!deadline) return sendError(res, 'deadline is required.', 400);

    const doc = {
      company,
      role,
      sector: sector || null,
      packageLpa: Number(packageLpa) || 0,
      packageLabel: packageLabel || (packageLpa ? `₹${packageLpa} LPA` : 'Not disclosed'),
      location: location || 'Not specified',
      jobType: jobType || 'full_time',
      description: description || '',
      minCgpa: minCgpa != null ? Number(minCgpa) : null,
      minAttendance: minAttendance != null ? Number(minAttendance) : null,
      maxBacklogs: maxBacklogs != null ? Number(maxBacklogs) : null,
      allowedDepartments: Array.isArray(allowedDepartments) ? allowedDepartments : [],
      requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : [],
      rounds: Array.isArray(rounds) && rounds.length ? rounds : PLACEMENT_ROUNDS,
      deadline,
      driveDate: driveDate || null,
      openings: openings != null ? Number(openings) : null,
      status: 'open',
      applicationCount: 0,
      createdBy: oid(req.user._id),
      createdAt: nowIso(),
    };

    const { insertedId } = await db.collection('placement_drives').insertOne(doc);
    const payload = serializeDrive({ ...doc, _id: insertedId });
    io.emit('placement:drive-created', payload);
    res.status(201).json(payload);
  });

  router.patch('/drives/:id', requireRole('college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const allowed = ['company', 'role', 'packageLpa', 'packageLabel', 'location', 'jobType', 'description', 'minCgpa', 'minAttendance', 'maxBacklogs', 'allowedDepartments', 'requiredSkills', 'rounds', 'deadline', 'driveDate', 'openings', 'status'];
    const patch = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }
    if (!Object.keys(patch).length) return sendError(res, 'Nothing to update.', 400);

    const result = await db.collection('placement_drives').updateOne({ _id: oid(req.params.id) }, { $set: patch });
    if (!result.matchedCount) return sendError(res, 'Drive not found.', 404);

    const updated = await db.collection('placement_drives').findOne({ _id: oid(req.params.id) });
    res.json(serializeDrive(updated));
  });

  router.delete('/drives/:id', requireRole('college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const result = await db.collection('placement_drives').deleteOne({ _id: oid(req.params.id) });
    if (!result.deletedCount) return sendError(res, 'Drive not found.', 404);
    await db.collection('placement_applications').deleteMany({ driveId: oid(req.params.id) });
    res.json({ success: true });
  });

  // ── Applications ───────────────────────────────────────────────────────────
  router.post('/drives/:id/apply', async (req, res) => {
    const db = getDB();
    const drive = await db.collection('placement_drives').findOne({ _id: oid(req.params.id) });
    if (!drive) return sendError(res, 'Drive not found.', 404);
    if (drive.status !== 'open') return sendError(res, 'This drive is no longer accepting applications.', 409);
    if (new Date(drive.deadline) < new Date()) return sendError(res, 'The application deadline has passed.', 409);

    const existing = await db.collection('placement_applications').findOne({
      driveId: drive._id,
      studentId: oid(req.user._id),
    });
    if (existing) return sendError(res, 'You have already applied to this drive.', 409);

    const [skillMap, academics] = await Promise.all([getSkillMap(req.user._id), loadAcademics(req.user)]);
    const eligibility = await evaluateEligibility(drive, req.user, skillMap, academics);
    if (!eligibility.eligible) {
      return sendError(res, `You do not meet the criteria: ${eligibility.failed_checks.join('; ')}`, 403);
    }

    const doc = {
      driveId: drive._id,
      studentId: oid(req.user._id),
      studentName: req.user.name,
      studentEmail: req.user.email,
      department: req.user.department || null,
      company: drive.company,
      role: drive.role,
      packageLabel: drive.packageLabel,
      status: 'applied',
      currentRound: 0,
      rounds: (drive.rounds || PLACEMENT_ROUNDS).map(name => ({ name, status: 'pending', scheduledAt: null, feedback: null })),
      resumeUrl: req.body?.resumeUrl || null,
      coverNote: req.body?.coverNote || null,
      snapshot: { cgpa: academics.cgpa, attendance: academics.attendance, skill_readiness: eligibility.skill_readiness },
      timeline: [{ event: 'Applied', at: nowIso(), note: null }],
      appliedAt: nowIso(),
      updatedAt: nowIso(),
    };

    const { insertedId } = await db.collection('placement_applications').insertOne(doc);
    await db.collection('placement_drives').updateOne({ _id: drive._id }, { $inc: { applicationCount: 1 } });

    const payload = serializeApplication({ ...doc, _id: insertedId });
    io.to(roomForUser(req.user._id)).emit('placement:application-created', payload);
    res.status(201).json(payload);
  });

  router.get('/applications', async (req, res) => {
    const db = getDB();
    const isStaff = ['college_admin', 'super_admin', 'collegeAdmin', 'superadmin'].includes(req.user.role);

    const filter = isStaff && req.query.scope === 'all' ? {} : { studentId: oid(req.user._id) };
    if (req.query.driveId) filter.driveId = oid(req.query.driveId);
    if (req.query.status) filter.status = req.query.status;

    const applications = await db.collection('placement_applications')
      .find(filter)
      .sort({ appliedAt: -1 })
      .limit(300)
      .toArray();

    res.json(applications.map(a => serializeApplication(a)));
  });

  router.get('/applications/:id', async (req, res) => {
    const db = getDB();
    const application = await db.collection('placement_applications').findOne({ _id: oid(req.params.id) });
    if (!application) return sendError(res, 'Application not found.', 404);

    const isStaff = ['college_admin', 'super_admin', 'collegeAdmin', 'superadmin'].includes(req.user.role);
    if (!isStaff && String(application.studentId) !== String(req.user._id)) {
      return sendError(res, 'You do not have permission to view this application.', 403);
    }

    const drive = await db.collection('placement_drives').findOne({ _id: application.driveId });
    res.json({ ...serializeApplication(application), drive: drive ? serializeDrive(drive) : null });
  });

  router.post('/applications/:id/withdraw', async (req, res) => {
    const db = getDB();
    const application = await db.collection('placement_applications').findOne({
      _id: oid(req.params.id),
      studentId: oid(req.user._id),
    });
    if (!application) return sendError(res, 'Application not found.', 404);
    if (['offered', 'accepted'].includes(application.status)) {
      return sendError(res, 'Contact the placement cell to withdraw after an offer.', 409);
    }

    await db.collection('placement_applications').updateOne(
      { _id: application._id },
      {
        $set: { status: 'withdrawn', updatedAt: nowIso() },
        $push: { timeline: { event: 'Withdrawn by student', at: nowIso(), note: null } },
      },
    );
    await db.collection('placement_drives').updateOne({ _id: application.driveId }, { $inc: { applicationCount: -1 } });
    res.json({ success: true });
  });

  router.patch('/applications/:id/status', requireRole('college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const { status, roundIndex, roundStatus, feedback, scheduledAt, offer, note } = req.body || {};

    const application = await db.collection('placement_applications').findOne({ _id: oid(req.params.id) });
    if (!application) return sendError(res, 'Application not found.', 404);

    const update = { updatedAt: nowIso() };
    const timeline = [];

    if (status) {
      if (!APPLICATION_STAGES.includes(status)) return sendError(res, 'Invalid status.', 400);
      update.status = status;
      timeline.push({ event: `Status changed to ${status}`, at: nowIso(), note: note || null });
    }

    if (roundIndex != null) {
      const index = Number(roundIndex);
      const rounds = application.rounds || [];
      if (!Number.isInteger(index) || index < 0 || index >= rounds.length) {
        return sendError(res, 'Invalid round index.', 400);
      }
      rounds[index] = {
        ...rounds[index],
        status: roundStatus || 'cleared',
        feedback: feedback ?? rounds[index].feedback,
        scheduledAt: scheduledAt ?? rounds[index].scheduledAt,
      };
      update.rounds = rounds;
      update.currentRound = roundStatus === 'cleared' ? Math.min(index + 1, rounds.length) : index;
      timeline.push({ event: `${rounds[index].name}: ${roundStatus || 'cleared'}`, at: nowIso(), note: feedback || null });

      if (roundStatus === 'cleared' && index === rounds.length - 1 && !status) {
        update.status = 'offered';
      } else if (roundStatus === 'failed' && !status) {
        update.status = 'rejected';
      } else if (!status && application.status === 'applied') {
        update.status = 'in_process';
      }
    }

    if (offer) update.offer = offer;

    await db.collection('placement_applications').updateOne(
      { _id: application._id },
      timeline.length ? { $set: update, $push: { timeline: { $each: timeline } } } : { $set: update },
    );

    const updated = await db.collection('placement_applications').findOne({ _id: application._id });
    const payload = serializeApplication(updated);
    io.to(roomForUser(application.studentId)).emit('placement:application-updated', payload);
    res.json(payload);
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  router.get('/stats', async (req, res) => {
    const db = getDB();
    await ensureCareerSeed(db);

    const isStaff = ['college_admin', 'super_admin', 'collegeAdmin', 'superadmin'].includes(req.user.role);
    const filter = isStaff ? {} : { studentId: oid(req.user._id) };

    const [applications, drives] = await Promise.all([
      db.collection('placement_applications').find(filter).toArray(),
      db.collection('placement_drives').find({}).toArray(),
    ]);

    const offers = applications.filter(a => ['offered', 'accepted'].includes(a.status));
    const openDrives = drives.filter(d => d.status === 'open' && new Date(d.deadline) >= new Date());
    const packages = offers
      .map(a => drives.find(d => String(d._id) === String(a.driveId))?.packageLpa)
      .filter(p => typeof p === 'number' && p > 0);

    res.json({
      open_drives: openDrives.length,
      total_drives: drives.length,
      applications: applications.length,
      shortlisted: applications.filter(a => a.status === 'shortlisted').length,
      in_process: applications.filter(a => a.status === 'in_process').length,
      offers: offers.length,
      rejected: applications.filter(a => a.status === 'rejected').length,
      conversion_rate: applications.length ? Math.round((offers.length / applications.length) * 100) : 0,
      highest_package: packages.length ? Math.max(...packages) : 0,
      average_package: packages.length
        ? Number((packages.reduce((sum, p) => sum + p, 0) / packages.length).toFixed(1))
        : 0,
      by_stage: APPLICATION_STAGES.map(stage => ({
        stage,
        count: applications.filter(a => a.status === stage).length,
      })),
      top_recruiters: Object.entries(
        applications.reduce((acc, a) => {
          acc[a.company] = (acc[a.company] || 0) + 1;
          return acc;
        }, {}),
      )
        .map(([company, count]) => ({ company, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    });
  });

  return router;
}

module.exports = { createPlacementRouter };
