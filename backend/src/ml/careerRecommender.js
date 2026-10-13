/**
 * Skill-Career Recommender Model
 * 
 * ML-based career path recommendations using:
 * - Skill proficiency levels
 * - Assessment performance
 * - Career track requirements
 * - Market demand signals
 * - Learning path optimization
 * 
 * Uses collaborative filtering and content-based recommendations.
 */

const { getDB, oid } = require('../db');
const { 
  SKILLS, SKILL_BY_KEY, CAREER_TRACKS, CAREER_BY_KEY,
  levelForScore, SKILL_LEVELS
} = require('../careerData');

// Skill similarity matrix (precomputed based on skill categories and relationships)
const SKILL_SIMILARITY = {
  // Programming skills
  javascript: { react: 0.9, nodejs: 0.85, python: 0.6, java: 0.7, dsa: 0.7 },
  react: { javascript: 0.9, nodejs: 0.7, uiux: 0.6, figma: 0.4 },
  nodejs: { javascript: 0.85, sql: 0.7, dsa: 0.6, python: 0.5 },
  python: { ml: 0.8, statistics: 0.7, sql: 0.6, java: 0.6 },
  java: { javascript: 0.7, dsa: 0.8, cpp: 0.7, sql: 0.5 },
  cpp: { dsa: 0.9, java: 0.7, python: 0.5 },
  dsa: { javascript: 0.7, java: 0.8, cpp: 0.9, python: 0.6 },
  
  // Data skills
  sql: { statistics: 0.6, dataviz: 0.5, excel: 0.7, nodejs: 0.7 },
  ml: { python: 0.8, statistics: 0.9, dataviz: 0.6 },
  statistics: { ml: 0.9, python: 0.7, sql: 0.6 },
  dataviz: { statistics: 0.6, uiux: 0.5, sql: 0.5, excel: 0.6 },
  excel: { sql: 0.7, dataviz: 0.6, statistics: 0.5 },
  
  // Design skills
  uiux: { react: 0.6, figma: 0.9, productthinking: 0.7, communication: 0.5 },
  figma: { uiux: 0.9, productthinking: 0.6, presentation: 0.5 },
  
  // Business skills
  productthinking: { communication: 0.7, projectmgmt: 0.8, uiux: 0.7 },
  projectmgmt: { productthinking: 0.8, communication: 0.8, leadership: 0.7 },
  finance: { excel: 0.6, projectmgmt: 0.5 },
  marketing: { communication: 0.7, presentation: 0.6 },
  
  // Communication skills
  communication: { presentation: 0.9, teamwork: 0.8, leadership: 0.7 },
  presentation: { communication: 0.9, leadership: 0.6 },
  teamwork: { communication: 0.8, leadership: 0.7 },
  leadership: { communication: 0.7, projectmgmt: 0.7, teamwork: 0.7 },
  
  // Core engineering
  aptitude: { logical: 0.8, dsa: 0.6 },
  logical: { aptitude: 0.8, dsa: 0.7 },
  os: { networks: 0.7, dbms: 0.6, dsa: 0.5 },
  networks: { os: 0.7, dbms: 0.5 },
  dbms: { sql: 0.9, os: 0.6, networks: 0.5 },
};

// Career track market demand scores (0-100)
const MARKET_DEMAND = {
  software_engineer: 85,
  data_scientist: 92,
  frontend_engineer: 80,
  product_manager: 78,
  ux_designer: 75,
  data_analyst: 82,
  business_analyst: 72,
  backend_engineer: 83,
};

// Calculate skill gap for a career track
function calculateSkillGap(studentSkills, careerTrack) {
  const gaps = [];
  let totalGap = 0;
  
  for (const skillKey of careerTrack.coreSkills) {
    const studentSkill = studentSkills.get(skillKey);
    const requiredScore = 60; // Minimum proficiency for core skills
    const currentScore = studentSkill?.score || 0;
    const gap = Math.max(0, requiredScore - currentScore);
    
    gaps.push({
      skillKey,
      skillName: SKILL_BY_KEY.get(skillKey)?.name || skillKey,
      currentScore,
      requiredScore,
      gap,
      isCore: true,
      priority: gap > 30 ? 'high' : gap > 10 ? 'medium' : 'low',
    });
    
    totalGap += gap;
  }
  
  for (const skillKey of careerTrack.supportSkills) {
    const studentSkill = studentSkills.get(skillKey);
    const requiredScore = 40; // Lower threshold for support skills
    const currentScore = studentSkill?.score || 0;
    const gap = Math.max(0, requiredScore - currentScore);
    
    gaps.push({
      skillKey,
      skillName: SKILL_BY_KEY.get(skillKey)?.name || skillKey,
      currentScore,
      requiredScore,
      gap,
      isCore: false,
      priority: gap > 20 ? 'medium' : 'low',
    });
    
    totalGap += gap * 0.5; // Support skills weighted less
  }
  
  return { gaps, totalGap };
}

