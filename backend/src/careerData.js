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

// Question bank. Each assessment draws its questions from here by skill key.
// `answer` is the 0-based index of the correct option.
const QUESTION_BANK = {
  dsa: [
    { q: 'What is the average time complexity of a lookup in a balanced binary search tree?', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], answer: 1, difficulty: 'easy' },
    { q: 'Which data structure gives O(1) amortised insert and delete at both ends?', options: ['Singly linked list', 'Deque', 'Binary heap', 'Sorted array'], answer: 1, difficulty: 'easy' },
    { q: 'A min-heap of n elements is built from an unsorted array in:', options: ['O(n)', 'O(n log n)', 'O(log n)', 'O(n^2)'], answer: 0, difficulty: 'medium' },
    { q: 'Which traversal of a BST yields keys in ascending order?', options: ['Pre-order', 'In-order', 'Post-order', 'Level-order'], answer: 1, difficulty: 'easy' },
    { q: 'Dijkstra’s algorithm fails when the graph contains:', options: ['Cycles', 'Negative edge weights', 'Disconnected components', 'Self loops'], answer: 1, difficulty: 'medium' },
    { q: 'Worst-case time complexity of quicksort is:', options: ['O(n log n)', 'O(n)', 'O(n^2)', 'O(log n)'], answer: 2, difficulty: 'easy' },
    { q: 'Which technique solves overlapping subproblems by caching results?', options: ['Greedy', 'Dynamic programming', 'Divide and conquer', 'Backtracking'], answer: 1, difficulty: 'easy' },
    { q: 'Space complexity of an iterative in-order traversal using an explicit stack on a skewed tree:', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], answer: 2, difficulty: 'medium' },
    { q: 'A hash table with a load factor above 1 and chaining will:', options: ['Fail to insert', 'Degrade lookups toward O(n)', 'Automatically become a tree', 'Lose entries'], answer: 1, difficulty: 'medium' },
    { q: 'Topological sort is only defined for:', options: ['Any graph', 'Directed acyclic graphs', 'Undirected trees', 'Weighted graphs'], answer: 1, difficulty: 'medium' },
    { q: 'Which algorithm finds the shortest path with negative weights but no negative cycles?', options: ['Dijkstra', 'Bellman-Ford', 'Prim', 'Kruskal'], answer: 1, difficulty: 'hard' },
    { q: 'Union-Find with path compression and union by rank has near-constant amortised complexity of:', options: ['O(log n)', 'O(alpha(n))', 'O(1) exact', 'O(n)'], answer: 1, difficulty: 'hard' },
  ],
  javascript: [
    { q: 'What does `typeof null` return in JavaScript?', options: ['"null"', '"object"', '"undefined"', '"number"'], answer: 1, difficulty: 'easy' },
    { q: 'Which keyword creates a block-scoped variable that cannot be reassigned?', options: ['var', 'let', 'const', 'static'], answer: 2, difficulty: 'easy' },
    { q: '`[1,2,3].map(x => x * 2)` returns:', options: ['[2,4,6]', '[1,2,3]', 'undefined', '6'], answer: 0, difficulty: 'easy' },
    { q: 'A Promise that is rejected and never handled will:', options: ['Silently pass', 'Trigger an unhandled rejection warning', 'Retry automatically', 'Resolve to undefined'], answer: 1, difficulty: 'medium' },
    { q: 'What is the output of `0.1 + 0.2 === 0.3`?', options: ['true', 'false', 'NaN', 'TypeError'], answer: 1, difficulty: 'easy' },
    { q: '`async function f() { return 1 }` — calling `f()` returns:', options: ['1', 'A Promise resolving to 1', 'undefined', 'A generator'], answer: 1, difficulty: 'medium' },
    { q: 'Which method creates a shallow copy of an object?', options: ['JSON.parse(JSON.stringify(o))', 'Object.assign({}, o)', 'structuredClone(o)', 'o.deepCopy()'], answer: 1, difficulty: 'medium' },
    { q: 'Arrow functions differ from regular functions because they:', options: ['Cannot be async', 'Do not bind their own `this`', 'Are always hoisted', 'Cannot take parameters'], answer: 1, difficulty: 'medium' },
    { q: 'The event loop processes microtasks (promises) relative to macrotasks (setTimeout):', options: ['After all macrotasks', 'Before the next macrotask', 'In parallel', 'Randomly'], answer: 1, difficulty: 'hard' },
    { q: '`Array.prototype.reduce` without an initial value on an empty array:', options: ['Returns undefined', 'Returns 0', 'Throws a TypeError', 'Returns []'], answer: 2, difficulty: 'hard' },
  ],
  python: [
    { q: 'Which of these is a mutable built-in type?', options: ['tuple', 'str', 'list', 'frozenset'], answer: 2, difficulty: 'easy' },
    { q: '`len("hello")` returns:', options: ['4', '5', '6', 'Error'], answer: 1, difficulty: 'easy' },
    { q: 'A list comprehension `[x*x for x in range(3)]` produces:', options: ['[0,1,4]', '[1,4,9]', '[0,1,2]', '[1,2,3]'], answer: 0, difficulty: 'easy' },
    { q: 'What does the GIL primarily limit?', options: ['Memory usage', 'True parallel execution of threads', 'Recursion depth', 'File I/O'], answer: 1, difficulty: 'medium' },
    { q: 'Default mutable arguments in a function signature are evaluated:', options: ['On every call', 'Once at definition time', 'Never', 'Only when passed'], answer: 1, difficulty: 'medium' },
    { q: '`dict.get(key, default)` differs from `dict[key]` because it:', options: ['Is faster', 'Returns default instead of raising KeyError', 'Mutates the dict', 'Only works on strings'], answer: 1, difficulty: 'easy' },
    { q: 'Which statement about generators is true?', options: ['They store all values in memory', 'They yield values lazily', 'They cannot be iterated', 'They are always faster'], answer: 1, difficulty: 'medium' },
    { q: '`is` compares:', options: ['Values', 'Object identity', 'Types only', 'String content'], answer: 1, difficulty: 'medium' },
    { q: 'A `with` block guarantees:', options: ['Faster execution', 'Resource cleanup via context manager', 'Thread safety', 'Exception suppression'], answer: 1, difficulty: 'medium' },
    { q: 'Slicing `a[::-1]` on a list returns:', options: ['The list unchanged', 'A reversed copy', 'The last element', 'An error'], answer: 1, difficulty: 'easy' },
  ],
  sql: [
    { q: 'Which clause filters rows before aggregation?', options: ['HAVING', 'WHERE', 'ORDER BY', 'GROUP BY'], answer: 1, difficulty: 'easy' },
    { q: 'An INNER JOIN returns:', options: ['All rows from both tables', 'Only matching rows from both tables', 'All rows from the left table', 'Distinct rows only'], answer: 1, difficulty: 'easy' },
    { q: 'Which index type best serves an exact-match lookup on a high-cardinality column?', options: ['B-tree', 'Bitmap', 'Full-text', 'No index'], answer: 0, difficulty: 'medium' },
    { q: '`COUNT(*)` versus `COUNT(column)` differ because COUNT(column):', options: ['Is always faster', 'Skips NULLs', 'Counts distinct values', 'Requires a GROUP BY'], answer: 1, difficulty: 'medium' },
    { q: 'The isolation level that prevents dirty reads but allows non-repeatable reads is:', options: ['READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE'], answer: 1, difficulty: 'hard' },
    { q: 'A LEFT JOIN with a WHERE filter on the right table’s column effectively becomes:', options: ['A CROSS JOIN', 'An INNER JOIN', 'A RIGHT JOIN', 'Unchanged'], answer: 1, difficulty: 'hard' },
    { q: 'Normalisation to 3NF primarily removes:', options: ['All joins', 'Transitive dependencies', 'Indexes', 'Foreign keys'], answer: 1, difficulty: 'medium' },
    { q: 'Which is NOT an aggregate function?', options: ['SUM', 'AVG', 'COALESCE', 'MAX'], answer: 2, difficulty: 'easy' },
    { q: 'A window function differs from GROUP BY because it:', options: ['Cannot use ORDER BY', 'Retains individual rows', 'Is always slower', 'Requires an index'], answer: 1, difficulty: 'medium' },
    { q: '`DELETE` versus `TRUNCATE`: TRUNCATE is typically:', options: ['Row-by-row and logged', 'Faster and not row-by-row logged', 'Reversible with a WHERE clause', 'Slower'], answer: 1, difficulty: 'medium' },
  ],
  aptitude: [
    { q: 'A train 150 m long crosses a pole in 15 seconds. Its speed is:', options: ['10 m/s', '15 m/s', '20 m/s', '25 m/s'], answer: 0, difficulty: 'easy' },
    { q: 'If 5 workers finish a job in 12 days, how long do 10 workers take (same rate)?', options: ['6 days', '12 days', '24 days', '3 days'], answer: 0, difficulty: 'easy' },
    { q: 'The compound interest on ₹1000 at 10% p.a. for 2 years is:', options: ['₹200', '₹210', '₹220', '₹121'], answer: 1, difficulty: 'medium' },
    { q: 'What is 35% of 240?', options: ['74', '80', '84', '96'], answer: 2, difficulty: 'easy' },
    { q: 'The average of 5 numbers is 20. If one number is removed the average becomes 22. The removed number is:', options: ['12', '14', '10', '8'], answer: 0, difficulty: 'medium' },
    { q: 'A sum doubles in 8 years at simple interest. The annual rate is:', options: ['10%', '12.5%', '8%', '15%'], answer: 1, difficulty: 'medium' },
    { q: 'Two dice are rolled. Probability the sum is 7:', options: ['1/6', '1/9', '1/12', '5/36'], answer: 0, difficulty: 'medium' },
    { q: 'A shopkeeper marks up 40% then gives 25% discount. Net profit is:', options: ['5%', '10%', '15%', '0%'], answer: 0, difficulty: 'hard' },
    { q: 'The ratio 3:4 becomes 4:5 when the same number is added to both terms. That number is:', options: ['1', '2', '3', '4'], answer: 3, difficulty: 'hard' },
    { q: 'How many 3-digit numbers can be formed from digits 1-5 without repetition?', options: ['60', '125', '10', '20'], answer: 0, difficulty: 'medium' },
  ],
  logical: [
    { q: 'Find the next term: 2, 6, 12, 20, 30, ?', options: ['40', '42', '36', '45'], answer: 1, difficulty: 'easy' },
    { q: 'If all Bloops are Razzies and all Razzies are Lazzies, then all Bloops are definitely:', options: ['Razzies only', 'Lazzies', 'Neither', 'Cannot say'], answer: 1, difficulty: 'easy' },
    { q: 'Odd one out: Square, Circle, Triangle, Cube', options: ['Square', 'Circle', 'Triangle', 'Cube'], answer: 3, difficulty: 'easy' },
    { q: 'CODE is written as DPEF. How is BOOK written?', options: ['CPPL', 'CNPL', 'CPQM', 'BPPL'], answer: 0, difficulty: 'medium' },
    { q: 'Pointing to a photo a man says "She is the daughter of my grandfather’s only son". The woman is his:', options: ['Sister', 'Daughter', 'Cousin', 'Niece'], answer: 0, difficulty: 'medium' },
    { q: 'Series: 3, 7, 15, 31, ?', options: ['47', '63', '55', '62'], answer: 1, difficulty: 'medium' },
    { q: 'A is south of B. C is east of B. In which direction is C from A?', options: ['North-east', 'South-east', 'North-west', 'South-west'], answer: 0, difficulty: 'medium' },
    { q: 'If EARTH is coded 51840, what is HEART?', options: ['05184', '51840', '04518', '01584'], answer: 0, difficulty: 'hard' },
    { q: 'Statement: All pens are books. Some books are red. Conclusion: Some pens are red. This is:', options: ['Definitely true', 'Definitely false', 'Not necessarily true', 'Contradictory'], answer: 2, difficulty: 'hard' },
    { q: 'Complete: 1, 1, 2, 3, 5, 8, ?', options: ['11', '13', '12', '15'], answer: 1, difficulty: 'easy' },
  ],
  communication: [
    { q: 'The most effective way to open a professional email to a stranger is:', options: ['Hey!', 'A clear subject and a one-line purpose', 'A long personal story', 'No greeting at all'], answer: 1, difficulty: 'easy' },
    { q: 'Active listening primarily involves:', options: ['Planning your reply', 'Reflecting back what you heard', 'Interrupting to clarify', 'Taking verbatim notes'], answer: 1, difficulty: 'easy' },
    { q: 'In a disagreement with a teammate, the strongest first move is:', options: ['Escalate to the manager', 'State your position louder', 'Ask questions to understand their reasoning', 'Drop the issue'], answer: 2, difficulty: 'medium' },
    { q: 'When presenting data to a non-technical audience you should:', options: ['Show all raw tables', 'Lead with the conclusion, then support it', 'Use maximum jargon', 'Avoid visuals'], answer: 1, difficulty: 'medium' },
    { q: 'Constructive feedback is most useful when it is:', options: ['General and gentle', 'Specific and behaviour-focused', 'Delivered publicly', 'Anonymous'], answer: 1, difficulty: 'medium' },
    { q: 'The STAR method structures an answer as:', options: ['Situation, Task, Action, Result', 'Story, Theme, Answer, Review', 'Start, Talk, Ask, Reply', 'Summary, Topic, Action, Reason'], answer: 0, difficulty: 'easy' },
    { q: 'In a status update, the most important item to lead with is:', options: ['Hours worked', 'Blockers and risks', 'Tools used', 'Meeting count'], answer: 1, difficulty: 'medium' },
    { q: 'Written asynchronous communication should favour:', options: ['Brevity with full context', 'Maximum length', 'Ambiguity to stay flexible', 'Voice notes only'], answer: 0, difficulty: 'medium' },
  ],
  os: [
    { q: 'A process differs from a thread mainly because a process has:', options: ['Its own address space', 'A faster scheduler', 'No stack', 'No PID'], answer: 0, difficulty: 'easy' },
    { q: 'Deadlock requires all of the following EXCEPT:', options: ['Mutual exclusion', 'Hold and wait', 'Preemption', 'Circular wait'], answer: 2, difficulty: 'medium' },
    { q: 'Thrashing occurs when:', options: ['CPU is idle', 'Page fault rate is very high', 'Disk is empty', 'Cache is cold'], answer: 1, difficulty: 'medium' },
    { q: 'Round-robin scheduling is characterised by:', options: ['Fixed priorities', 'A time quantum per process', 'Shortest job first', 'No context switching'], answer: 1, difficulty: 'easy' },
    { q: 'A semaphore initialised to 1 behaves like:', options: ['A counter', 'A mutex', 'A condition variable', 'A spinlock only'], answer: 1, difficulty: 'medium' },
    { q: 'Virtual memory primarily allows:', options: ['Faster CPUs', 'Programs larger than physical RAM', 'Fewer processes', 'Lower disk usage'], answer: 1, difficulty: 'easy' },
    { q: 'The LRU page replacement policy evicts:', options: ['The newest page', 'The least recently used page', 'A random page', 'The largest page'], answer: 1, difficulty: 'easy' },
    { q: 'A zombie process is one that:', options: ['Consumes all CPU', 'Has terminated but not been reaped by its parent', 'Never started', 'Runs in kernel mode'], answer: 1, difficulty: 'hard' },
  ],
  dbms: [
    { q: 'ACID stands for Atomicity, Consistency, Isolation and:', options: ['Distribution', 'Durability', 'Dependency', 'Determinism'], answer: 1, difficulty: 'easy' },
    { q: 'A primary key must be:', options: ['Nullable', 'Unique and non-null', 'Indexed only', 'A single column'], answer: 1, difficulty: 'easy' },
    { q: 'Denormalisation is typically done to:', options: ['Save storage', 'Improve read performance', 'Enforce integrity', 'Reduce indexes'], answer: 1, difficulty: 'medium' },
    { q: 'In a B+ tree index, data records are stored:', options: ['In internal nodes', 'Only in leaf nodes', 'In the root', 'Randomly'], answer: 1, difficulty: 'medium' },
    { q: 'A foreign key enforces:', options: ['Uniqueness', 'Referential integrity', 'Ordering', 'Encryption'], answer: 1, difficulty: 'easy' },
    { q: 'Two-phase locking guarantees:', options: ['No deadlocks', 'Serialisability', 'Faster writes', 'Zero contention'], answer: 1, difficulty: 'hard' },
    { q: 'A sharded database splits data:', options: ['Vertically by column only', 'Horizontally across nodes', 'Into indexes', 'Into views'], answer: 1, difficulty: 'medium' },
    { q: 'BASE consistency (NoSQL) trades strong consistency for:', options: ['Durability', 'Availability and partition tolerance', 'Atomicity', 'Isolation'], answer: 1, difficulty: 'medium' },
  ],
  networks: [
    { q: 'TCP differs from UDP because TCP is:', options: ['Connectionless', 'Connection-oriented and reliable', 'Faster always', 'Broadcast only'], answer: 1, difficulty: 'easy' },
    { q: 'HTTP runs by default on port:', options: ['21', '80', '443', '22'], answer: 1, difficulty: 'easy' },
    { q: 'DNS primarily resolves:', options: ['IP to MAC', 'Domain names to IP addresses', 'Ports to protocols', 'URLs to files'], answer: 1, difficulty: 'easy' },
    { q: 'The TCP three-way handshake sequence is:', options: ['SYN, ACK, FIN', 'SYN, SYN-ACK, ACK', 'ACK, SYN, ACK', 'FIN, ACK, FIN'], answer: 1, difficulty: 'medium' },
    { q: 'Which layer of the OSI model does a router primarily operate at?', options: ['Layer 2', 'Layer 3', 'Layer 4', 'Layer 7'], answer: 1, difficulty: 'medium' },
    { q: 'HTTPS adds which property over HTTP?', options: ['Compression', 'Transport encryption and authentication', 'Caching', 'Streaming'], answer: 1, difficulty: 'easy' },
    { q: 'NAT is used mainly to:', options: ['Encrypt traffic', 'Map private addresses to a public one', 'Route by content', 'Balance load'], answer: 1, difficulty: 'medium' },
    { q: 'A CDN improves latency primarily by:', options: ['Compressing HTML', 'Serving content from edge locations near users', 'Using UDP', 'Reducing DNS lookups'], answer: 1, difficulty: 'medium' },
  ],
  react: [
    { q: 'A React component re-renders when:', options: ['The file is saved', 'Its state or props change', 'Every second', 'Only on mount'], answer: 1, difficulty: 'easy' },
    { q: '`useEffect` with an empty dependency array runs:', options: ['On every render', 'Once after mount', 'Never', 'Only on unmount'], answer: 1, difficulty: 'easy' },
    { q: 'Keys in a list help React:', options: ['Sort items', 'Identify which items changed', 'Style items', 'Fetch data'], answer: 1, difficulty: 'easy' },
    { q: '`useMemo` is appropriate when:', options: ['Every value should be cached', 'A computation is expensive and inputs rarely change', 'You need side effects', 'You need refs'], answer: 1, difficulty: 'medium' },
    { q: 'Lifting state up means:', options: ['Using global variables', 'Moving shared state to a common ancestor', 'Using refs', 'Rendering on the server'], answer: 1, difficulty: 'medium' },
    { q: 'A stale closure in a hook usually comes from:', options: ['Too many renders', 'Missing dependencies in the dependency array', 'Using const', 'Async functions'], answer: 1, difficulty: 'hard' },
    { q: 'Context is best used for:', options: ['All state', 'Low-frequency global values like theme or auth', 'Form inputs', 'Animation frames'], answer: 1, difficulty: 'medium' },
    { q: 'Controlled inputs derive their value from:', options: ['The DOM', 'Component state', 'Refs', 'Local storage'], answer: 1, difficulty: 'easy' },
  ],
  statistics: [
    { q: 'The mean is more sensitive than the median to:', options: ['Sample size', 'Outliers', 'Units', 'Ordering'], answer: 1, difficulty: 'easy' },
    { q: 'A p-value of 0.03 at alpha = 0.05 means:', options: ['Accept the null', 'Reject the null', 'The effect is large', 'The sample is biased'], answer: 1, difficulty: 'medium' },
    { q: 'The Central Limit Theorem says sample means approach:', options: ['A uniform distribution', 'A normal distribution', 'The population distribution', 'Zero'], answer: 1, difficulty: 'medium' },
    { q: 'Correlation of -0.9 indicates:', options: ['No relationship', 'Strong negative linear relationship', 'Causation', 'Weak positive relationship'], answer: 1, difficulty: 'easy' },
    { q: 'A Type I error is:', options: ['Failing to reject a false null', 'Rejecting a true null', 'A sampling error', 'A rounding error'], answer: 1, difficulty: 'medium' },
    { q: 'Standard deviation measures:', options: ['Central tendency', 'Spread around the mean', 'Skewness', 'Sample size'], answer: 1, difficulty: 'easy' },
    { q: 'A 95% confidence interval means:', options: ['95% of data lies inside', '95% of such intervals contain the true parameter', 'The mean is 95% accurate', 'p = 0.95'], answer: 1, difficulty: 'hard' },
    { q: 'Simpson’s paradox arises from:', options: ['Small samples', 'A confounding grouping variable', 'Measurement error', 'Non-normality'], answer: 1, difficulty: 'hard' },
  ],
  ml: [
    { q: 'Overfitting means the model:', options: ['Underperforms on training data', 'Fits training noise and generalises poorly', 'Has too few parameters', 'Converges too slowly'], answer: 1, difficulty: 'easy' },
    { q: 'Which is an unsupervised algorithm?', options: ['Linear regression', 'K-means clustering', 'Random forest classifier', 'Logistic regression'], answer: 1, difficulty: 'easy' },
    { q: 'Regularisation (L1/L2) primarily helps with:', options: ['Speed', 'Overfitting', 'Data cleaning', 'Feature creation'], answer: 1, difficulty: 'medium' },
    { q: 'Precision is defined as:', options: ['TP / (TP + FN)', 'TP / (TP + FP)', '(TP + TN) / total', 'FP / total'], answer: 1, difficulty: 'medium' },
    { q: 'Cross-validation is used to:', options: ['Increase dataset size', 'Estimate out-of-sample performance', 'Speed up training', 'Remove outliers'], answer: 1, difficulty: 'easy' },
    { q: 'The bias-variance tradeoff says a very flexible model tends to have:', options: ['High bias, low variance', 'Low bias, high variance', 'Both high', 'Both low'], answer: 1, difficulty: 'medium' },
    { q: 'Gradient descent can stall because of:', options: ['Too much data', 'A learning rate that is too large or too small', 'Too many features only', 'Normalisation'], answer: 1, difficulty: 'medium' },
    { q: 'For a heavily imbalanced binary dataset, accuracy is a poor metric because:', options: ['It is slow', 'Predicting the majority class alone scores high', 'It needs probabilities', 'It ignores TP'], answer: 1, difficulty: 'hard' },
  ],
  uiux: [
    { q: 'Fitts’s Law relates target acquisition time to:', options: ['Colour contrast', 'Target size and distance', 'Font family', 'Animation length'], answer: 1, difficulty: 'medium' },
    { q: 'The minimum recommended touch target size on mobile is roughly:', options: ['16dp', '24dp', '44-48dp', '80dp'], answer: 2, difficulty: 'easy' },
    { q: 'WCAG AA requires a contrast ratio for normal body text of at least:', options: ['2:1', '3:1', '4.5:1', '7:1'], answer: 2, difficulty: 'medium' },
    { q: 'A wireframe differs from a mockup because it:', options: ['Includes final colours', 'Focuses on structure over visual detail', 'Is interactive', 'Is code'], answer: 1, difficulty: 'easy' },
    { q: 'Progressive disclosure means:', options: ['Showing everything at once', 'Revealing complexity only as needed', 'Hiding errors', 'Lazy loading images'], answer: 1, difficulty: 'medium' },
    { q: 'Usability testing with 5 users typically surfaces about:', options: ['20% of issues', '50% of issues', '80% of issues', '100% of issues'], answer: 2, difficulty: 'medium' },
    { q: 'Consistency in a design system primarily reduces:', options: ['File size', 'Cognitive load', 'Render time', 'Colour count'], answer: 1, difficulty: 'easy' },
    { q: 'An empty state should mainly:', options: ['Be blank', 'Explain the state and offer the next action', 'Show an error', 'Auto-redirect'], answer: 1, difficulty: 'easy' },
  ],
  productthinking: [
    { q: 'A good product metric should be:', options: ['Easy to game', 'Actionable and tied to user value', 'Vanity-friendly', 'Static'], answer: 1, difficulty: 'medium' },
    { q: 'An MVP exists primarily to:', options: ['Ship the cheapest thing', 'Validate a hypothesis with minimum effort', 'Impress investors', 'Replace research'], answer: 1, difficulty: 'easy' },
    { q: 'When users request a feature, the strongest first response is to:', options: ['Build it immediately', 'Understand the underlying problem', 'Reject it', 'Poll everyone'], answer: 1, difficulty: 'medium' },
    { q: 'North Star metric should reflect:', options: ['Revenue only', 'Core user value delivered', 'Headcount', 'Sprint velocity'], answer: 1, difficulty: 'medium' },
    { q: 'A/B testing requires:', options: ['Equal feature sets', 'Random assignment and sufficient sample size', 'A single user', 'No control group'], answer: 1, difficulty: 'medium' },
    { q: 'Prioritisation frameworks like RICE weigh reach, impact, confidence and:', options: ['Revenue', 'Effort', 'Risk', 'Recency'], answer: 1, difficulty: 'easy' },
    { q: 'Churn is best diagnosed by:', options: ['Adding features', 'Cohort analysis and user interviews', 'Lowering price', 'More marketing'], answer: 1, difficulty: 'medium' },
    { q: 'A product requirements doc should primarily specify:', options: ['Implementation details', 'Problem, users, success criteria and scope', 'Database schema', 'Sprint dates'], answer: 1, difficulty: 'easy' },
  ],
};

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

// Idempotent seeding of the reference collections. Safe to call on every request;
// each collection is only written when it is empty.
async function ensureCareerSeed(db) {
  const [assessmentCount, driveCount, mentorCount] = await Promise.all([
    db.collection('assessments').estimatedDocumentCount(),
    db.collection('placement_drives').estimatedDocumentCount(),
    db.collection('mentors').estimatedDocumentCount(),
  ]);

  const now = new Date().toISOString();

  if (!assessmentCount) {
    const docs = ASSESSMENT_TEMPLATES.filter(t => (QUESTION_BANK[t.skillKey] || []).length).map(t => ({
      ...t,
      skillName: SKILL_BY_KEY.get(t.skillKey)?.name || t.skillKey,
      category: SKILL_BY_KEY.get(t.skillKey)?.category || 'core_engineering',
      totalQuestions: Math.min(t.questionCount, QUESTION_BANK[t.skillKey].length),
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
  QUESTION_BANK,
  ASSESSMENT_TEMPLATES,
  SEED_COMPANIES,
  PLACEMENT_ROUNDS,
  DEPARTMENT_ALIASES,
  canonicalDepartment,
  departmentMatches,
  SEED_MENTORS,
  ensureCareerSeed,
};
