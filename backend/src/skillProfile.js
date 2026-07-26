const { getDB, oid } = require('./db');
const { SKILLS, SKILL_BY_KEY, CAREER_TRACKS, levelForScore } = require('./careerData');

// A student's proficiency in one skill is a weighted blend of three signals.
// Self-rating is deliberately the weakest so the profile can't be inflated.
const WEIGHT_ASSESSMENT = 0.6;
const WEIGHT_ENDORSEMENT = 0.2;
const WEIGHT_SELF = 0.2;

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function endorsementScore(count) {
  // Diminishing returns: 1 endorsement is meaningful, the 10th much less so.
  const n = Math.max(0, Number(count) || 0);
  return clamp(Math.round(100 * (1 - Math.exp(-n / 4))));
}

function computeSkillScore(entry) {
  const hasAssessment = typeof entry.assessmentScore === 'number';
  const hasSelf = typeof entry.selfRating === 'number';
  const endorsements = endorsementScore(entry.endorsementCount);

  let total = 0;
  let weight = 0;

  if (hasAssessment) {
    total += clamp(entry.assessmentScore) * WEIGHT_ASSESSMENT;
    weight += WEIGHT_ASSESSMENT;
  }
  if (entry.endorsementCount) {
    total += endorsements * WEIGHT_ENDORSEMENT;
    weight += WEIGHT_ENDORSEMENT;
  }
  if (hasSelf) {
    total += clamp(entry.selfRating) * WEIGHT_SELF;
    weight += WEIGHT_SELF;
  }

  if (!weight) return 0;
  return Math.round(total / weight);
}

function decorateSkill(entry) {
  const meta = SKILL_BY_KEY.get(entry.skillKey);
  const score = computeSkillScore(entry);
  const level = levelForScore(score);
  return {
    skill_key: entry.skillKey,
    name: meta?.name || entry.skillKey,
    category: meta?.category || 'core_engineering',
    score,
    level: level.level,
    level_label: level.label,
    self_rating: entry.selfRating ?? null,
    assessment_score: entry.assessmentScore ?? null,
    assessment_count: entry.assessmentCount || 0,
    endorsement_count: entry.endorsementCount || 0,
    verified: typeof entry.assessmentScore === 'number',
    updated_at: entry.updatedAt || null,
  };
}

async function getSkillEntries(studentId) {
  const db = getDB();
  return db.collection('student_skills').find({ studentId: oid(studentId) }).toArray();
}

async function getSkillMap(studentId) {
  const entries = await getSkillEntries(studentId);
  const map = new Map();
  for (const entry of entries) map.set(entry.skillKey, decorateSkill(entry));
  return map;
}

async function upsertSkill(studentId, skillKey, patch) {
  const db = getDB();
  if (!SKILL_BY_KEY.has(skillKey)) return null;

  await db.collection('student_skills').updateOne(
    { studentId: oid(studentId), skillKey },
    {
      $set: { ...patch, updatedAt: new Date().toISOString() },
      $setOnInsert: { studentId: oid(studentId), skillKey, createdAt: new Date().toISOString() },
    },
    { upsert: true },
  );

  const entry = await db.collection('student_skills').findOne({ studentId: oid(studentId), skillKey });
  return decorateSkill(entry);
}

// Called after an assessment is submitted. Keeps a rolling best-of so a bad
// retake never destroys a verified result, but tracks attempt count.
async function applyAssessmentResult(studentId, skillKey, scorePercent) {
  const db = getDB();
  if (!SKILL_BY_KEY.has(skillKey)) return null;

  const existing = await db.collection('student_skills').findOne({ studentId: oid(studentId), skillKey });
  const best = Math.max(clamp(scorePercent), existing?.assessmentScore ?? 0);

  return upsertSkill(studentId, skillKey, {
    assessmentScore: best,
    lastAssessmentScore: clamp(scorePercent),
    assessmentCount: (existing?.assessmentCount || 0) + 1,
  });
}

function trackMatch(track, skillMap) {
  const core = track.coreSkills.map(key => ({
    skill_key: key,
    name: SKILL_BY_KEY.get(key)?.name || key,
    score: skillMap.get(key)?.score || 0,
    verified: !!skillMap.get(key)?.verified,
    required: true,
  }));
  const support = track.supportSkills.map(key => ({
    skill_key: key,
    name: SKILL_BY_KEY.get(key)?.name || key,
    score: skillMap.get(key)?.score || 0,
    verified: !!skillMap.get(key)?.verified,
    required: false,
  }));

  const coreAvg = core.length ? core.reduce((sum, s) => sum + s.score, 0) / core.length : 0;
  const supportAvg = support.length ? support.reduce((sum, s) => sum + s.score, 0) / support.length : 0;
  const match = Math.round(coreAvg * 0.75 + supportAvg * 0.25);

  const gaps = [...core, ...support]
    .filter(s => s.score < 60)
    .sort((a, b) => (a.required === b.required ? a.score - b.score : a.required ? -1 : 1))
    .map(s => ({ ...s, gap: 60 - s.score }));

  return {
    key: track.key,
    title: track.title,
    category: track.category,
    description: track.description,
    salary_range: track.salaryRange,
    growth: track.growth,
    education: track.education,
    match,
    core_skills: core,
    support_skills: support,
    gaps,
  };
}

async function buildCareerMatches(studentId) {
  const skillMap = await getSkillMap(studentId);
  return CAREER_TRACKS.map(track => trackMatch(track, skillMap)).sort((a, b) => b.match - a.match);
}

function allSkillsCatalog() {
  return SKILLS.map(s => ({ skill_key: s.key, name: s.name, category: s.category }));
}

module.exports = {
  computeSkillScore,
  decorateSkill,
  getSkillEntries,
  getSkillMap,
  upsertSkill,
  applyAssessmentResult,
  buildCareerMatches,
  trackMatch,
  allSkillsCatalog,
  clamp,
};
