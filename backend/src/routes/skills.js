const express = require('express');
const { getDB, oid } = require('../db');
const { sendError, nowIso, roomForUser } = require('../utils');
const { requireRole } = require('../auth');
const { ensureCareerSeed } = require('../careerData');
const {
  allSkillsCatalog,
  getSkillEntries,
  decorateSkill,
  getSkillMap,
  upsertSkill,
  buildCareerMatches,
  clamp,
} = require('../skillProfile');

function roomForLive(sessionId) {
  return `live:${String(sessionId)}`;
}

const STAFF_ROLES = ['faculty', 'college_admin', 'super_admin', 'collegeAdmin', 'superadmin'];

// Resolves whose profile the caller may read. Staff may pass ?studentId freely;
// a parent only for their own child. Sends the error response and returns null on denial.
async function resolveStudentId(req, res) {
  const requested = req.query.studentId;
  if (!requested) return req.user._id;

  if (STAFF_ROLES.includes(req.user.role)) return requested;

  if (req.user.role === 'parent') {
    const child = await getDB().collection('users')
      .findOne({ _id: oid(requested), parentId: oid(req.user._id) });
    if (!child) {
      sendError(res, 'You do not have permission to view this profile.', 403);
      return null;
    }
    return requested;
  }

  return req.user._id;
}

