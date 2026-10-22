/**
 * Google Sheets sync — mirrors ERP data into a Google Spreadsheet in real time.
 *
 * Flow:
 *   1. Business routes (attendance check-in, fee payment, …) call
 *      queueSheetSync(). This only writes a small document to the
 *      `google_sheet_sync_queue` collection, so the request stays fast.
 *   2. A background worker (every GOOGLE_SHEET_SYNC_INTERVAL_MS, default 10s,
 *      plus a debounced kick right after queueing) drains the queue and
 *      appends the rows to the college's spreadsheet via the Sheets API.
 *
 * Configuration is per college, stored in `google_workspace_configs`:
 *   { collegeId, spreadsheetId, spreadsheetUrl, enabled, types: {...} }
 *
 * Requires a Google service account with access to Sheets + Drive.
 */

const { getDB, oid } = require('../db');
const { getGoogleApiAccessToken, isServiceAccountConfigured, SERVICE_ACCOUNT_EMAIL } = require('./googleAuth');

const SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];
const SHEETS_API = 'https://www.googleapis.com/v4/spreadsheets';
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

const FLUSH_INTERVAL_MS = Math.max(2000, parseInt(process.env.GOOGLE_SHEET_SYNC_INTERVAL_MS || '10000', 10));
const FLUSH_BATCH = 100;
const MAX_ATTEMPTS = 5;
const CONFIGS_COLLECTION = 'google_workspace_configs';
const QUEUE_COLLECTION = 'google_sheet_sync_queue';

/** Synced payload types → target tab, headers and row mapping. */
const SYNC_TYPES = {
  attendance: {
    tab: 'Attendance',
    headers: ['Timestamp', 'Student', 'Roll No', 'Course', 'Class', 'Status', 'Method', 'Date'],
    toRow: r => [
      r.timestamp || '', r.studentName || '', r.studentCode || '', r.courseName || '',
      r.sessionTitle || '', r.status || '', r.method || '', r.date || '',
    ],
  },
  fee_payment: {
    tab: 'Fee Payments',
    headers: ['Timestamp', 'Student', 'Roll No', 'Receipt No', 'Amount', 'Mode', 'Status', 'Term'],
    toRow: r => [
      r.timestamp || '', r.studentName || '', r.studentCode || '', r.receiptNo || '',
      r.amount ?? '', r.mode || '', r.status || '', r.term || '',
    ],
  },
  placement: {
    tab: 'Placements',
    headers: ['Timestamp', 'Event', 'Student', 'Company', 'Role', 'Status'],
    toRow: r => [
      r.timestamp || '', r.event || '', r.studentName || '', r.company || '',
      r.role || '', r.status || '',
    ],
  },
};

// ─── Config cache (avoids a DB hit on every attendance check-in) ──
const configCache = new Map(); // collegeIdString -> { config|null, fetchedAt }
const CONFIG_TTL_MS = 30000;

function invalidateConfig(collegeId) {
  if (collegeId) configCache.delete(String(collegeId));
  else configCache.clear();
}

async function getConfig(collegeId, { fresh = false } = {}) {
  const key = String(collegeId);
  const cached = configCache.get(key);
  if (!fresh && cached && Date.now() - cached.fetchedAt < CONFIG_TTL_MS) return cached.config;

  let config = null;
  try {
    const db = getDB();
    const cid = oid(collegeId);
    config = await db.collection(CONFIGS_COLLECTION).findOne({
      $or: [{ collegeId: cid }, { collegeId: String(collegeId) }, { collegeId: collegeId }],
    });
  } catch {
    config = null;
  }
  configCache.set(key, { config, fetchedAt: Date.now() });
  return config;
}

