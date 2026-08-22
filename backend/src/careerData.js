// Canonical skill taxonomy + assessment/career reference data shared by the
// assessments, skills, mentorship and placement routers.

const SKILL_CATEGORIES = ['programming', 'data', 'design', 'business', 'communication', 'core_engineering'];

const SKILLS = [
  { key: 'javascript', name: 'JavaScript', category: 'programming' },
  { key: 'python', name: 'Python', category: 'programming' },
  { key: 'java', name: 'Java', category: 'programming' },
  { key: 'cpp', name: 'C++', category: 'programming' },
  { key: 'dsa', name: 'Data Structures & Algorithms', category: 'programming' },
  { key: 'react', name: 'React', category: 'programming' },
  { key: 'nodejs', name: 'Node.js', category: 'programming' },
  { key: 'sql', name: 'SQL & Databases', category: 'data' },
  { key: 'ml', name: 'Machine Learning', category: 'data' },
  { key: 'statistics', name: 'Statistics', category: 'data' },
  { key: 'dataviz', name: 'Data Visualization', category: 'data' },
  { key: 'excel', name: 'Spreadsheets & Excel', category: 'data' },
  { key: 'uiux', name: 'UI/UX Design', category: 'design' },
  { key: 'figma', name: 'Figma & Prototyping', category: 'design' },
  { key: 'productthinking', name: 'Product Thinking', category: 'business' },
  { key: 'projectmgmt', name: 'Project Management', category: 'business' },
  { key: 'finance', name: 'Business Finance', category: 'business' },
  { key: 'marketing', name: 'Marketing', category: 'business' },
  { key: 'communication', name: 'Communication', category: 'communication' },
  { key: 'presentation', name: 'Presentation Skills', category: 'communication' },
  { key: 'teamwork', name: 'Teamwork & Collaboration', category: 'communication' },
  { key: 'leadership', name: 'Leadership', category: 'communication' },
  { key: 'aptitude', name: 'Quantitative Aptitude', category: 'core_engineering' },
  { key: 'logical', name: 'Logical Reasoning', category: 'core_engineering' },
  { key: 'os', name: 'Operating Systems', category: 'core_engineering' },
  { key: 'networks', name: 'Computer Networks', category: 'core_engineering' },
  { key: 'dbms', name: 'DBMS Concepts', category: 'core_engineering' },
];

const SKILL_BY_KEY = new Map(SKILLS.map(s => [s.key, s]));

// Level thresholds applied to a 0-100 proficiency score.
const SKILL_LEVELS = [
  { level: 'novice', min: 0, label: 'Novice' },
  { level: 'beginner', min: 25, label: 'Beginner' },
  { level: 'intermediate', min: 45, label: 'Intermediate' },
  { level: 'advanced', min: 70, label: 'Advanced' },
  { level: 'expert', min: 88, label: 'Expert' },
];

function levelForScore(score) {
  const value = Math.max(0, Math.min(100, Number(score) || 0));
  let match = SKILL_LEVELS[0];
  for (const entry of SKILL_LEVELS) {
    if (value >= entry.min) match = entry;
  }
  return match;
}