// ── Skill profile + career dashboard ──────────────────────────────────────────
function createSkillsRouter(io) {
  const router = express.Router();

  router.get('/catalog', async (_req, res) => {
    res.json(allSkillsCatalog());
  });

  router.get('/profile', async (req, res) => {
    const db = getDB();
    const studentId = await resolveStudentId(req, res);
    if (!studentId) return;

    const [entries, certifications, projects, endorsements] = await Promise.all([
      getSkillEntries(studentId),
      db.collection('student_certifications').find({ studentId: oid(studentId) }).sort({ issuedAt: -1 }).toArray(),
      db.collection('student_projects').find({ studentId: oid(studentId) }).sort({ createdAt: -1 }).toArray(),
      db.collection('skill_endorsements').find({ studentId: oid(studentId) }).sort({ createdAt: -1 }).limit(50).toArray(),
    ]);

    const skills = entries.map(decorateSkill).sort((a, b) => b.score - a.score);
    const verified = skills.filter(s => s.verified).length;
    const avg = skills.length ? Math.round(skills.reduce((sum, s) => sum + s.score, 0) / skills.length) : 0;

    res.json({
      skills,
      summary: {
        total_skills: skills.length,
        verified_skills: verified,
        average_score: avg,
        top_skill: skills[0] || null,
        certifications: certifications.length,
        projects: projects.length,
        endorsements: endorsements.length,
      },
      certifications: certifications.map(c => ({
        id: String(c._id),
        title: c.title,
        issuer: c.issuer,
        skill_key: c.skillKey || null,
        credential_id: c.credentialId || null,
        credential_url: c.credentialUrl || null,
        issued_at: c.issuedAt,
        expires_at: c.expiresAt || null,
        source: c.source || 'external',
      })),
      projects: projects.map(p => ({
        id: String(p._id),
        title: p.title,
        description: p.description,
        skills: p.skills || [],
        repo_url: p.repoUrl || null,
        demo_url: p.demoUrl || null,
        created_at: p.createdAt,
      })),
      endorsements: endorsements.map(e => ({
        id: String(e._id),
        skill_key: e.skillKey,
        endorser_name: e.endorserName,
        endorser_role: e.endorserRole,
        note: e.note || null,
        created_at: e.createdAt,
      })),
    });
  });

  router.put('/profile/:skillKey', async (req, res) => {
    const { selfRating } = req.body || {};
    if (typeof selfRating !== 'number') return sendError(res, 'selfRating must be a number 0-100.', 400);

    const updated = await upsertSkill(req.user._id, req.params.skillKey, { selfRating: clamp(selfRating) });
    if (!updated) return sendError(res, 'Unknown skill.', 404);
    io.to(roomForUser(req.user._id)).emit('skills:updated', { skillKey: req.params.skillKey, skill: updated });
    res.json(updated);
  });

  router.delete('/profile/:skillKey', async (req, res) => {
    const db = getDB();
    await db.collection('student_skills').deleteOne({ studentId: oid(req.user._id), skillKey: req.params.skillKey });
    io.to(roomForUser(req.user._id)).emit('skills:removed', { skillKey: req.params.skillKey });
    res.json({ success: true });
  });

  // Faculty and mentors vouch for a student's skill; students cannot self-endorse.
  router.post('/endorse', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
    const db = getDB();
    const { studentId, skillKey, note } = req.body || {};
    if (!studentId || !skillKey) return sendError(res, 'studentId and skillKey are required.', 400);
    if (String(studentId) === String(req.user._id)) return sendError(res, 'You cannot endorse yourself.', 400);

    const existing = await db.collection('skill_endorsements').findOne({
      studentId: oid(studentId),
      skillKey,
      endorserId: oid(req.user._id),
    });
    if (existing) return sendError(res, 'You have already endorsed this skill.', 409);

    const doc = {
      studentId: oid(studentId),
      skillKey,
      endorserId: oid(req.user._id),
      endorserName: req.user.name,
      endorserRole: req.user.role,
      note: note || null,
      createdAt: nowIso(),
    };
    const { insertedId } = await db.collection('skill_endorsements').insertOne(doc);

    const count = await db.collection('skill_endorsements').countDocuments({ studentId: oid(studentId), skillKey });
    await upsertSkill(studentId, skillKey, { endorsementCount: count });

    io.to(roomForUser(studentId)).emit('skills:endorsed', { skillKey, endorserName: req.user.name });
    res.status(201).json({ id: String(insertedId), ...doc, studentId: String(studentId) });
  });

  router.post('/certifications', async (req, res) => {
    const db = getDB();
    const { title, issuer, skillKey, credentialId, credentialUrl, issuedAt, expiresAt } = req.body || {};
    if (!title || !issuer) return sendError(res, 'title and issuer are required.', 400);

    const doc = {
      studentId: oid(req.user._id),
      title,
      issuer,
      skillKey: skillKey || null,
      credentialId: credentialId || null,
      credentialUrl: credentialUrl || null,
      issuedAt: issuedAt || nowIso(),
      expiresAt: expiresAt || null,
      source: 'external',
      createdAt: nowIso(),
    };
    const { insertedId } = await db.collection('student_certifications').insertOne(doc);
    io.to(roomForUser(req.user._id)).emit('skills:certifications-changed', { action: 'added', certification: { id: String(insertedId), ...doc, studentId: String(req.user._id) } });
    res.status(201).json({ id: String(insertedId), ...doc, studentId: String(req.user._id) });
  });

  router.delete('/certifications/:id', async (req, res) => {
    const db = getDB();
    const result = await db.collection('student_certifications').deleteOne({
      _id: oid(req.params.id),
      studentId: oid(req.user._id),
    });
    if (!result.deletedCount) return sendError(res, 'Certification not found.', 404);
    io.to(roomForUser(req.user._id)).emit('skills:certifications-changed', { action: 'removed', certificationId: req.params.id });
    res.json({ success: true });
  });

  router.post('/projects', async (req, res) => {
    const db = getDB();
    const { title, description, skills, repoUrl, demoUrl } = req.body || {};
    if (!title) return sendError(res, 'title is required.', 400);

    const doc = {
      studentId: oid(req.user._id),
      title,
      description: description || '',
      skills: Array.isArray(skills) ? skills : [],
      repoUrl: repoUrl || null,
      demoUrl: demoUrl || null,
      createdAt: nowIso(),
    };
    const { insertedId } = await db.collection('student_projects').insertOne(doc);
    io.to(roomForUser(req.user._id)).emit('skills:projects-changed', { action: 'added', project: { id: String(insertedId), ...doc, studentId: String(req.user._id) } });
    res.status(201).json({ id: String(insertedId), ...doc, studentId: String(req.user._id) });
  });

  router.delete('/projects/:id', async (req, res) => {
    const db = getDB();
    const result = await db.collection('student_projects').deleteOne({
      _id: oid(req.params.id),
      studentId: oid(req.user._id),
    });
    if (!result.deletedCount) return sendError(res, 'Project not found.', 404);
    io.to(roomForUser(req.user._id)).emit('skills:projects-changed', { action: 'removed', projectId: req.params.id });
    res.json({ success: true });
  });

  router.get('/career-matches', async (req, res) => {
    res.json(await buildCareerMatches(req.user._id));
  });

  return router;
}