// ─── Google API helpers ──────────────────────────────────────────
async function sheetsFetch(path, { method = 'GET', body, token } = {}) {
  const accessToken = token || (await getGoogleApiAccessToken(SHEETS_SCOPES));
  const res = await fetch(`${SHEETS_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error?.message || `Google Sheets API error ${res.status}.`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const tabMetaCache = new Map(); // spreadsheetId -> { titles: Set<string>, fetchedAt }

async function knownTabs(spreadsheetId, { fresh = false } = {}) {
  const cached = tabMetaCache.get(spreadsheetId);
  if (!fresh && cached && Date.now() - cached.fetchedAt < 60000) return cached.titles;
  const data = await sheetsFetch(`/${spreadsheetId}?fields=sheets(properties(title))`);
  const titles = new Set((data.sheets || []).map(s => s.properties?.title).filter(Boolean));
  tabMetaCache.set(spreadsheetId, { titles, fetchedAt: Date.now() });
  return titles;
}

async function ensureTab(spreadsheetId, typeKey) {
  const spec = SYNC_TYPES[typeKey];
  if (!spec) throw new Error(`Unknown sync type "${typeKey}".`);
  let titles = await knownTabs(spreadsheetId);
  if (!titles.has(spec.tab)) {
    await sheetsFetch(`/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: { requests: [{ addSheet: { properties: { title: spec.tab } } }] },
    });
    titles = await knownTabs(spreadsheetId, { fresh: true });
  }
  return spec;
}

async function writeHeaders(spreadsheetId, spec) {
  await sheetsFetch(`/${spreadsheetId}/values/${encodeURIComponent(spec.tab)}!A1?valueInputOption=RAW`, {
    method: 'PUT',
    body: { values: [spec.headers] },
  });
}

async function appendRows(spreadsheetId, spec, rows) {
  if (!rows.length) return 0;
  const data = await sheetsFetch(
    `/${spreadsheetId}/values/${encodeURIComponent(spec.tab)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: { values: rows } },
  );
  return data.updates?.updatedRows || rows.length;
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Queue one row for real-time sync. Fire-and-forget: never throws, never
 * blocks the caller — call it as `queueSheetSync(...).catch(() => {})`.
 */
function queueSheetSync({ collegeId, type, row }) {
  return (async () => {
    if (!collegeId || !SYNC_TYPES[type] || !isServiceAccountConfigured()) return false;
    const config = await getConfig(collegeId);
    if (!config || config.enabled === false || config.types?.[type] === false) return false;
    if (!config.spreadsheetId) return false;

    const db = getDB();
    await db.collection(QUEUE_COLLECTION).insertOne({
      collegeId: oid(collegeId),
      type,
      row,
      status: 'pending',
      attempts: 0,
      lastError: null,
      createdAt: new Date().toISOString(),
    });
    scheduleFlush(1500); // near-real-time: flush shortly after the write
    return true;
  })();
}

let flushing = false;
let flushTimer = null;

function scheduleFlush(delayMs = 0) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushSheetSyncQueue().catch(() => {});
  }, delayMs);
  if (flushTimer.unref) flushTimer.unref();
}

/** Drain the queue and append rows to each college's spreadsheet. */
async function flushSheetSyncQueue() {
  if (flushing || !isServiceAccountConfigured()) return { processed: 0 };
  flushing = true;
  let processed = 0;
  try {
    const db = getDB();
    const pending = await db.collection(QUEUE_COLLECTION)
      .find({ status: 'pending', attempts: { $lt: MAX_ATTEMPTS } })
      .sort({ createdAt: 1 })
      .limit(FLUSH_BATCH)
      .toArray();
    if (!pending.length) return { processed: 0 };

    // Group by college + type so each tab gets one append call.
    const groups = new Map();
    for (const item of pending) {
      const key = `${String(item.collegeId)}::${item.type}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }

    for (const [, items] of groups) {
      const { collegeId, type } = items[0];
      const ids = items.map(i => i._id);
      try {
        const config = await getConfig(collegeId);
        if (!config?.spreadsheetId || config.enabled === false) {
          await db.collection(QUEUE_COLLECTION).updateMany(
            { _id: { $in: ids } },
            { $set: { status: 'skipped', lastError: 'Sync is not connected for this college.' } },
          );
          continue;
        }
        const spec = await ensureTab(config.spreadsheetId, type);
        const rows = items.map(i => spec.toRow(i.row || {}));
        await appendRows(config.spreadsheetId, spec, rows);
        await db.collection(QUEUE_COLLECTION).updateMany(
          { _id: { $in: ids } },
          { $set: { status: 'done', syncedAt: new Date().toISOString() } },
        );
        await db.collection(CONFIGS_COLLECTION).updateOne(
          { _id: config._id },
          { $set: { lastSyncAt: new Date().toISOString(), lastSyncResult: { ok: true, rows: rows.length } } },
        );
        invalidateConfig(collegeId);
        processed += rows.length;
      } catch (err) {
        await db.collection(QUEUE_COLLECTION).updateMany(
          { _id: { $in: ids } },
          {
            $inc: { attempts: 1 },
            $set: {
              lastError: String(err.message || err).slice(0, 300),
              // Items that keep failing move to "error" so they stop blocking the queue.
              ...(items.every(i => (i.attempts || 0) + 1 >= MAX_ATTEMPTS) ? { status: 'error' } : {}),
            },
          },
        );
      }
    }
  } catch {
    // DB unavailable (e.g. during startup) — the next interval will retry.
  } finally {
    flushing = false;
  }
  return { processed };
}