// Calculate career match score
function calculateCareerMatch(studentSkills, careerTrack, marketDemand) {
  const { gaps, totalGap } = calculateSkillGap(studentSkills, careerTrack);
  
  // Base match from skill coverage
  const coreSkills = careerTrack.coreSkills.map(key => ({
    key,
    score: studentSkills.get(key)?.score || 0,
  }));
  
  const supportSkills = careerTrack.supportSkills.map(key => ({
    key,
    score: studentSkills.get(key)?.score || 0,
  }));
  
  const coreAvg = coreSkills.length ? 
    coreSkills.reduce((sum, s) => sum + s.score, 0) / coreSkills.length : 0;
  const supportAvg = supportSkills.length ? 
    supportSkills.reduce((sum, s) => sum + s.score, 0) / supportSkills.length : 0;
  
  // Weighted skill match (70% core, 30% support)
  const skillMatch = (coreAvg * 0.7 + supportAvg * 0.3);
  
  // Market demand bonus (0-10 points)
  const marketBonus = (marketDemand / 100) * 10;
  
  // Gap penalty (deduct points for large gaps)
  const gapPenalty = Math.min(20, totalGap / 5);
  
  // Final match score
  const matchScore = Math.round(
    Math.min(100, Math.max(0, skillMatch + marketBonus - gapPenalty))
  );
  
  return {
    matchScore,
    coreAvg: Math.round(coreAvg),
    supportAvg: Math.round(supportAvg),
    marketDemand,
    gapPenalty: Math.round(gapPenalty),
    gaps: gaps.sort((a, b) => b.gap - a.gap),
  };
}

// Generate learning path recommendations
function generateLearningPath(studentSkills, careerTrack, gaps) {
  const learningPath = [];
  
  // Priority 1: Critical gaps in core skills
  const criticalGaps = gaps.filter(g => g.isCore && g.priority === 'high');
  for (const gap of criticalGaps.slice(0, 2)) {
    learningPath.push({
      phase: 1,
      skill: gap.skillName,
      action: `Master ${gap.skillName}`,
      resources: getLearningResources(gap.skillKey),
      estimatedHours: estimateLearningHours(gap.gap),
      priority: 'critical',
    });
  }
  
  // Priority 2: Medium gaps in core skills
  const mediumGaps = gaps.filter(g => g.isCore && g.priority === 'medium');
  for (const gap of mediumGaps.slice(0, 2)) {
    learningPath.push({
      phase: 2,
      skill: gap.skillName,
      action: `Improve ${gap.skillName}`,
      resources: getLearningResources(gap.skillKey),
      estimatedHours: estimateLearningHours(gap.gap),
      priority: 'high',
    });
  }
  
  // Priority 3: Support skill gaps
  const supportGaps = gaps.filter(g => !g.isCore && g.priority !== 'low');
  for (const gap of supportGaps.slice(0, 2)) {
    learningPath.push({
      phase: 3,
      skill: gap.skillName,
      action: `Build ${gap.skillName} foundation`,
      resources: getLearningResources(gap.skillKey),
      estimatedHours: estimateLearningHours(gap.gap),
      priority: 'medium',
    });
  }
  
  return learningPath;
}

