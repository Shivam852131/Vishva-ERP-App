require('dotenv').config();
const http = require('http');
const { connectDB } = require('./src/db');
const { createApp } = require('./src/app');
const { createSocketServer } = require('./src/socket');

async function testServer() {
  const db = await connectDB();
  const io = createSocketServer();
  const app = createApp(io);
  const server = http.createServer(app);
  io.attach(server);

  await new Promise(r => server.listen(8099, r));
  console.log('[SERVER] Running on :8099');

  function req(method, path, body, token) {
    return new Promise((resolve, reject) => {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;
      const r = http.request({ hostname: '127.0.0.1', port: 8099, path, method, headers }, res => {
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

  let passed = 0, failed = 0;
  function check(label, ok) {
    if (ok) { passed++; console.log(`  PASS ${label}`); }
    else { failed++; console.log(`  FAIL ${label}`); }
  }

  // Login as student
  console.log('\n=== AUTH ===');
  const loginRes = await req('POST', '/api/auth/login', { email: 'aarav@campus.edu', password: 'password123' });
  check('POST /auth/login (200)', loginRes.status === 200 && loginRes.body.token);
  const token = loginRes.body.token;

  const adminLogin = await req('POST', '/api/auth/login', { email: 'ananya@campus.edu', password: 'password123' });
  check('Admin login', adminLogin.status === 200 && adminLogin.body.token);
  const adminToken = adminLogin.body.token;

  const me = await req('GET', '/api/auth/me', null, token);
  check('GET /auth/me (200)', me.status === 200 && me.body.name === 'Aarav Sharma');

  const badLogin = await req('POST', '/api/auth/login', { email: 'x@x.com', password: 'wrong' });
  check('POST /auth/login bad creds (401)', badLogin.status === 401);

  // Health
  console.log('\n=== HEALTH ===');
  const health = await req('GET', '/health');
  check('GET /health (200)', health.status === 200 && health.body.ok);

  // Dashboard
  console.log('\n=== DASHBOARD ===');
  const dash = await req('GET', '/api/dashboard/student', null, token);
  check('GET /dashboard/student (200)', dash.status === 200 && dash.body.attendance);

  const fDash = await req('GET', '/api/dashboard/faculty', null, (await req('POST', '/api/auth/login', { email: 'meera@campus.edu', password: 'password123' })).body.token);
  check('GET /dashboard/faculty (200)', fDash.status === 200 && fDash.body.courses);

  const pDash = await req('GET', '/api/dashboard/parent', null, (await req('POST', '/api/auth/login', { email: 'rohit@campus.edu', password: 'password123' })).body.token);
  check('GET /dashboard/parent (200)', pDash.status === 200);

  const aDash = await req('GET', '/api/dashboard/admin', null, adminToken);
  check('GET /dashboard/admin (200)', aDash.status === 200 && aDash.body.students >= 0);

  // Courses
  console.log('\n=== COURSES ===');
  const courses = await req('GET', '/api/courses', null, token);
  check('GET /courses (200)', courses.status === 200 && Array.isArray(courses.body) && courses.body.length >= 2);

  // Fees
  console.log('\n=== FEES ===');
  const fees = await req('GET', '/api/fees/me', null, token);
  check('GET /fees/me (200)', fees.status === 200 && Array.isArray(fees.body) && fees.body.length >= 1);

  // Notifications
  console.log('\n=== NOTIFICATIONS ===');
  const notifs = await req('GET', '/api/notifications', null, token);
  check('GET /notifications (200)', notifs.status === 200 && Array.isArray(notifs.body) && notifs.body.length >= 1);

  // Library
  console.log('\n=== LIBRARY ===');
  const books = await req('GET', '/api/library/books', null, token);
  check('GET /library/books (200)', books.status === 200 && Array.isArray(books.body) && books.body.length >= 2);

  const myIssues = await req('GET', '/api/library/my-issues', null, token);
  check('GET /library/my-issues (200)', myIssues.status === 200 && Array.isArray(myIssues.body));

  // Attendance
  console.log('\n=== ATTENDANCE ===');
  const att = await req('GET', '/api/attendance/me', null, token);
  check('GET /attendance/me (200)', att.status === 200 && Array.isArray(att.body) && att.body.length >= 1);

  // Assignments
  console.log('\n=== ASSIGNMENTS ===');
  const assigns = await req('GET', '/api/assignments', null, token);
  check('GET /assignments (200)', assigns.status === 200 && Array.isArray(assigns.body) && assigns.body.length >= 1);

  // Admin Users
  console.log('\n=== ADMIN ===');
  const users = await req('GET', '/api/admin/users', null, adminToken);
  check('GET /admin/users (200)', users.status === 200 && Array.isArray(users.body) && users.body.length >= 8);

  // Colleges
  const colleges = await req('GET', '/api/colleges', null, token);
  check('GET /colleges (200)', colleges.status === 200 && Array.isArray(colleges.body) && colleges.body.length >= 1);

  // Chat
  console.log('\n=== CHAT ===');
  const chatUsers = await req('GET', '/api/chat/users', null, token);
  check('GET /chat/users (200)', chatUsers.status === 200 && Array.isArray(chatUsers.body) && chatUsers.body.length >= 1);

  // AI
  console.log('\n=== AI ===');
  const aiSessions = await req('GET', '/api/ai/sessions', null, token);
  check('GET /ai/sessions (200)', aiSessions.status === 200 && Array.isArray(aiSessions.body));

  const aiChat = await req('POST', '/api/ai/chat', { message: 'What is a binary tree?' }, token);
  check('POST /ai/chat (201)', aiChat.status === 201 && aiChat.body.message?.content);

  // Hostels
  console.log('\n=== CAMPUS ===');
  const hostels = await req('GET', '/api/hostels', null, token);
  check('GET /hostels (200)', hostels.status === 200 && Array.isArray(hostels.body) && hostels.body.length >= 2);

  const transport = await req('GET', '/api/transport/routes', null, token);
  check('GET /transport/routes (200)', transport.status === 200 && Array.isArray(transport.body) && transport.body.length >= 2);

  const griev = await req('GET', '/api/grievances', null, token);
  check('GET /grievances (200)', griev.status === 200 && Array.isArray(griev.body));

  // Twilio (send-otp will fail to actually send but should return ok)
  console.log('\n=== TWILIO ===');
  const otp = await req('POST', '/api/auth/send-otp', { phone: '9876543210' });
  check('POST /auth/send-otp (200)', otp.status === 200 && otp.body.ok);

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

testServer().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