/**
 * Create (or reuse) the college's spreadsheet and switch sync on.
 *
 * The file is created inside the *service account's* Drive, so it must be
 * explicitly shared with the admin who connects it — otherwise opening the
 * link lands on Google's "You need access" page.
 *
 * @param {string} collegeId
 * @param {string} [collegeName]
 * @param {{ shareWith?: string|null }} [options] email to grant Writer access to
 */
async function connectSpreadsheet(collegeId, collegeName, { shareWith = null } = {}) {
  if (!isServiceAccountConfigured()) {
    const err = new Error('Google Sheets is not configured. Set the Google service account credentials first.');
    err.code = 'GOOGLE_NOT_CONFIGURED';
    throw err;
  }
  let config = await getConfig(collegeId, { fresh: true });
  if (config?.spreadsheetId) {
    if (config.enabled !== false) return config;
    await getDB().collection(CONFIGS_COLLECTION).updateOne({ _id: config._id }, { $set: { enabled: true, updatedAt: new Date().toISOString() } });
    invalidateConfig(collegeId);
    return getConfig(collegeId, { fresh: true });
  }

  const token = await getGoogleApiAccessToken(SHEETS_SCOPES);
  const createRes = await fetch(`${DRIVE_API}?fields=id,webViewLink`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `${collegeName || 'College'} — ERP Live Sync`,
      mimeType: 'application/vnd.google-apps.spreadsheet',
    }),
    signal: AbortSignal.timeout(20000),
  });
  const created = await createRes.json().catch(() => ({}));
  if (!createRes.ok || !created.id) {
    // Service accounts have no Drive storage of their own on personal Google
    // accounts, so creating a file fails with storageQuotaExceeded. Point the
    // caller at the supported path instead of surfacing a raw Google error.
    if (created.error?.errors?.some(e => e.reason === 'storageQuotaExceeded')) {
      const err = new Error(
        `This Google service account cannot own files. Create a spreadsheet in your own Google account, `
        + `share it with ${SERVICE_ACCOUNT_EMAIL} as "Editor", then connect it with its link instead.`,
      );
      err.code = 'GOOGLE_STORAGE_LIMIT';
      throw err;
    }
    throw new Error(created.error?.message || `Could not create the spreadsheet (${createRes.status}).`);
  }
  const spreadsheetId = created.id;

  // Share with the connecting admin (Writer). Non-fatal: if Google refuses we
  // still finish connecting — the sheet just has to be shared manually later.
  if (shareWith) {
    try {
      const shareRes = await fetch(
        `${DRIVE_API}/${spreadsheetId}/permissions?sendNotificationEmail=false`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'writer', type: 'user', emailAddress: String(shareWith).toLowerCase() }),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!shareRes.ok) {
        const shareErr = await shareRes.json().catch(() => ({}));
        console.warn('[google-sheets] could not share spreadsheet:', shareErr.error?.message || shareRes.status);
      }
    } catch (shareErr) {
      console.warn('[google-sheets] could not share spreadsheet:', shareErr.message);
    }
  }

  // Rename the default tab to the first sync type, add the remaining tabs,
  // then write header rows.
  const typeKeys = Object.keys(SYNC_TYPES);
  const requests = [
    { updateSheetProperties: { properties: { sheetId: 0, title: SYNC_TYPES[typeKeys[0]].tab }, fields: 'title' } },
    ...typeKeys.slice(1).map(k => ({ addSheet: { properties: { title: SYNC_TYPES[k].tab } } })),
  ];
  await sheetsFetch(`/${spreadsheetId}:batchUpdate`, { method: 'POST', body: { requests }, token });
  tabMetaCache.delete(spreadsheetId);
  for (const key of typeKeys) {
    await writeHeaders(spreadsheetId, SYNC_TYPES[key]).catch(() => {});
  }

  const spreadsheetUrl = created.webViewLink || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  const db = getDB();
  const now = new Date().toISOString();
  const doc = {
    collegeId: oid(collegeId),
    spreadsheetId,
    spreadsheetUrl,
    enabled: true,
    types: Object.fromEntries(typeKeys.map(k => [k, true])),
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection(CONFIGS_COLLECTION).insertOne(doc);
  config = { ...doc, _id: result.insertedId };
  invalidateConfig(collegeId);
  return config;
}