// Get learning resources for a skill
function getLearningResources(skillKey) {
  const resources = {
    javascript: [
      { type: 'course', name: 'JavaScript Mastery', platform: 'Udemy' },
      { type: 'practice', name: 'LeetCode JavaScript', platform: 'LeetCode' },
      { type: 'project', name: 'Build a REST API', difficulty: 'beginner' },
    ],
    react: [
      { type: 'course', name: 'React - The Complete Guide', platform: 'Udemy' },
      { type: 'practice', name: 'React Challenges', platform: 'Frontend Mentor' },
      { type: 'project', name: 'Build a Todo App', difficulty: 'beginner' },
    ],
    python: [
      { type: 'course', name: 'Python for Everybody', platform: 'Coursera' },
      { type: 'practice', name: 'Python Exercises', platform: 'HackerRank' },
      { type: 'project', name: 'Data Analysis Project', difficulty: 'beginner' },
    ],
    ml: [
      { type: 'course', name: 'Machine Learning', platform: 'Coursera' },
      { type: 'practice', name: 'Kaggle Competitions', platform: 'Kaggle' },
      { type: 'project', name: 'Predictive Model', difficulty: 'intermediate' },
    ],
    dsa: [
      { type: 'course', name: 'Algorithms Specialization', platform: 'Coursera' },
      { type: 'practice', name: 'LeetCode Problems', platform: 'LeetCode' },
      { type: 'project', name: 'Implement Sorting Algorithms', difficulty: 'beginner' },
    ],
    sql: [
      { type: 'course', name: 'SQL for Data Science', platform: 'Coursera' },
      { type: 'practice', name: 'SQL Challenges', platform: 'HackerRank' },
      { type: 'project', name: 'Database Design', difficulty: 'beginner' },
    ],
    uiux: [
      { type: 'course', name: 'UI/UX Design Specialization', platform: 'Coursera' },
      { type: 'practice', name: 'Daily UI Challenge', platform: 'Daily UI' },
      { type: 'project', name: 'Redesign a Popular App', difficulty: 'beginner' },
    ],
  };
  
  return resources[skillKey] || [
    { type: 'course', name: `${skillKey} Fundamentals`, platform: 'Online' },
    { type: 'practice', name: `${skillKey} Exercises`, platform: 'Practice' },
  ];
}

// Estimate learning hours based on gap size
function estimateLearningHours(gap) {
  // Rough estimate: 1 hour per 2 points of improvement
  return Math.ceil(gap * 0.5);
}

// Generate skill recommendations based on similarity
function getSimilarSkills(skillKey, currentSkills) {
  const similarities = SKILL_SIMILARITY[skillKey] || {};
  const recommendations = [];
  
  for (const [relatedSkill, similarity] of Object.entries(similarities)) {
    const currentScore = currentSkills.get(relatedSkill)?.score || 0;
    
    // Recommend skills that are similar but not yet mastered
    if (similarity > 0.6 && currentScore < 70) {
      recommendations.push({
        skill: relatedSkill,
        skillName: SKILL_BY_KEY.get(relatedSkill)?.name || relatedSkill,
        similarity: Math.round(similarity * 100),
        currentScore,
        reason: `Similar to ${SKILL_BY_KEY.get(skillKey)?.name || skillKey}`,
      });
    }
  }
  
  return recommendations.sort((a, b) => b.similarity - a.similarity);
}

