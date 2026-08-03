/**
 * Student Performance Prediction Model
 * 
 * Predicts student performance based on:
 * - Assessment scores and trends
 * - Attendance patterns
 * - Skill proficiency levels
 * - Historical performance data
 * 
 * Uses weighted scoring and pattern analysis for predictions.
 */

const { getDB, oid } = require('../db');
const { SKILLS, SKILL_BY_KEY, levelForScore } = require('../careerData');

// Feature weights for prediction
const WEIGHTS = {
  assessmentScore: 0.35,
  assessmentTrend: 0.15,
  attendance: 0.20,
  skillDepth: 0.15,
  consistency: 0.10,
  improvement: 0.05,
};

// Performance categories
const PERFORMANCE_CATEGORIES = {
  excellent: { min: 85, label: 'Excellent', color: '#22c55e', risk: 'low' },
  good: { min: 70, label: 'Good', color: '#3b82f6', risk: 'low' },
  average: { min: 55, label: 'Average', color: '#f59e0b', risk: 'medium' },
  below_average: { min: 40, label: 'Below Average', color: '#f97316', risk: 'high' },
  at_risk: { min: 0, label: 'At Risk', color: '#ef4444', risk: 'critical' },
};

// Calculate assessment score features
function calculateAssessmentFeatures(attempts) {
  if (!attempts.length) {
    return { average: 0, trend: 0, consistency: 0, best: 0, attempts: 0 };
  }
  
  const scores = attempts.map(a => a.scorePercent);
  const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const best = Math.max(...scores);
  
  // Calculate trend (improvement over time)
  let trend = 0;
  if (scores.length >= 2) {
    const recent = scores.slice(-3);
    const older = scores.slice(0, -3);
    
    if (older.length > 0) {
      const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
      const olderAvg = older.reduce((s, v) => s + v, 0) / older.length;
      trend = recentAvg - olderAvg;
    } else if (recent.length >= 2) {
      // Simple linear trend for few attempts
      trend = (recent[recent.length - 1] - recent[0]) / recent.length;
    }
  }
  
  // Calculate consistency (lower variance = more consistent)
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - average, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  const consistency = Math.max(0, 100 - stdDev); // Lower stdDev = higher consistency
  
  return {
    average: Math.round(average),
    trend: Math.round(trend),
    consistency: Math.round(consistency),
    best,
    attempts: attempts.length,
  };
}

// Calculate attendance features
function calculateAttendanceFeatures(attendanceRecords) {
  if (!attendanceRecords.length) {
    return { percentage: 0, streak: 0, recentTrend: 0 };
  }
  
  const total = attendanceRecords.length;
  const present = attendanceRecords.filter(r => r.status === 'present' || r.status === 'P').length;
  const percentage = Math.round((present / total) * 100);
  
  // Calculate current streak
  let streak = 0;
  for (let i = total - 1; i >= 0; i--) {
    if (attendanceRecords[i].status === 'present' || attendanceRecords[i].status === 'P') {
      streak++;
    } else {
      break;
    }
  }
  
  // Recent trend (last 7 records vs previous 7)
  let recentTrend = 0;
  if (total >= 14) {
    const recent7 = attendanceRecords.slice(-7);
    const prev7 = attendanceRecords.slice(-14, -7);
    
    const recentPresent = recent7.filter(r => r.status === 'present' || r.status === 'P').length;
    const prevPresent = prev7.filter(r => r.status === 'present' || r.status === 'P').length;
    
    recentTrend = recentPresent - prevPresent;
  }
  
  return { percentage, streak, recentTrend };
}

// Calculate skill depth features
function calculateSkillFeatures(skillEntries) {
  if (!skillEntries.length) {
    return { averageScore: 0, verifiedCount: 0, topSkills: [], weakAreas: [] };
  }
  
  const skills = skillEntries.map(entry => {
    const meta = SKILL_BY_KEY.get(entry.skillKey);
    const score = entry.assessmentScore || entry.selfRating || 0;
    return {
      key: entry.skillKey,
      name: meta?.name || entry.skillKey,
      category: meta?.category || 'general',
      score,
      verified: typeof entry.assessmentScore === 'number',
    };
  });
  
  const averageScore = Math.round(
    skills.reduce((sum, s) => sum + s.score, 0) / skills.length
  );
  
  const verifiedCount = skills.filter(s => s.verified).length;
  const topSkills = skills.sort((a, b) => b.score - a.score).slice(0, 5);
  const weakAreas = skills.filter(s => s.score < 50).sort((a, b) => a.score - b.score);
  
  return { averageScore, verifiedCount, topSkills, weakAreas };
}