/** Accept a docs.google.com link or a raw spreadsheet id. */
function parseSpreadsheetId(input) {
  const value = String(input || '').trim();
  if (!value) return null;
  const fromUrl = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{10,})/);
  if (fromUrl) return fromUrl[1];
  return /^[a-zA-Z0-9-_]{10,}$/.test(value) ? value : null;
}

/**
 * Connect a spreadsheet the college already owns.
 *
 * Service accounts have no Drive storage on personal Google accounts, so the
 * sheet must live in a human's Drive and be shared with the service account
 * as Editor. We verify access, set up the sync tabs/headers, and store it.
 *
 * @param {string} collegeId
 * @param {string} [collegeName]
 * @param {string} spreadsheetUrlOrId  link pasted by the admin (or raw id)
 */
async function adoptSpreadsheet(collegeId, collegeName, spreadsheetUrlOrId) {
  if (!isServiceAccountConfigured()) {
    const err = new Error('Google Sheets is not configured. Set the Google service account credentials first.');
    err.code = 'GOOGLE_NOT_CONFIGURED';
    throw err;
  }
  const spreadsheetId = parseSpreadsheetId(spreadsheetUrlOrId);
  if (!spreadsheetId) {
    const err = new Error('That does not look like a Google Sheets link. Paste the full docs.google.com URL.');
    err.status = 400;
    throw err;
  }

  const token = await getGoogleApiAccessToken(SHEETS_SCOPES);

  // Prove the service account can actually open it (i.e. it was shared).
  let title = null;
  try {
    const meta = await sheetsFetch(`/${spreadsheetId}?fields=spreadsheetId,properties(title)`, { token });
    title = meta.properties?.title || null;
  } catch {
    const err = new Error(
      `Could not open that spreadsheet for the service account. `
      + `Share it with ${SERVICE_ACCOUNT_EMAIL} as "Editor" (File → Share), then try again.`,
    );
    err.status = 403;
    throw err;
  }

  // Set up the sync tabs, reusing whatever already exists.
  const typeKeys = Object.keys(SYNC_TYPES);
  const titles = await knownTabs(spreadsheetId, { fresh: true });
  const requests = [];
  if (!titles.has(SYNC_TYPES.attendance.tab)) {
    requests.push({ updateSheetProperties: { properties: { sheetId: 0, title: SYNC_TYPES.attendance.tab }, fields: 'title' } });
  }
  for (const key of typeKeys.slice(1)) {
    if (!titles.has(SYNC_TYPES[key].tab)) requests.push({ addSheet: { properties: { title: SYNC_TYPES[key].tab } } });
  }
  if (requests.length) {
    await sheetsFetch(`/${spreadsheetId}:batchUpdate`, { method: 'POST', body: { requests }, token });
    tabMetaCache.delete(spreadsheetId);
  }
  for (const key of typeKeys) {
    await writeHeaders(spreadsheetId, SYNC_TYPES[key]).catch(() => {});
  }

  const db = getDB();
  const now = new Date().toISOString();
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  await db.collection(CONFIGS_COLLECTION).updateOne(
    { $or: [{ collegeId: oid(collegeId) }, { collegeId: String(collegeId) }] },
    {
      $set: {
        collegeId: oid(collegeId),
        spreadsheetId,
        spreadsheetUrl,
        title,
        ownedBy: 'college',
        enabled: true,
        types: Object.fromEntries(typeKeys.map(k => [k, true])),
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
  invalidateConfig(collegeId);
  return getConfig(collegeId, { fresh: true });
}

async function setSyncEnabled(collegeId, enabled, types) {
  const config = await getConfig(collegeId, { fresh: true });
  if (!config) return null;
  const patch = { enabled: !!enabled, updatedAt: new Date().toISOString() };
  if (types && typeof types === 'object') patch.types = { ...(config.types || {}), ...types };
  await getDB().collection(CONFIGS_COLLECTION).updateOne({ _id: config._id }, { $set: patch });
  invalidateConfig(collegeId);
  return getConfig(collegeId, { fresh: true });
}

async function getSyncStatus(collegeId) {
  const config = await getConfig(collegeId, { fresh: true });
  let pending = 0;
  let failed = 0;
  try {
    const db = getDB();
    const cid = oid(collegeId);
    [pending, failed] = await Promise.all([
      db.collection(QUEUE_COLLECTION).countDocuments({ collegeId: { $in: [cid, String(collegeId), collegeId] }, status: 'pending' }),
      db.collection(QUEUE_COLLECTION).countDocuments({ collegeId: { $in: [cid, String(collegeId), collegeId] }, status: 'error' }),
    ]);
  } catch {
    pending = 0;
  }
  return {
    configured: isServiceAccountConfigured(),
    connected: Boolean(config?.spreadsheetId) && config?.enabled !== false,
    enabled: Boolean(config?.enabled),
    spreadsheetId: config?.spreadsheetId || null,
    spreadsheetUrl: config?.spreadsheetUrl || null,
    types: config?.types || null,
    lastSyncAt: config?.lastSyncAt || null,
    lastSyncResult: config?.lastSyncResult || null,
    pending,
    failed,
    syncedTypes: Object.keys(SYNC_TYPES),
  };
}

/** Start the periodic drain (idempotent, safe in tests — timer is unref'd). */
function startSheetSyncWorker() {
  if (!isServiceAccountConfigured()) return null;
  if (startSheetSyncWorker._timer) return startSheetSyncWorker._timer;
  const timer = setInterval(() => {
    flushSheetSyncQueue().catch(() => {});
  }, FLUSH_INTERVAL_MS);
  if (timer.unref) timer.unref();
  startSheetSyncWorker._timer = timer;
  return timer;
}

module.exports = {
  SYNC_TYPES,
  queueSheetSync,
  flushSheetSyncQueue,
  connectSpreadsheet,
  adoptSpreadsheet,
  parseSpreadsheetId,
  setSyncEnabled,
  getSyncStatus,
  startSheetSyncWorker,
  invalidateConfig,
};