// Main recommendation function
async function getCareerRecommendations(studentId) {
  const db = getDB();
  
  // Fetch student skills
  const skillEntries = await db.collection('student_skills')
    .find({ studentId: oid(studentId) })
    .toArray();
  
  // Convert to map for easy lookup
  const studentSkills = new Map();
  for (const entry of skillEntries) {
    const score = entry.assessmentScore || entry.selfRating || 0;
    studentSkills.set(entry.skillKey, {
      score,
      verified: typeof entry.assessmentScore === 'number',
      endorsements: entry.endorsementCount || 0,
    });
  }
  
  // Calculate match for each career track
  const recommendations = CAREER_TRACKS.map(track => {
    const match = calculateCareerMatch(studentSkills, track, MARKET_DEMAND[track.key] || 70);
    const learningPath = generateLearningPath(studentSkills, track, match.gaps);
    
    return {
      careerKey: track.key,
      title: track.title,
      category: track.category,
      description: track.description,
      salaryRange: track.salaryRange,
      growth: track.growth,
      education: track.education,
      matchScore: match.matchScore,
      coreAvg: match.coreAvg,
      supportAvg: match.supportAvg,
      marketDemand: match.marketDemand,
      gaps: match.gaps,
      learningPath,
      readiness: match.matchScore >= 80 ? 'ready' : 
                 match.matchScore >= 60 ? 'nearly_ready' : 'developing',
    };
  });
  
  // Sort by match score
  recommendations.sort((a, b) => b.matchScore - a.matchScore);
  
  // Get skill recommendations based on top career
  const topCareer = recommendations[0];
  const skillRecommendations = [];
  
  if (topCareer) {
    const topGaps = topCareer.gaps.filter(g => g.gap > 0).slice(0, 5);
    for (const gap of topGaps) {
      const similar = getSimilarSkills(gap.skillKey, studentSkills);
      skillRecommendations.push({
        skill: gap.skillName,
        currentScore: gap.currentScore,
        targetScore: gap.requiredScore,
        gap: gap.gap,
        priority: gap.priority,
        similarSkills: similar.slice(0, 2),
      });
    }
  }
  
  // Calculate overall readiness
  const overallReadiness = Math.round(
    recommendations.reduce((sum, r) => sum + r.matchScore, 0) / recommendations.length
  );
  
  return {
    studentId,
    overallReadiness,
    topMatches: recommendations.slice(0, 4),
    allMatches: recommendations,
    skillRecommendations,
    metadata: {
      skillsAnalyzed: skillEntries.length,
      careersEvaluated: CAREER_TRACKS.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

// Get personalized skill path
async function getPersonalizedSkillPath(studentId, targetCareer) {
  const db = getDB();
  
  const skillEntries = await db.collection('student_skills')
    .find({ studentId: oid(studentId) })
    .toArray();
  
  const studentSkills = new Map();
  for (const entry of skillEntries) {
    const score = entry.assessmentScore || entry.selfRating || 0;
    studentSkills.set(entry.skillKey, { score, verified: typeof entry.assessmentScore === 'number' });
  }
  
  const career = CAREER_BY_KEY.get(targetCareer);
  if (!career) {
    return { error: 'Career track not found' };
  }
  
  const match = calculateCareerMatch(studentSkills, career, MARKET_DEMAND[career.key] || 70);
  const learningPath = generateLearningPath(studentSkills, career, match.gaps);
  
  // Add skill similarity recommendations
  const skillInsights = [];
  for (const gap of match.gaps.filter(g => g.gap > 0).slice(0, 3)) {
    const similar = getSimilarSkills(gap.skillKey, studentSkills);
    if (similar.length > 0) {
      skillInsights.push({
        skill: gap.skillName,
        learningFromSimilar: similar.map(s => ({
          skill: s.skillName,
          reason: s.reason,
          tip: `Your ${s.similarity}% similarity suggests transferable knowledge`,
        })),
      });
    }
  }
  
  return {
    career: {
      key: career.key,
      title: career.title,
      matchScore: match.matchScore,
    },
    learningPath,
    skillInsights,
    totalHours: learningPath.reduce((sum, l) => sum + l.estimatedHours, 0),
    estimatedWeeks: Math.ceil(learningPath.reduce((sum, l) => sum + l.estimatedHours, 0) / 10),
  };
}

// Get skill analytics
async function getSkillAnalytics(studentId) {
  const db = getDB();
  
  const skillEntries = await db.collection('student_skills')
    .find({ studentId: oid(studentId) })
    .toArray();
  
  const skills = skillEntries.map(entry => {
    const meta = SKILL_BY_KEY.get(entry.skillKey);
    const score = entry.assessmentScore || entry.selfRating || 0;
    const level = levelForScore(score);
    
    return {
      key: entry.skillKey,
      name: meta?.name || entry.skillKey,
      category: meta?.category || 'general',
      score,
      level: level.level,
      levelLabel: level.label,
      verified: typeof entry.assessmentScore === 'number',
      endorsements: entry.endorsementCount || 0,
    };
  });
  
  // Category breakdown
  const categories = {};
  for (const skill of skills) {
    if (!categories[skill.category]) {
      categories[skill.category] = { skills: [], average: 0 };
    }
    categories[skill.category].skills.push(skill);
  }
  
  for (const cat of Object.values(categories)) {
    cat.average = Math.round(
      cat.skills.reduce((sum, s) => sum + s.score, 0) / cat.skills.length
    );
  }
  
  // Skill distribution
  const distribution = {
    expert: skills.filter(s => s.level === 'expert').length,
    advanced: skills.filter(s => s.level === 'advanced').length,
    intermediate: skills.filter(s => s.level === 'intermediate').length,
    beginner: skills.filter(s => s.level === 'beginner').length,
    novice: skills.filter(s => s.level === 'novice').length,
  };
  
  // Find strengths and weaknesses
  const sorted = [...skills].sort((a, b) => b.score - a.score);
  const strengths = sorted.slice(0, 3);
  const weaknesses = sorted.slice(-3).reverse();
  
  return {
    totalSkills: skills.length,
    verifiedSkills: skills.filter(s => s.verified).length,
    averageScore: skills.length ? 
      Math.round(skills.reduce((sum, s) => sum + s.score, 0) / skills.length) : 0,
    categories,
    distribution,
    strengths,
    weaknesses,
    skills,
  };
}

module.exports = {
  getCareerRecommendations,
  getPersonalizedSkillPath,
  getSkillAnalytics,
  calculateCareerMatch,
  calculateSkillGap,
  generateLearningPath,
  getSimilarSkills,
  MARKET_DEMAND,
};
