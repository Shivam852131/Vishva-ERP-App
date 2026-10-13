// Prefer the developer's local .env when present (unchanged local behaviour);
// otherwise fall back to the shared test env (gitignored .env.test, else the
// committed .env.test.example) so this harness runs on a fresh checkout —
// CI has no .env and a test script must never need a secret file.
const fs = require('fs');
const path = require('path');
if (fs.existsSync(path.resolve(__dirname, '.env'))) require('dotenv').config();
else require('./tests/loadTestEnv');
const http = require('http');
const { ObjectId } = require('mongodb');
const { connectDB, closeDB } = require('./src/db');
const { createApp } = require('./src/app');
const { createSocketServer } = require('./src/socket');

async function runExamPrepTests() {
  console.log('=== STARTING EXAM PREP INTEGRATION TESTS ===\n');
  const db = await connectDB();
  const io = createSocketServer();
  const app = createApp(io);
  const server = http.createServer(app);
  io.attach(server);

  const TEST_PORT = 8098;
  await new Promise(r => server.listen(TEST_PORT, r));
  console.log(`[SERVER] Test server listening on http://127.0.0.1:${TEST_PORT}\n`);

  function req(method, path, body, token) {
    return new Promise((resolve, reject) => {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;
      const r = http.request({ hostname: '127.0.0.1', port: TEST_PORT, path, method, headers }, res => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      });
      r.on('error', reject);
      if (body) r.write(JSON.stringify(body));
      r.end();
    });
  }

  // Multipart file upload helper — exercises the multer-backed import route.
  function uploadFile(path, token, fileName, mime, buf) {
    return new Promise((resolve, reject) => {
      const boundary = '----examPrepTest' + Date.now();
      const head = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mime}\r\n\r\n`
      );
      const payload = Buffer.concat([head, buf, Buffer.from(`\r\n--${boundary}--\r\n`)]);
      const r = http.request({
        hostname: '127.0.0.1', port: TEST_PORT, path, method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': payload.length,
          Authorization: 'Bearer ' + token,
        },
      }, res => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      });
      r.on('error', reject);
      r.write(payload);
      r.end();
    });
  }

  let passed = 0, failed = 0;
  function check(label, condition, details) {
    if (condition) {
      passed++;
      console.log(`  [PASS] ${label}`);
    } else {
      failed++;
      console.log(`  [FAIL] ${label}`, details ? `--> ${JSON.stringify(details)}` : '');
    }
  }

  try {
    const ts = Date.now();

    // 1. Setup Student & Faculty users
    console.log('--- 1. Auth & Role Setup ---');
    const studentReg = await req('POST', '/api/auth/register', {
      name: 'Prep Test Student',
      email: `student_prep_${ts}@campus.edu`,
      password: 'password123',
      role: 'student',
    });
    check('Student register (200)', studentReg.status === 200 && studentReg.body.token);
    const studentToken = studentReg.body.token;

    const facultyReg = await req('POST', '/api/auth/register', {
      name: 'Prep Test Faculty',
      email: `faculty_prep_${ts}@campus.edu`,
      password: 'password123',
      role: 'faculty',
    });
    check('Faculty register (200)', facultyReg.status === 200 && facultyReg.body.token);
    const facultyToken = facultyReg.body.token;

    // 2. Question Bank: Role Gating & Creation
    console.log('\n--- 2. Question Bank & Role Gating ---');
    const studentCreate = await req('POST', '/api/exam-prep/questions', {
      subject: 'Computer Science',
      topic: 'Data Structures',
      question: 'Unauthorized student question?',
      options: ['A', 'B', 'C', 'D'],
      answer: 0,
      difficulty: 'easy',
    }, studentToken);
    check('Student cannot create questions (403)', studentCreate.status === 403);

    const facultyCreate1 = await req('POST', '/api/exam-prep/questions', {
      subject: 'Data Structures',
      topic: 'Arrays',
      question: 'What is the time complexity to access an element in an array by index?',
      options: ['O(1)', 'O(n)', 'O(log n)', 'O(n^2)'],
      answer: 0,
      difficulty: 'easy',
      education_level: 'college',
      explanation: 'Array elements are stored in contiguous memory addresses.',
    }, facultyToken);
    check('Faculty creates question 1 (201)', facultyCreate1.status === 201 && facultyCreate1.body.id);
    const q1Id = facultyCreate1.body.id;

    const facultyCreate2 = await req('POST', '/api/exam-prep/questions', {
      subject: 'Data Structures',
      topic: 'Trees',
      question: 'What is the maximum number of children a binary tree node can have?',
      options: ['1', '2', '3', 'Unlimited'],
      answer: 1,
      difficulty: 'easy',
      education_level: 'college',
      explanation: 'Binary tree nodes can have at most two children: left and right.',
    }, facultyToken);
    check('Faculty creates question 2 (201)', facultyCreate2.status === 201 && facultyCreate2.body.id);
    const q2Id = facultyCreate2.body.id;

    // Bulk Import
    const bulkImport = await req('POST', '/api/exam-prep/questions/bulk', {
      questions: [
        {
          subject: 'Data Structures',
          topic: 'Sorting',
          question: 'Which sorting algorithm has average O(n log n) time complexity?',
          options: ['Bubble Sort', 'Quick Sort', 'Insertion Sort', 'Selection Sort'],
          answer: 1,
          difficulty: 'medium',
          explanation: 'Quick sort average complexity is O(n log n).',
        },
        {
          subject: 'Data Structures',
          topic: 'Graphs',
          question: 'Which traversal algorithm uses a queue data structure?',
          options: ['DFS', 'BFS', 'Inorder', 'Postorder'],
          answer: 1,
          difficulty: 'medium',
          explanation: 'Breadth-First Search uses a FIFO queue.',
        },
      ],
    }, facultyToken);
    check('Faculty bulk imports questions (201/200, count >= 2)', (bulkImport.status === 201 || bulkImport.status === 200) && bulkImport.body.inserted >= 2);

    // List Questions: Verify Answer Hiding for Students
    const studentList = await req('GET', '/api/exam-prep/questions?subject=' + encodeURIComponent('Data Structures'), null, studentToken);
    check('Student lists questions (200)', studentList.status === 200 && Array.isArray(studentList.body));
    const studentQ1 = studentList.body.find(q => q.id === q1Id);
    check('Student cannot see correct answer in list', studentQ1 && studentQ1.answer === undefined);

    const facultyList = await req('GET', '/api/exam-prep/questions?subject=' + encodeURIComponent('Data Structures'), null, facultyToken);
    const facultyQ1 = facultyList.body.find(q => q.id === q1Id);
    check('Faculty can see correct answer in list', facultyQ1 && facultyQ1.answer === 0);

    // Stats
    const statsRes = await req('GET', '/api/exam-prep/questions/stats', null, facultyToken);
    check('Question stats breakdown (total >= 4)', statsRes.status === 200 && statsRes.body.total >= 4);

    // 3. AI Question Generation
    console.log('\n--- 3. AI Question Generation ---');
    const aiGen = await req('POST', '/api/exam-prep/generate-ai', {
      subject: 'Algorithms',
      topic: 'Binary Search',
      difficulty: 'medium',
      count: 2,
    }, facultyToken);
    check('AI generates valid MCQ format questions (200)', aiGen.status === 200 && aiGen.body.questions?.length > 0);

    // 4. Quiz Builder & Scheduling
    console.log('\n--- 4. Quiz Builder & Scheduling ---');
    const quizCreate = await req('POST', '/api/exam-prep/quizzes', {
      title: 'Data Structures Mid-Term Mock Test',
      subject: 'Data Structures',
      topic: 'Core Foundations',
      duration_minutes: 30,
      pass_score: 50,
      question_ids: [q1Id, q2Id],
      is_practice: false,
      shuffle_questions: true,
      shuffle_options: false,
    }, facultyToken);
    check('Faculty creates quiz (201)', quizCreate.status === 201 && quizCreate.body.id);
    const quizId = quizCreate.body.id;

    // Schedule & Publish Quiz
    const quizSchedule = await req('POST', `/api/exam-prep/quizzes/${quizId}/schedule`, {
      window_start: new Date(Date.now() - 3600000).toISOString(),
      window_end: new Date(Date.now() + 86400000).toISOString(),
      publish: true,
    }, facultyToken);
    check('Faculty publishes & schedules quiz window (200)', quizSchedule.status === 200 && quizSchedule.body.status === 'published');

    // 5. Student Timed Quiz Attempt & Scoring
    console.log('\n--- 5. Timed Quiz Attempt & Scoring ---');
    const startAttempt = await req('POST', `/api/exam-prep/quizzes/${quizId}/start`, {}, studentToken);
    check('Student starts timed attempt (201/200)', (startAttempt.status === 201 || startAttempt.status === 200) && startAttempt.body.attempt_id);
    const attemptId = startAttempt.body.attempt_id;
    check('Quiz payload provides seconds_remaining', typeof startAttempt.body.seconds_remaining === 'number');
    check('Quiz payload returns questions count = 2', startAttempt.body.questions?.length === 2);

    // Auto-save Answer for Question 0 (find which option is the correct text in q0.options)
    const q0 = startAttempt.body.questions[0];
    const q0Original = q0.question_id === q1Id ? facultyCreate1.body : facultyCreate2.body;
    const correctText0 = q0Original.options[q0Original.answer];
    const optionIndex0 = q0.options.indexOf(correctText0);

    const saveAnswer0 = await req('POST', `/api/exam-prep/attempts/${attemptId}/answer`, {
      index: 0,
      optionIndex: optionIndex0 >= 0 ? optionIndex0 : 0,
    }, studentToken);
    check('Autosave answer index 0 (200)', saveAnswer0.status === 200 && saveAnswer0.body.success === true);

    // Auto-save Answer for Question 1 (find which option is the correct text in q1.options)
    const q1 = startAttempt.body.questions[1];
    const q1Original = q1.question_id === q1Id ? facultyCreate1.body : facultyCreate2.body;
    const correctText1 = q1Original.options[q1Original.answer];
    const optionIndex1 = q1.options.indexOf(correctText1);

    const saveAnswer1 = await req('POST', `/api/exam-prep/attempts/${attemptId}/answer`, {
      index: 1,
      optionIndex: optionIndex1 >= 0 ? optionIndex1 : 0,
    }, studentToken);
    check('Autosave answer index 1 (200)', saveAnswer1.status === 200 && saveAnswer1.body.success === true);

    // Resume / GET attempt
    const getAttempt = await req('GET', `/api/exam-prep/attempts/${attemptId}`, null, studentToken);
    check('GET /exam-prep/attempts/:aid returns saved answers', getAttempt.status === 200 && getAttempt.body.answers[0] !== undefined);

    // Submit attempt
    const submitAttempt = await req('POST', `/api/exam-prep/attempts/${attemptId}/submit`, {}, studentToken);
    check('Submit attempt (200)', submitAttempt.status === 200);
    check('Server-side scoring calculates 100% (2/2 correct)', submitAttempt.body.score_percent === 100 && submitAttempt.body.correct === 2, submitAttempt.body);
    check('Passed status = true', submitAttempt.body.passed === true);
    check('Breakdown items include detailed explanations', submitAttempt.body.breakdown?.length === 2 && Boolean(submitAttempt.body.breakdown[0].explanation));

    // Quiz Analytics for Faculty
    const analyticsRes = await req('GET', `/api/exam-prep/quizzes/${quizId}/analytics`, null, facultyToken);
    check('Faculty gets quiz analytics with attempts count >= 1', analyticsRes.status === 200 && analyticsRes.body.stats?.total_attempts >= 1);
    check('Analytics includes top students leaderboard', analyticsRes.body.top_students?.length >= 1);

    // 6. Adaptive Practice Mode
    console.log('\n--- 6. Adaptive Practice Mode ---');
    const startPractice = await req('POST', '/api/exam-prep/practice/start', {
      subject: 'Data Structures',
      count: 2,
    }, studentToken);
    check('Student starts practice session (201)', startPractice.status === 201 && startPractice.body.session_id);
    const practiceId = startPractice.body.session_id;

    // Answer practice question
    const practiceAnswer = await req('POST', `/api/exam-prep/practice/${practiceId}/answer`, {
      index: 0,
      optionIndex: 0,
    }, studentToken);
    check('Practice answer reveals immediate feedback & explanation (200)', practiceAnswer.status === 200 && typeof practiceAnswer.body.correct === 'boolean' && Boolean(practiceAnswer.body.explanation));

    // Submit practice
    const submitPractice = await req('POST', `/api/exam-prep/practice/${practiceId}/submit`, {}, studentToken);
    check('Practice session submit finishes cleanly (200)', submitPractice.status === 200 && typeof submitPractice.body.score_percent === 'number');

    // 7. Bookmarks
    console.log('\n--- 7. Bookmarks ---');
    const addBookmark = await req('POST', '/api/exam-prep/bookmarks', {
      question_id: q1Id,
      note: 'Important array question to review before finals',
    }, studentToken);
    check('Student bookmarks question (201)', addBookmark.status === 201 && addBookmark.body.id);

    const listBookmarks = await req('GET', '/api/exam-prep/bookmarks', null, studentToken);
    check('Student lists bookmarks (count >= 1)', listBookmarks.status === 200 && listBookmarks.body.length >= 1);

    const deleteBookmark = await req('DELETE', `/api/exam-prep/bookmarks/${q1Id}`, null, studentToken);
    check('Student deletes bookmark (200)', deleteBookmark.status === 200 && deleteBookmark.body.ok);

    // 8. Personalised Student Dashboard
    console.log('\n--- 8. Personalised Student Dashboard ---');
    const dashboardRes = await req('GET', '/api/exam-prep/dashboard', null, studentToken);
    check('Student dashboard loads stats & recommendations (200)', dashboardRes.status === 200 && dashboardRes.body.stats);
    check('Dashboard includes recent attempts', dashboardRes.body.recent_attempts?.length >= 1);
    check('Dashboard includes available quizzes', Array.isArray(dashboardRes.body.available_quizzes));
    check('Dashboard includes recommendations', Array.isArray(dashboardRes.body.recommendations));

    // ════════════════════════════════════════════════════════════
    // 9. Integrity regressions: timer, answer-key leak, RBAC
    // ════════════════════════════════════════════════════════════
    console.log('\n--- 9. Timer Enforcement & Answer-Key Protection ---');

    // 9a. Bookmarks must not leak the answer key to students
    await req('POST', '/api/exam-prep/bookmarks', { question_id: q1Id }, studentToken);
    const leakCheck = await req('GET', '/api/exam-prep/bookmarks', null, studentToken);
    if (!Array.isArray(leakCheck.body)) {
      check('Bookmark payload hides the answer from students', false, { status: leakCheck.status, body: leakCheck.body });
    } else {
      const leaked = leakCheck.body.find(b => b.question_id === q1Id);
      check('Bookmark payload hides the answer from students',
        Boolean(leaked && leaked.question && leaked.question.answer === undefined),
        { found: Boolean(leaked), hasQuestion: Boolean(leaked?.question) });
    }
    await req('DELETE', `/api/exam-prep/bookmarks/${q1Id}`, null, studentToken);

    // 9b. Students cannot read unpublished quizzes
    const draftQuiz = await req('POST', '/api/exam-prep/quizzes', {
      title: 'Unpublished Draft Quiz',
      subject: 'Data Structures',
      question_ids: [q1Id, q2Id],
      status: 'draft',
    }, facultyToken);
    check('Faculty creates a draft quiz (201)', draftQuiz.status === 201 && draftQuiz.body.id);
    const draftRead = await req('GET', `/api/exam-prep/quizzes/${draftQuiz.body.id}`, null, studentToken);
    check('Student cannot read a draft quiz (404)', draftRead.status === 404);

    // 9c. Out-of-range answer index is rejected on write
    const badAnswer = await req('POST', '/api/exam-prep/questions', {
      subject: 'Data Structures',
      question: 'Answer index out of range?',
      options: ['A', 'B'],
      answer: 7,
    }, facultyToken);
    check('Answer index outside the options array is rejected (400)', badAnswer.status === 400);

    // 9d. Malformed regex in search does not 500
    const evilSearch = await req('GET', '/api/exam-prep/questions?search=' + encodeURIComponent('(unclosed['), null, studentToken);
    check('Regex metacharacters in search are escaped (200)', evilSearch.status === 200);

    // ════════════════════════════════════════════════════════════
    // 10. Timer expiry: late submit cannot be scored, expired burns an attempt
    // ════════════════════════════════════════════════════════════
    console.log('\n--- 10. Timer Expiry ---');
    const timedQuiz = await req('POST', '/api/exam-prep/quizzes', {
      title: 'Timed Expiry Quiz',
      subject: 'Data Structures',
      question_ids: [q1Id, q2Id],
      duration_minutes: 5,
      pass_score: 50,
    }, facultyToken);
    check('Faculty creates a timed quiz (201)', timedQuiz.status === 201 && timedQuiz.body.id);
    await req('POST', `/api/exam-prep/quizzes/${timedQuiz.body.id}/schedule`, {
      window_start: new Date(Date.now() - 3600000).toISOString(),
      window_end: new Date(Date.now() + 86400000).toISOString(),
    }, facultyToken);

    const timedAttempt = await req('POST', `/api/exam-prep/quizzes/${timedQuiz.body.id}/start`, {}, studentToken);
    check('Student starts the timed quiz (201)', timedAttempt.status === 201 && timedAttempt.body.attempt_id);
    const timedAttemptId = timedAttempt.body.attempt_id;

    // Autosave one answer, then force the clock past the grace window.
    const tq0 = timedAttempt.body.questions[0];
    const tq0Original = tq0.question_id === q1Id ? facultyCreate1.body : facultyCreate2.body;
    await req('POST', `/api/exam-prep/attempts/${timedAttemptId}/answer`, {
      index: 0,
      optionIndex: tq0.options.indexOf(tq0Original.options[tq0Original.answer]),
    }, studentToken);

    await db.collection('exam_prep_attempts').updateOne(
      { _id: new ObjectId(timedAttemptId) },
      { $set: { expiresAt: new Date(Date.now() - 120000).toISOString() } }
    );

    const lateAnswer = await req('POST', `/api/exam-prep/attempts/${timedAttemptId}/answer`, { index: 1, optionIndex: 0 }, studentToken);
    check('Autosave after the deadline is rejected (409)', lateAnswer.status === 409);

    // A submit carrying brand-new answers after the deadline must be ignored:
    // only what was autosaved before expiry may be scored.
    const lateSubmit = await req('POST', `/api/exam-prep/attempts/${timedAttemptId}/submit`, {
      answers: { 0: 0, 1: 0 },
    }, studentToken);
    check('Late submit is scored as expired, not as a normal submit', lateSubmit.status === 200 && lateSubmit.body.expired === true, lateSubmit.body);
    check('Late submit only counts autosaved answers (1 of 2 answered)', lateSubmit.body.correct <= 1, lateSubmit.body);

    const resubmit = await req('POST', `/api/exam-prep/attempts/${timedAttemptId}/submit`, { answers: { 0: 0, 1: 0 } }, studentToken);
    check('Expired attempt cannot be resurrected by a second submit', resubmit.body.expired === true, resubmit.body);

    const afterExpiry = await db.collection('exam_prep_attempts')
      .findOne({ _id: new ObjectId(timedAttemptId) });
    check('Expired attempt stays expired in the database', afterExpiry.status === 'expired', afterExpiry.status);

    // maxAttempts must be consumed by the expiry
    const limitedQuiz = await req('POST', '/api/exam-prep/quizzes', {
      title: 'Single Attempt Quiz',
      subject: 'Data Structures',
      question_ids: [q1Id, q2Id],
      duration_minutes: 5,
      max_attempts: 1,
    }, facultyToken);
    await req('POST', `/api/exam-prep/quizzes/${limitedQuiz.body.id}/schedule`, {
      window_start: new Date(Date.now() - 3600000).toISOString(),
      window_end: new Date(Date.now() + 86400000).toISOString(),
    }, facultyToken);

    const firstLimited = await req('POST', `/api/exam-prep/quizzes/${limitedQuiz.body.id}/start`, {}, studentToken);
    check('Student starts the single-attempt quiz (201)', firstLimited.status === 201 && firstLimited.body.attempt_id);
    await db.collection('exam_prep_attempts').updateOne(
      { _id: new ObjectId(firstLimited.body.attempt_id) },
      { $set: { expiresAt: new Date(Date.now() - 120000).toISOString() } }
    );
    const secondLimited = await req('POST', `/api/exam-prep/quizzes/${limitedQuiz.body.id}/start`, {}, studentToken);
    check('Expiring an attempt consumes it (second start rejected 409)', secondLimited.status === 409, secondLimited.body);
    check('Second start reports the attempt limit', /maximum of 1 attempt/.test(secondLimited.body?.detail || ''), secondLimited.body);

    // ════════════════════════════════════════════════════════════
    // 11. RBAC on student-only endpoints
    // ════════════════════════════════════════════════════════════
    console.log('\n--- 11. Student-Only Endpoint Gating ---');
    const facultyDashboard = await req('GET', '/api/exam-prep/dashboard', null, facultyToken);
    check('Faculty cannot read the student dashboard (403)', facultyDashboard.status === 403);
    const facultyAttempts = await req('GET', '/api/exam-prep/my-attempts', null, facultyToken);
    check('Faculty cannot read my-attempts (403)', facultyAttempts.status === 403);
    const facultyRecs = await req('GET', '/api/exam-prep/recommendations', null, facultyToken);
    check('Faculty cannot read recommendations (403)', facultyRecs.status === 403);
    const facultySubmit = await req('POST', `/api/exam-prep/attempts/${attemptId}/submit`, {}, facultyToken);
    check('Faculty cannot submit a student attempt (403)', facultySubmit.status === 403);
    const facultyPractice = await req('POST', '/api/exam-prep/practice/start', { subject: 'Data Structures', count: 1 }, facultyToken);
    check('Faculty cannot start a practice session (403)', facultyPractice.status === 403);

    // ════════════════════════════════════════════════════════════
    // 12. File import: .xlsx / .csv via multipart
    // ════════════════════════════════════════════════════════════
    console.log('\n--- 12. Spreadsheet / CSV Import ---');

    // Build a real workbook in-memory so the exceljs parser is exercised.
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Questions');
    ws.addRow(['question', 'option_a', 'option_b', 'option_c', 'option_d', 'answer', 'subject', 'topic', 'difficulty', 'explanation']);
    ws.addRow(['Imported: what is 2+2?', '3', '4', '5', '6', 'B', 'Imported Subject', 'Addition', 'easy', 'From spreadsheet']);
    ws.addRow(['Imported: largest planet?', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Jupiter', 'Imported Subject', 'Space', 'medium', '']);
    ws.addRow(['', '', '', '', '', '', '', '', '', '']);
    const notes = wb.addWorksheet('Notes');
    notes.addRow(['this sheet should be reported as unused']);
    const xlsxBuf = Buffer.from(await wb.xlsx.writeBuffer());

    const xlsxUp = await uploadFile('/api/exam-prep/questions/upload', facultyToken,
      'bank.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xlsxBuf);
    check('xlsx upload accepted (201)', xlsxUp.status === 201, xlsxUp.body);
    check('xlsx imported 2 questions', xlsxUp.body.inserted === 2, xlsxUp.body);
    check('xlsx rows had no validation errors', Array.isArray(xlsxUp.body.errors) && xlsxUp.body.errors.length === 0, xlsxUp.body.errors);
    check('xlsx reports both sheets', (xlsxUp.body.sheets || []).length === 2, xlsxUp.body.sheets);
    check('xlsx reports the unused sheet', (xlsxUp.body.unused_sheets || []).includes('Notes'), xlsxUp.body);

    const csvImport = [
      'question,option_a,option_b,option_c,option_d,answer,subject,topic,difficulty,explanation',
      '"Imported CSV: capital of France?","Paris","London","Berlin","Rome",A,Imported Subject,Capitals,easy,"France capital"',
      '"Imported CSV: he said ""hi""","Yes","No","","",B,Imported Subject,Quotes,medium,',
      ',,,,,,,,',
    ].join('\n');
    const csvUp = await uploadFile('/api/exam-prep/questions/upload', facultyToken, 'bank.csv', 'text/csv', Buffer.from(csvImport, 'utf8'));
    check('csv upload accepted (201)', csvUp.status === 201, csvUp.body);
    check('csv imported 2 questions (blank row skipped)', csvUp.body.inserted === 2, csvUp.body);
    const csvQuestionCheck = await req('GET', '/api/exam-prep/questions?search=' + encodeURIComponent('Imported CSV: he said'), null, facultyToken);
    const csvQ = Array.isArray(csvQuestionCheck.body) && csvQuestionCheck.body[0];
    check('csv escaped quotes round-trip', Boolean(csvQ && csvQ.question.includes('"hi"')), csvQ);

    // Rows with an out-of-range answer must be rejected with a reason, not stored.
    const badImport = 'question,option_a,option_b,answer\nQ1,A,B,9\nQ2,A,B,1\n';
    const badUp = await uploadFile('/api/exam-prep/questions/upload', facultyToken, 'bad.csv', 'text/csv', Buffer.from(badImport, 'utf8'));
    check('invalid answer row is reported, valid rows still import', badUp.status === 201 && badUp.body.inserted === 1, badUp.body);
    check('rejection carries a human-readable reason', badUp.body.errors?.length === 1 && /answer must be/.test(badUp.body.errors[0].reason || ''), badUp.body.errors);

    const allBad = await uploadFile('/api/exam-prep/questions/upload', facultyToken, 'allbad.csv', 'text/csv', Buffer.from('question,option_a,option_b,answer\nQ1,A,B,9\n', 'utf8'));
    check('entirely invalid file rejected (400)', allBad.status === 400, allBad);

    const unsupported = await uploadFile('/api/exam-prep/questions/upload', facultyToken, 'payload.exe', 'application/octet-stream', Buffer.from('MZ'));
    check('unsupported file type rejected (400)', unsupported.status === 400, unsupported);

    const noFile = await uploadFile('/api/exam-prep/questions/upload', facultyToken, '', 'application/octet-stream', Buffer.alloc(0));
    check('missing file rejected (400)', noFile.status === 400, noFile);

    const studentUpload = await uploadFile('/api/exam-prep/questions/upload', studentToken, 'bank.csv', 'text/csv', Buffer.from(csvImport, 'utf8'));
    check('student cannot import a file (403)', studentUpload.status === 403, studentUpload);

    // ════════════════════════════════════════════════════════════
    // 13. Practice session resume (GET /practice/:sid)
    // ════════════════════════════════════════════════════════════
    console.log('\n--- 13. Practice Session Resume ---');
    const resumeStart = await req('POST', '/api/exam-prep/practice/start', { subject: 'Data Structures', count: 3 }, studentToken);
    check('Resume test session starts (201)', resumeStart.status === 201 && resumeStart.body.session_id, resumeStart.body);
    const resumeId = resumeStart.body.session_id;
    const resumeCount = resumeStart.body.total_questions;
    await req('POST', `/api/exam-prep/practice/${resumeId}/answer`, { index: 0, optionIndex: 1 }, studentToken);

    const inProgress = await req('GET', `/api/exam-prep/practice/${resumeId}`, null, studentToken);
    check('In-progress session is readable (200)', inProgress.status === 200, inProgress.body);
    check('In-progress payload returns all questions', inProgress.body.questions?.length === resumeCount && resumeCount > 0, { got: inProgress.body.questions?.length, want: resumeCount });
    check('In-progress payload restores saved answers', inProgress.body.answers?.[0] === 1, inProgress.body.answers);
    check('In-progress payload hides correct_index', Array.isArray(inProgress.body.questions) && inProgress.body.questions.every(q => q.correct_index === undefined), inProgress.body.questions?.[0]);
    check('In-progress payload hides explanations', Array.isArray(inProgress.body.questions) && inProgress.body.questions.every(q => q.explanation === undefined), inProgress.body.questions?.[0]);

    const resumeFaculty = await req('GET', `/api/exam-prep/practice/${resumeId}`, null, facultyToken);
    check('Faculty cannot read a student session (403)', resumeFaculty.status === 403, resumeFaculty);

    const resumeOther = await req('POST', '/api/auth/register', { name: 'Other', email: `other_${ts}@campus.edu`, password: 'password123', role: 'student' });
    const otherSession = await req('GET', `/api/exam-prep/practice/${resumeId}`, null, resumeOther.body.token);
    check('Another student cannot read the session (404)', otherSession.status === 404, otherSession);

    const resumeSubmit = await req('POST', `/api/exam-prep/practice/${resumeId}/submit`, {}, studentToken);
    check('Session submits cleanly (200)', resumeSubmit.status === 200, resumeSubmit.body);

    const completed = await req('GET', `/api/exam-prep/practice/${resumeId}`, null, studentToken);
    check('Completed session is readable (200)', completed.status === 200, completed.body);
    check('Completed session reports status', completed.body.status === 'completed', completed.body.status);
    check('Completed session exposes the breakdown', Array.isArray(completed.body.breakdown) && completed.body.breakdown.every(b => b.correct_index !== undefined), completed.body.breakdown?.[0]);
    check('Completed session keeps the score', typeof completed.body.score_percent === 'number', completed.body);

    // ════════════════════════════════════════════════════════════
    // 14. Attempt history + faculty analytics detail
    // ════════════════════════════════════════════════════════════
    console.log('\n--- 14. Attempt History & Analytics Detail ---');

    const history = await req('GET', '/api/exam-prep/my-attempts', null, studentToken);
    check('Student reads attempt history (200)', history.status === 200 && Array.isArray(history.body), history.body);
    check('History is non-empty after earlier submissions', history.body.length >= 1, history.body.length);
    const h0 = history.body[0];
    check('History entry carries the summary shape',
      Boolean(h0) && typeof h0.id === 'string' && typeof h0.quiz_title === 'string' &&
      typeof h0.submitted_at === 'string' && typeof h0.is_practice === 'boolean' &&
      typeof h0.expired === 'boolean', h0);
    check('History is sorted newest-first',
      history.body.length < 2 || new Date(history.body[0].submitted_at) >= new Date(history.body[1].submitted_at),
      history.body.map(a => a.submitted_at));
    check('History returns only settled attempts (all scored)',
      history.body.every(a => a.score_percent === null || typeof a.score_percent === 'number'), history.body);
    // Another student's attempts must not appear in this list.
    const otherHistory = await req('GET', '/api/exam-prep/my-attempts', null, resumeOther.body.token);
    const overlap = (otherHistory.body || []).filter(a => history.body.some(m => m.id === a.id));
    check('Attempt history is scoped to the owner', otherHistory.status === 200 && overlap.length === 0, overlap);

    const analytics2 = await req('GET', `/api/exam-prep/quizzes/${quizId}/analytics`, null, facultyToken);
    check('Analytics returns the detailed attempts list', Array.isArray(analytics2.body.attempts), analytics2.body.attempts);
    const a0 = analytics2.body.attempts?.[0];
    check('Attempt detail carries score, correctness and timing',
      Boolean(a0) && typeof a0.attempt_id === 'string' && typeof a0.score === 'number' &&
      typeof a0.correct === 'number' && typeof a0.total === 'number' &&
      typeof a0.time_taken_seconds === 'number', a0);
    check('Attempt list is ranked by score',
      analytics2.body.attempts.length < 2 ||
      analytics2.body.attempts.every((a, i, arr) => i === 0 || arr[i - 1].score >= a.score),
      analytics2.body.attempts?.map(a => a.score));
    check('Stats and attempts agree on count',
      analytics2.body.attempts.length === analytics2.body.stats.total_attempts ||
      analytics2.body.attempts.length === Math.min(100, analytics2.body.stats.total_attempts),
      { listed: analytics2.body.attempts.length, stats: analytics2.body.stats.total_attempts });

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    await new Promise(r => server.close(r));
    await closeDB();
    console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runExamPrepTests();