const CAREER_TRACKS = [
  {
    key: 'software_engineer',
    title: 'Software Engineer',
    category: 'programming',
    salaryRange: '₹8-25 LPA',
    growth: 25,
    education: 'B.Tech CS/IT or equivalent',
    description: 'Design, build and maintain production software systems.',
    coreSkills: ['dsa', 'javascript', 'nodejs', 'sql', 'os'],
    supportSkills: ['react', 'communication', 'teamwork'],
  },
  {
    key: 'data_scientist',
    title: 'Data Scientist',
    category: 'data',
    salaryRange: '₹10-30 LPA',
    growth: 35,
    education: 'B.Tech / M.Sc with Data Science specialisation',
    description: 'Turn raw data into models and decisions for the business.',
    coreSkills: ['python', 'statistics', 'ml', 'sql'],
    supportSkills: ['dataviz', 'communication', 'productthinking'],
  },
  {
    key: 'frontend_engineer',
    title: 'Frontend Engineer',
    category: 'programming',
    salaryRange: '₹7-22 LPA',
    growth: 22,
    education: 'B.Tech / BCA',
    description: 'Build the interfaces users actually touch, end to end.',
    coreSkills: ['javascript', 'react', 'uiux'],
    supportSkills: ['figma', 'communication', 'productthinking'],
  },
  {
    key: 'product_manager',
    title: 'Product Manager',
    category: 'business',
    salaryRange: '₹12-35 LPA',
    growth: 20,
    education: 'Any degree + strong product portfolio / MBA',
    description: 'Own the why and what of a product; align engineering, design and business.',
    coreSkills: ['productthinking', 'communication', 'projectmgmt'],
    supportSkills: ['sql', 'presentation', 'leadership'],
  },
  {
    key: 'ux_designer',
    title: 'UI/UX Designer',
    category: 'design',
    salaryRange: '₹6-18 LPA',
    growth: 20,
    education: 'B.Des / any degree with portfolio',
    description: 'Research, prototype and refine digital experiences.',
    coreSkills: ['uiux', 'figma', 'productthinking'],
    supportSkills: ['communication', 'presentation'],
  },
  {
    key: 'data_analyst',
    title: 'Data Analyst',
    category: 'data',
    salaryRange: '₹5-15 LPA',
    growth: 18,
    education: 'Any quantitative degree',
    description: 'Answer business questions with data, dashboards and reporting.',
    coreSkills: ['sql', 'excel', 'dataviz', 'statistics'],
    supportSkills: ['communication', 'presentation'],
  },
  {
    key: 'business_analyst',
    title: 'Business Analyst',
    category: 'business',
    salaryRange: '₹6-18 LPA',
    growth: 15,
    education: 'B.Tech / BBA / MBA',
    description: 'Bridge business needs and technical delivery.',
    coreSkills: ['communication', 'excel', 'projectmgmt', 'finance'],
    supportSkills: ['sql', 'presentation'],
  },
  {
    key: 'backend_engineer',
    title: 'Backend Engineer',
    category: 'programming',
    salaryRange: '₹8-26 LPA',
    growth: 24,
    education: 'B.Tech CS/IT',
    description: 'Build the services, data models and APIs behind the product.',
    coreSkills: ['nodejs', 'dsa', 'dbms', 'networks'],
    supportSkills: ['sql', 'os', 'teamwork'],
  },
];

const CAREER_BY_KEY = new Map(CAREER_TRACKS.map(t => [t.key, t]));

// Question bank — lazy-loaded from separate module to reduce startup parse time
let _questionBank = null;
function getQuestionBank() {
  if (!_questionBank) _questionBank = require('./questionBank');
  return _questionBank;
}

// Proxied access so existing code like QUESTION_BANK.dsa still works
const QUESTION_BANK_PROXY = new Proxy({}, {
  get(_, key) {
    return getQuestionBank()[key];
  },
  ownKeys() {
    return Object.keys(getQuestionBank());
  },
  getOwnPropertyDescriptor(target, key) {
    return Object.getOwnPropertyDescriptor(getQuestionBank(), key);
  },
});

