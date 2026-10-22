/**
 * Google integration self-test — `node test-google.js`
 *
 * Verifies the three Google features without touching any real data:
 *   1. Service-account credentials can mint API access tokens
 *   2. Live-class links: Google Meet is refused for service accounts on
 *      personal Google accounts, so we assert the free Jitsi fallback is used
 *   3. Sheets: the service account cannot own files (no Drive storage), so we
 *      assert `adoptSpreadsheet` reports the "share it with the service
 *      account" instructions instead of a raw Google error
 *
 * Requires GOOGLE_SERVICE_ACCOUNT_* in .env. Everything it touches is either
 * deleted again or is a deliberate failure probe.
 */
require('dotenv').config();
const { getGoogleApiAccessToken, isServiceAccountConfigured } = require('./src/services/googleAuth');
const { createMeetEvent } = require('./src/services/googleMeet');
const { adoptSpreadsheet, parseSpreadsheetId } = require('./src/services/googleSheets');

let failures = 0;
const ok = msg => console.log('  OK   ' + msg);
const fail = msg => { failures++; console.log('  FAIL ' + msg); };

(async () => {
  console.log('\n[1/3] Service account credentials');
  if (!isServiceAccountConfigured()) throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL / _KEY are not set in .env');
  const token = await getGoogleApiAccessToken(['https://www.googleapis.com/auth/calendar.events']);
  token.startsWith('ya29.') ? ok('access token minted (' + token.slice(0, 10) + '…)') : fail('unexpected token: ' + token.slice(0, 20));

  console.log('\n[2/3] Live-class link (Jitsi fallback)');
  const roomSeed = 'selftest-' + Date.now();
  const meet = await createMeetEvent({
    summary: 'Vishva ERP self-test',
    startIso: new Date(Date.now() + 3600000).toISOString(),
    durationMinutes: 30,
    roomSeed,
  });
  meet.meetUrl?.startsWith('https://meet.jit.si/vishva-erp-') ? ok('link: ' + meet.meetUrl) : fail('unexpected url: ' + meet.meetUrl);
  meet.source === 'jitsi' ? ok("source: jitsi (Google Meet refused, as expected on a personal account)") : ok('source: google (Meet is available on this account!)');
  const stable = await createMeetEvent({ summary: 'again', startIso: new Date().toISOString(), roomSeed });
  stable.meetUrl === meet.meetUrl ? ok('room is stable for the same session') : fail('room changed between calls');

  console.log('\n[3/3] Sheets — connect a college-owned spreadsheet');
  const id = parseSpreadsheetId('https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit#gid=0');
  id === '1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890' ? ok('spreadsheet id parsed from URL') : fail('parse failed: ' + id);
  try {
    await adoptSpreadsheet('selftest', 'Self Test', 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890');
    fail('adopting an unshared sheet should have thrown');
  } catch (err) {
    err.status === 403 && /Share it with .* as "Editor"/.test(err.message)
      ? ok('friendly share-instructions error: ' + err.message)
      : fail('unexpected error: ' + err.message);
  }

  console.log(failures ? `\n${failures} check(s) FAILED\n` : '\nAll checks passed\n');
  process.exit(failures ? 1 : 0);
})().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