// Calculate overall performance score
function calculatePerformanceScore(features) {
  const score = 
    features.assessment.average * WEIGHTS.assessmentScore +
    Math.max(0, 50 + features.assessment.trend) * WEIGHTS.assessmentTrend +
    features.attendance.percentage * WEIGHTS.attendance +
    features.skills.averageScore * WEIGHTS.skillDepth +
    features.assessment.consistency * WEIGHTS.consistency +
    Math.max(0, 50 + features.assessment.trend * 2) * WEIGHTS.improvement;
  
  return Math.round(Math.min(100, Math.max(0, score)));
}

// Get performance category
function getPerformanceCategory(score) {
  for (const [key, category] of Object.entries(PERFORMANCE_CATEGORIES)) {
    if (score >= category.min) {
      return { key, ...category };
    }
  }
  return { key: 'at_risk', ...PERFORMANCE_CATEGORIES.at_risk };
}

// Generate risk assessment
function generateRiskAssessment(features, overallScore) {
  const risks = [];
  const category = getPerformanceCategory(overallScore);
  
  // Check attendance risk
  if (features.attendance.percentage < 75) {
    risks.push({
      type: 'attendance',
      severity: features.attendance.percentage < 60 ? 'critical' : 'high',
      message: `Attendance is ${features.attendance.percentage}% (below 75% threshold)`,
      impact: -15,
    });
  }
  
  // Check assessment performance
  if (features.assessment.average < 50) {
    risks.push({
      type: 'assessment',
      severity: 'high',
      message: `Average assessment score is ${features.assessment.average}%`,
      impact: -20,
    });
  }
  
  // Check negative trend
  if (features.assessment.trend < -10) {
    risks.push({
      type: 'trend',
      severity: 'medium',
      message: `Performance declining by ${Math.abs(features.assessment.trend)}%`,
      impact: -10,
    });
  }
  
  // Check weak skills
  if (features.skills.weakAreas.length > 3) {
    risks.push({
      type: 'skills',
      severity: 'medium',
      message: `${features.skills.weakAreas.length} skills below 50% proficiency`,
      impact: -5,
    });
  }
  
  // Check consistency
  if (features.assessment.consistency < 40) {
    risks.push({
      type: 'consistency',
      severity: 'low',
      message: 'Inconsistent performance across assessments',
      impact: -5,
    });
  }
  
  return {
    level: category.risk,
    factors: risks,
    totalImpact: risks.reduce((sum, r) => sum + r.impact, 0),
  };
}