const ASSESSMENT_TEMPLATES = [
  { key: 'dsa_fundamentals', title: 'DSA Fundamentals', skillKey: 'dsa', description: 'Arrays, trees, graphs, complexity analysis and classic algorithms.', durationMinutes: 25, questionCount: 12, passScore: 60, difficulty: 'intermediate' },
  { key: 'javascript_core', title: 'JavaScript Core', skillKey: 'javascript', description: 'Types, async, closures and the event loop.', durationMinutes: 20, questionCount: 10, passScore: 60, difficulty: 'intermediate' },
  { key: 'python_essentials', title: 'Python Essentials', skillKey: 'python', description: 'Data types, comprehensions, generators and idiomatic Python.', durationMinutes: 20, questionCount: 10, passScore: 60, difficulty: 'beginner' },
  { key: 'sql_databases', title: 'SQL & Databases', skillKey: 'sql', description: 'Joins, aggregation, indexing and transaction isolation.', durationMinutes: 20, questionCount: 10, passScore: 60, difficulty: 'intermediate' },
  { key: 'quant_aptitude', title: 'Quantitative Aptitude', skillKey: 'aptitude', description: 'Placement-style arithmetic, ratios, probability and profit-loss.', durationMinutes: 25, questionCount: 10, passScore: 55, difficulty: 'beginner' },
  { key: 'logical_reasoning', title: 'Logical Reasoning', skillKey: 'logical', description: 'Series, coding-decoding, syllogisms and direction sense.', durationMinutes: 20, questionCount: 10, passScore: 55, difficulty: 'beginner' },
  { key: 'communication_skills', title: 'Communication Skills', skillKey: 'communication', description: 'Professional writing, feedback, listening and presenting.', durationMinutes: 15, questionCount: 8, passScore: 60, difficulty: 'beginner' },
  { key: 'operating_systems', title: 'Operating Systems', skillKey: 'os', description: 'Processes, scheduling, memory and concurrency.', durationMinutes: 18, questionCount: 8, passScore: 60, difficulty: 'intermediate' },
  { key: 'dbms_concepts', title: 'DBMS Concepts', skillKey: 'dbms', description: 'ACID, keys, indexing, normalisation and concurrency control.', durationMinutes: 18, questionCount: 8, passScore: 60, difficulty: 'intermediate' },
  { key: 'computer_networks', title: 'Computer Networks', skillKey: 'networks', description: 'TCP/IP, DNS, HTTP and the OSI model.', durationMinutes: 18, questionCount: 8, passScore: 60, difficulty: 'intermediate' },
  { key: 'react_development', title: 'React Development', skillKey: 'react', description: 'Components, hooks, rendering and state patterns.', durationMinutes: 18, questionCount: 8, passScore: 60, difficulty: 'intermediate' },
  { key: 'statistics_basics', title: 'Statistics for Data Roles', skillKey: 'statistics', description: 'Distributions, hypothesis testing and inference.', durationMinutes: 18, questionCount: 8, passScore: 60, difficulty: 'intermediate' },
  { key: 'machine_learning', title: 'Machine Learning Foundations', skillKey: 'ml', description: 'Model families, evaluation metrics and generalisation.', durationMinutes: 18, questionCount: 8, passScore: 65, difficulty: 'advanced' },
  { key: 'uiux_principles', title: 'UI/UX Principles', skillKey: 'uiux', description: 'Accessibility, heuristics, usability and design process.', durationMinutes: 15, questionCount: 8, passScore: 60, difficulty: 'beginner' },
  { key: 'product_thinking', title: 'Product Thinking', skillKey: 'productthinking', description: 'Metrics, prioritisation, discovery and experimentation.', durationMinutes: 15, questionCount: 8, passScore: 60, difficulty: 'intermediate' },
];

const SEED_COMPANIES = [
  { name: 'Infosys', sector: 'IT Services', tier: 'mass', logoColor: '#0072C6' },
  { name: 'TCS', sector: 'IT Services', tier: 'mass', logoColor: '#00559A' },
  { name: 'Zoho', sector: 'Product', tier: 'product', logoColor: '#E42527' },
  { name: 'Freshworks', sector: 'SaaS', tier: 'product', logoColor: '#2C5CC5' },
  { name: 'Razorpay', sector: 'Fintech', tier: 'product', logoColor: '#0C2451' },
  { name: 'Deloitte', sector: 'Consulting', tier: 'consulting', logoColor: '#86BC25' },
  { name: 'Amazon', sector: 'Product', tier: 'faang', logoColor: '#FF9900' },
  { name: 'Swiggy', sector: 'Consumer Tech', tier: 'product', logoColor: '#FC8019' },
];

const PLACEMENT_ROUNDS = ['Aptitude Test', 'Technical Test', 'Technical Interview', 'HR Interview'];

// Departments are free-form across the app ("CSE", "Computer Science",
// "Computer Science & Engineering"), so eligibility compares canonical codes.
const DEPARTMENT_ALIASES = {
  CSE: ['cse', 'cs', 'computer science', 'computer science and engineering', 'computer science & engineering', 'computer engineering'],
  IT: ['it', 'information technology'],
  ECE: ['ece', 'electronics', 'electronics and communication', 'electronics & communication', 'electronics and communication engineering'],
  EEE: ['eee', 'electrical', 'electrical and electronics', 'electrical engineering'],
  MECH: ['mech', 'mechanical', 'mechanical engineering'],
  CIVIL: ['civil', 'civil engineering'],
  MBA: ['mba', 'management', 'business administration'],
  MATHS: ['maths', 'math', 'mathematics'],
};