// ── Career readiness dashboard ────────────────────────────────────────────────
function createCareerRouter() {
  const router = express.Router();

  router.get('/dashboard', async (req, res) => {
    const db = getDB();
    await ensureCareerSeed(db);
    const studentId = oid(req.user._id);

    const [skillMap, matches, applications, attempts, connections, sessions, certifications, projects] = await Promise.all([
      getSkillMap(req.user._id),
      buildCareerMatches(req.user._id),
      db.collection('placement_applications').find({ studentId }).sort({ appliedAt: -1 }).toArray(),
      db.collection('assessment_attempts').find({ studentId, status: 'submitted' }).sort({ submittedAt: -1 }).toArray(),
      db.collection('mentorship_connections').find({ studentId }).toArray(),
      db.collection('mentorship_sessions').find({ studentId }).sort({ scheduledAt: 1 }).toArray(),
      db.collection('student_certifications').countDocuments({ studentId }),
      db.collection('student_projects').countDocuments({ studentId }),
    ]);

    const skills = [...skillMap.values()];
    const verifiedSkills = skills.filter(s => s.verified);
    const avgSkill = skills.length ? skills.reduce((sum, s) => sum + s.score, 0) / skills.length : 0;

    const activeApplications = applications.filter(a => !['rejected', 'withdrawn'].includes(a.status));
    const offers = applications.filter(a => a.status === 'offered' || a.status === 'accepted');
    const passedAttempts = attempts.filter(a => a.passed);
    const activeConnections = connections.filter(c => c.status === 'active');
    const upcomingSessions = sessions.filter(s => s.status === 'scheduled' && new Date(s.scheduledAt) >= new Date());

    // Readiness is five weighted pillars, each capped at 100 before weighting.
    const pillars = [
      {
        key: 'skills',
        label: 'Skill Depth',
        weight: 0.3,
        score: Math.round(avgSkill),
        detail: `${skills.length} skills tracked, ${verifiedSkills.length} verified`,
      },
      {
        key: 'assessments',
        label: 'Verified Assessments',
        weight: 0.2,
        score: Math.round(clamp((passedAttempts.length / 5) * 100)),
        detail: `${passedAttempts.length} of 5 recommended assessments passed`,
      },
      {
        key: 'applications',
        label: 'Placement Activity',
        weight: 0.2,
        score: Math.round(clamp((applications.length / 5) * 100)),
        detail: `${applications.length} drives applied, ${activeApplications.length} active`,
      },
      {
        key: 'portfolio',
        label: 'Portfolio Evidence',
        weight: 0.15,
        score: Math.round(clamp(((certifications + projects) / 6) * 100)),
        detail: `${projects} projects, ${certifications} certifications`,
      },
      {
        key: 'mentorship',
        label: 'Mentorship',
        weight: 0.15,
        score: Math.round(clamp((sessions.filter(s => s.status === 'completed').length / 4) * 100)),
        detail: `${activeConnections.length} active mentors, ${sessions.filter(s => s.status === 'completed').length} sessions done`,
      },
    ];

    const readiness = Math.round(pillars.reduce((sum, p) => sum + p.score * p.weight, 0));
    const topMatch = matches[0] || null;

    const recommendations = [];
    for (const pillar of [...pillars].sort((a, b) => a.score - b.score)) {
      if (pillar.score >= 80) continue;
      if (pillar.key === 'skills') {
        const gap = topMatch?.gaps?.[0];
        recommendations.push({
          key: 'skills',
          priority: 'high',
          title: gap ? `Strengthen ${gap.name}` : 'Add skills to your profile',
          body: gap
            ? `${gap.name} is a core requirement for ${topMatch.title} and you are ${gap.gap} points short.`
            : 'Rate your skills and take an assessment so employers can see verified proficiency.',
          action: 'skill-profile',
        });
      }
      if (pillar.key === 'assessments') {
        recommendations.push({
          key: 'assessments',
          priority: passedAttempts.length ? 'medium' : 'high',
          title: 'Take a verified skill assessment',
          body: 'Verified scores carry six times the weight of self-ratings in your skill profile.',
          action: 'skill-assessment',
        });
      }
      if (pillar.key === 'applications') {
        recommendations.push({
          key: 'applications',
          priority: 'medium',
          title: 'Apply to more drives',
          body: 'Students who apply to five or more drives are three times more likely to convert an offer.',
          action: 'placement',
        });
      }
      if (pillar.key === 'portfolio') {
        recommendations.push({
          key: 'portfolio',
          priority: 'medium',
          title: 'Add a project to your portfolio',
          body: 'Recruiters look for evidence. Two shipped projects beat ten listed skills.',
          action: 'skill-profile',
        });
      }
      if (pillar.key === 'mentorship') {
        recommendations.push({
          key: 'mentorship',
          priority: 'low',
          title: 'Book a mentorship session',
          body: 'A mentor in your target track can compress months of trial and error.',
          action: 'mentorship',
        });
      }
    }

    const pipeline = ['applied', 'shortlisted', 'in_process', 'offered', 'rejected'].map(stage => ({
      stage,
      count: applications.filter(a => a.status === stage).length,
    }));

    res.json({
      readiness_score: readiness,
      readiness_label: readiness >= 80 ? 'Placement Ready'
        : readiness >= 60 ? 'Nearly Ready'
        : readiness >= 40 ? 'Building Up'
        : 'Getting Started',
      pillars,
      top_matches: matches.slice(0, 4),
      skill_gaps: (topMatch?.gaps || []).slice(0, 5),
      pipeline,
      stats: {
        applications: applications.length,
        active_applications: activeApplications.length,
        offers: offers.length,
        assessments_passed: passedAttempts.length,
        assessments_taken: attempts.length,
        verified_skills: verifiedSkills.length,
        certifications,
        projects,
        active_mentors: activeConnections.length,
        upcoming_sessions: upcomingSessions.length,
      },
      upcoming_sessions: upcomingSessions.slice(0, 3).map(s => ({
        id: String(s._id),
        topic: s.topic,
        mentor_name: s.mentorName,
        scheduled_at: s.scheduledAt,
        duration_minutes: s.durationMinutes,
      })),
      recommendations: recommendations.slice(0, 5),
      recent_activity: [
        ...applications.slice(0, 3).map(a => ({
          type: 'application',
          title: `Applied to ${a.company} — ${a.role}`,
          at: a.appliedAt,
          status: a.status,
        })),
        ...attempts.slice(0, 3).map(a => ({
          type: 'assessment',
          title: `${a.assessmentTitle}: ${a.scorePercent}%`,
          at: a.submittedAt,
          status: a.passed ? 'passed' : 'failed',
        })),
      ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 6),
    });
  });

  return router;
}

module.exports = { createSkillsRouter, createCareerRouter, roomForLive };