// Generate recommendations
function generateRecommendations(features, overallScore) {
  const recommendations = [];
  const category = getPerformanceCategory(overallScore);
  
  // Attendance recommendations
  if (features.attendance.percentage < 80) {
    recommendations.push({
      priority: 'high',
      category: 'attendance',
      title: 'Improve Attendance',
      description: `Current: ${features.attendance.percentage}%. Target: 85%+ for better grades.`,
      actions: [
        'Set daily reminders for classes',
        'Prioritize morning lectures',
        'Inform faculty in advance for planned absences',
      ],
    });
  }
  
  // Assessment recommendations
  if (features.assessment.average < 70) {
    recommendations.push({
      priority: 'high',
      category: 'assessment',
      title: 'Boost Assessment Scores',
      description: `Current average: ${features.assessment.average}%. Target: 75%+.`,
      actions: [
        'Review previous assessment papers',
        'Focus on weak topics identified',
        'Practice time management during tests',
        'Form study groups for difficult subjects',
      ],
    });
  }
  
  // Skill recommendations
  if (features.skills.weakAreas.length > 0) {
    const topWeak = features.skills.weakAreas[0];
    recommendations.push({
      priority: 'medium',
      category: 'skills',
      title: `Strengthen ${topWeak.name}`,
      description: `Current score: ${topWeak.score}%. This is a weak area.`,
      actions: [
        `Complete the ${topWeak.name} assessment`,
        `Work on projects using ${topWeak.name}`,
        `Find a mentor for guidance`,
      ],
    });
  }
  
  // Trend recommendations
  if (features.assessment.trend < 0) {
    recommendations.push({
      priority: 'medium',
      category: 'trend',
      title: 'Reverse Negative Trend',
      description: `Performance has dropped by ${Math.abs(features.assessment.trend)}% recently.`,
      actions: [
        'Identify what changed in your study routine',
        'Meet with academic advisor',
        'Consider reducing extracurricular load temporarily',
      ],
    });
  }
  
  // Positive reinforcement
  if (overallScore >= 80) {
    recommendations.push({
      priority: 'low',
      category: 'positive',
      title: 'Great Performance!',
      description: 'You are doing well. Keep it up!',
      actions: [
        'Consider helping peers with their studies',
        'Take on leadership roles in projects',
        'Explore advanced topics in your strong areas',
      ],
    });
  }
  
  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

// Main prediction function
async function predictStudentPerformance(studentId) {
  const db = getDB();
  
  // Fetch student data
  const [attempts, attendance, skills] = await Promise.all([
    db.collection('assessment_attempts')
      .find({ studentId: oid(studentId), status: 'submitted' })
      .sort({ submittedAt: -1 })
      .toArray(),
    db.collection('attendance')
      .find({ studentId: oid(studentId) })
      .sort({ date: -1 })
      .limit(30)
      .toArray(),
    db.collection('student_skills')
      .find({ studentId: oid(studentId) })
      .toArray(),
  ]);
  
  // Calculate features
  const features = {
    assessment: calculateAssessmentFeatures(attempts),
    attendance: calculateAttendanceFeatures(attendance),
    skills: calculateSkillFeatures(skills),
  };
  
  // Calculate overall score
  const overallScore = calculatePerformanceScore(features);
  
  // Get category
  const category = getPerformanceCategory(overallScore);
  
  // Generate risk assessment
  const risk = generateRiskAssessment(features, overallScore);
  
  // Generate recommendations
  const recommendations = generateRecommendations(features, overallScore);
  
  // Predict future performance (simple extrapolation)
  const predictedScore = Math.min(100, Math.max(0, 
    overallScore + (features.assessment.trend * 0.5)
  ));
  
  return {
    studentId,
    overallScore,
    predictedScore: Math.round(predictedScore),
    category,
    features,
    risk,
    recommendations,
    metadata: {
      assessmentsTaken: attempts.length,
      attendanceRecords: attendance.length,
      skillsTracked: skills.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

// Predict performance for multiple students (batch)
async function batchPredict(studentIds) {
  const predictions = await Promise.all(
    studentIds.map(id => predictStudentPerformance(id))
  );
  
  // Sort by overall score
  predictions.sort((a, b) => b.overallScore - a.overallScore);
  
  // Add class statistics
  const scores = predictions.map(p => p.overallScore);
  const classStats = {
    average: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
    highest: Math.max(...scores),
    lowest: Math.min(...scores),
    median: scores[Math.floor(scores.length / 2)],
    atRisk: predictions.filter(p => p.risk.level === 'critical' || p.risk.level === 'high').length,
  };
  
  return { predictions, classStats };
}

// Get performance insights for dashboard
async function getPerformanceInsights(studentId) {
  const prediction = await predictStudentPerformance(studentId);
  
  return {
    summary: {
      score: prediction.overallScore,
      category: prediction.category.label,
      trend: prediction.features.assessment.trend > 0 ? 'improving' : 
             prediction.features.assessment.trend < 0 ? 'declining' : 'stable',
      riskLevel: prediction.risk.level,
    },
    highlights: [
      {
        label: 'Best Assessment Score',
        value: prediction.features.assessment.best,
        unit: '%',
      },
      {
        label: 'Attendance Rate',
        value: prediction.features.attendance.percentage,
        unit: '%',
      },
      {
        label: 'Skills Verified',
        value: prediction.features.skills.verifiedCount,
        unit: '',
      },
    ],
    topRecommendations: prediction.recommendations.slice(0, 3),
  };
}

module.exports = {
  predictStudentPerformance,
  batchPredict,
  getPerformanceInsights,
  calculateAssessmentFeatures,
  calculateAttendanceFeatures,
  calculateSkillFeatures,
  PERFORMANCE_CATEGORIES,
};