function canonicalDepartment(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  for (const [code, aliases] of Object.entries(DEPARTMENT_ALIASES)) {
    if (code.toLowerCase() === normalized || aliases.includes(normalized)) return code;
  }
  return normalized.toUpperCase();
}

function departmentMatches(allowed, studentDepartment) {
  if (!Array.isArray(allowed) || !allowed.length) return true;
  const student = canonicalDepartment(studentDepartment);
  if (!student) return false;
  return allowed.some(entry => canonicalDepartment(entry) === student);
}

function daysAhead(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function buildSeedDrives() {
  return [
    {
      company: 'Zoho', role: 'Software Development Engineer', sector: 'Product',
      packageLpa: 12, packageLabel: '₹12 LPA', location: 'Chennai', jobType: 'full_time',
      minCgpa: 7.0, minAttendance: 75, allowedDepartments: ['CSE', 'IT', 'ECE'], maxBacklogs: 0,
      requiredSkills: ['dsa', 'javascript', 'dbms'],
      description: 'Build and own product features end to end across the Zoho suite.',
      rounds: PLACEMENT_ROUNDS, deadline: daysAhead(12), driveDate: daysAhead(20), openings: 25, status: 'open',
    },
    {
      company: 'Razorpay', role: 'Backend Engineer (Fresher)', sector: 'Fintech',
      packageLpa: 16, packageLabel: '₹16 LPA', location: 'Bengaluru', jobType: 'full_time',
      minCgpa: 7.5, minAttendance: 75, allowedDepartments: ['CSE', 'IT'], maxBacklogs: 0,
      requiredSkills: ['dsa', 'nodejs', 'dbms', 'networks'],
      description: 'Work on payments infrastructure handling millions of transactions daily.',
      rounds: ['Online Assessment', 'DSA Interview', 'System Design', 'Hiring Manager'], deadline: daysAhead(8), driveDate: daysAhead(18), openings: 10, status: 'open',
    },
    {
      company: 'Infosys', role: 'Systems Engineer', sector: 'IT Services',
      packageLpa: 4.5, packageLabel: '₹4.5 LPA', location: 'Multiple', jobType: 'full_time',
      minCgpa: 6.0, minAttendance: 70, allowedDepartments: ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL'], maxBacklogs: 1,
      requiredSkills: ['aptitude', 'logical', 'communication'],
      description: 'Entry-level engineering role with structured training at Mysuru campus.',
      rounds: PLACEMENT_ROUNDS, deadline: daysAhead(21), driveDate: daysAhead(30), openings: 120, status: 'open',
    },
    {
      company: 'Freshworks', role: 'Frontend Engineer Intern', sector: 'SaaS',
      packageLpa: 6, packageLabel: '₹50k/month stipend', location: 'Chennai', jobType: 'internship',
      minCgpa: 7.0, minAttendance: 75, allowedDepartments: ['CSE', 'IT'], maxBacklogs: 0,
      requiredSkills: ['javascript', 'react', 'uiux'],
      description: 'Six-month internship building customer-facing product surfaces.',
      rounds: ['Screening', 'Frontend Assignment', 'Technical Interview'], deadline: daysAhead(5), driveDate: daysAhead(14), openings: 8, status: 'open',
    },
    {
      company: 'Deloitte', role: 'Business Technology Analyst', sector: 'Consulting',
      packageLpa: 7.6, packageLabel: '₹7.6 LPA', location: 'Hyderabad', jobType: 'full_time',
      minCgpa: 6.5, minAttendance: 75, allowedDepartments: ['CSE', 'IT', 'ECE', 'MBA'], maxBacklogs: 0,
      requiredSkills: ['aptitude', 'communication', 'sql'],
      description: 'Client-facing analyst role spanning technology and business consulting.',
      rounds: ['Aptitude Test', 'Group Discussion', 'Technical Interview', 'HR Interview'], deadline: daysAhead(15), driveDate: daysAhead(25), openings: 30, status: 'open',
    },
    {
      company: 'Swiggy', role: 'Data Analyst', sector: 'Consumer Tech',
      packageLpa: 11, packageLabel: '₹11 LPA', location: 'Bengaluru', jobType: 'full_time',
      minCgpa: 7.0, minAttendance: 75, allowedDepartments: ['CSE', 'IT', 'ECE', 'MATHS'], maxBacklogs: 0,
      requiredSkills: ['sql', 'statistics', 'excel', 'dataviz'],
      description: 'Own analytics for the delivery experience charter.',
      rounds: ['SQL Test', 'Case Study', 'Analytics Interview', 'HR Interview'], deadline: daysAhead(10), driveDate: daysAhead(22), openings: 6, status: 'open',
    },
    {
      company: 'Amazon', role: 'SDE-1', sector: 'Product',
      packageLpa: 28, packageLabel: '₹28 LPA', location: 'Bengaluru / Hyderabad', jobType: 'full_time',
      minCgpa: 8.0, minAttendance: 80, allowedDepartments: ['CSE', 'IT'], maxBacklogs: 0,
      requiredSkills: ['dsa', 'os', 'dbms', 'networks'],
      description: 'Build large-scale distributed systems serving global customers.',
      rounds: ['Online Assessment', 'DSA Round 1', 'DSA Round 2', 'Bar Raiser'], deadline: daysAhead(6), driveDate: daysAhead(16), openings: 4, status: 'open',
    },
    {
      company: 'TCS', role: 'Digital Cadre', sector: 'IT Services',
      packageLpa: 7, packageLabel: '₹7 LPA', location: 'Multiple', jobType: 'full_time',
      minCgpa: 6.5, minAttendance: 70, allowedDepartments: ['CSE', 'IT', 'ECE', 'EEE'], maxBacklogs: 0,
      requiredSkills: ['aptitude', 'logical', 'python'],
      description: 'Digital track for candidates clearing the advanced qualifier.',
      rounds: PLACEMENT_ROUNDS, deadline: daysAhead(18), driveDate: daysAhead(28), openings: 60, status: 'open',
    },
  ];
}

const SEED_MENTORS = [
  {
    name: 'Priya Raghavan', headline: 'Senior SDE at Razorpay', company: 'Razorpay',
    expertise: ['dsa', 'nodejs', 'dbms'], careerTracks: ['backend_engineer', 'software_engineer'],
    experienceYears: 6, bio: 'Ex-campus hire turned senior engineer. I coach on DSA interviews and backend system design.',
    languages: ['English', 'Tamil', 'Hindi'], availability: ['Tue 7-9pm', 'Sat 10am-1pm'], rating: 4.8, sessionsCompleted: 142,
  },
  {
    name: 'Arjun Mehta', headline: 'Data Science Lead at Swiggy', company: 'Swiggy',
    expertise: ['ml', 'statistics', 'sql', 'python'], careerTracks: ['data_scientist', 'data_analyst'],
    experienceYears: 8, bio: 'I help students build a real data portfolio instead of another Titanic notebook.',
    languages: ['English', 'Hindi'], availability: ['Mon 8-10pm', 'Thu 8-10pm'], rating: 4.9, sessionsCompleted: 205,
  },
  {
    name: 'Sneha Kulkarni', headline: 'Product Manager at Freshworks', company: 'Freshworks',
    expertise: ['productthinking', 'communication', 'projectmgmt'], careerTracks: ['product_manager', 'business_analyst'],
    experienceYears: 5, bio: 'Non-CS background to PM. Ask me about breaking into product without an MBA.',
    languages: ['English', 'Marathi'], availability: ['Wed 7-9pm', 'Sun 11am-1pm'], rating: 4.7, sessionsCompleted: 98,
  },
  {
    name: 'Vikram Iyer', headline: 'Engineering Manager at Amazon', company: 'Amazon',
    expertise: ['dsa', 'os', 'leadership'], careerTracks: ['software_engineer', 'backend_engineer'],
    experienceYears: 11, bio: 'I have interviewed 400+ candidates. I will tell you exactly what a bar raiser looks for.',
    languages: ['English', 'Tamil'], availability: ['Sat 4-7pm'], rating: 4.9, sessionsCompleted: 176,
  },
  {
    name: 'Ananya Bose', headline: 'Staff Design Lead at Zoho', company: 'Zoho',
    expertise: ['uiux', 'figma', 'productthinking'], careerTracks: ['ux_designer', 'product_manager'],
    experienceYears: 9, bio: 'Portfolio reviews and design critique. Bring work, not just questions.',
    languages: ['English', 'Bengali'], availability: ['Tue 6-8pm', 'Fri 6-8pm'], rating: 4.8, sessionsCompleted: 121,
  },
  {
    name: 'Rahul Nair', headline: 'Frontend Architect at Freshworks', company: 'Freshworks',
    expertise: ['javascript', 'react', 'uiux'], careerTracks: ['frontend_engineer', 'software_engineer'],
    experienceYears: 7, bio: 'Deep frontend: rendering, performance and shipping real UI at scale.',
    languages: ['English', 'Malayalam'], availability: ['Mon 7-9pm', 'Sat 2-4pm'], rating: 4.6, sessionsCompleted: 87,
  },
  {
    name: 'Meera Desai', headline: 'Consultant at Deloitte', company: 'Deloitte',
    expertise: ['communication', 'presentation', 'finance', 'excel'], careerTracks: ['business_analyst', 'product_manager'],
    experienceYears: 6, bio: 'Case interview prep, structured problem solving and consulting-grade communication.',
    languages: ['English', 'Gujarati', 'Hindi'], availability: ['Thu 7-9pm', 'Sun 4-6pm'], rating: 4.7, sessionsCompleted: 113,
  },
  {
    name: 'Karthik Subramanian', headline: 'Senior Data Engineer at Infosys', company: 'Infosys',
    expertise: ['sql', 'python', 'dbms'], careerTracks: ['data_analyst', 'backend_engineer'],
    experienceYears: 10, bio: 'Service-company to product-company transitions, and everything SQL.',
    languages: ['English', 'Tamil', 'Telugu'], availability: ['Wed 8-10pm'], rating: 4.5, sessionsCompleted: 64,
  },
];

// Idempotent seeding — memoized so it only runs once per server lifetime
let _seeded = false;
async function ensureCareerSeed(db) {
  if (_seeded) return;
  _seeded = true;

  const [assessmentCount, driveCount, mentorCount] = await Promise.all([
    db.collection('assessments').estimatedDocumentCount(),
    db.collection('placement_drives').estimatedDocumentCount(),
    db.collection('mentors').estimatedDocumentCount(),
  ]);

  const now = new Date().toISOString();

  if (!assessmentCount) {
    const qb = getQuestionBank();
    const docs = ASSESSMENT_TEMPLATES.filter(t => (qb[t.skillKey] || []).length).map(t => ({
      ...t,
      skillName: SKILL_BY_KEY.get(t.skillKey)?.name || t.skillKey,
      category: SKILL_BY_KEY.get(t.skillKey)?.category || 'core_engineering',
      totalQuestions: Math.min(t.questionCount, qb[t.skillKey].length),
      attempts: 0,
      isActive: true,
      createdAt: now,
    }));
    if (docs.length) await db.collection('assessments').insertMany(docs);
  }

  if (!driveCount) {
    const docs = buildSeedDrives().map(d => ({ ...d, applicationCount: 0, createdAt: now }));
    await db.collection('placement_drives').insertMany(docs);
  }

  if (!mentorCount) {
    const docs = SEED_MENTORS.map(m => ({ ...m, isActive: true, createdAt: now }));
    await db.collection('mentors').insertMany(docs);
  }
}

module.exports = {
  SKILLS,
  SKILL_BY_KEY,
  SKILL_CATEGORIES,
  SKILL_LEVELS,
  levelForScore,
  CAREER_TRACKS,
  CAREER_BY_KEY,
  QUESTION_BANK: QUESTION_BANK_PROXY,
  ASSESSMENT_TEMPLATES,
  SEED_COMPANIES,
  PLACEMENT_ROUNDS,
  DEPARTMENT_ALIASES,
  canonicalDepartment,
  departmentMatches,
  SEED_MENTORS,
  ensureCareerSeed,
};
