/**
 * importQuestions.js — file-format parsing for the exam-prep question bank.
 *
 * Turns an uploaded .xlsx / .csv / .pdf into plain MCQ objects that
 * buildQuestionDoc() can validate. Nothing here touches the database.
 *
 * Two input shapes are supported:
 *
 *   1. Tabular (xlsx, csv) — one question per row, columns matched by
 *      header name (case/space/underscore insensitive) or by position.
 *
 *        question | option_a..option_d | answer | subject | topic |
 *        difficulty | explanation | education_level | subtopic | tags
 *
 *      `answer` may be the 0-based index (0-3) or the literal option text.
 *
 *   2. PDF — the text is extracted and handed to the LLM extraction
 *      pipeline, because free-form question paper layout has no reliable
 *      tabular structure.
 */

const { PDFParse } = require('pdf-parse');

// Hard ceilings — an uploaded file is untrusted input and must not be able
// to exhaust memory or produce an unbounded import.
const MAX_ROWS = 500;
const MAX_PDF_BYTES = 8 * 1024 * 1024;
const MAX_CELL_CHARS = 4000;

/**
 * RFC4180-ish CSV parser: handles quoted fields, escaped quotes (""), and
 * embedded newlines. Returns an array of rows, each an array of cells.
 */
function parseCsvTable(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const src = String(text || '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else { inQuotes = false; }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(cell); cell = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += ch;
  }

  // Flush the final row, but ignore a trailing empty line.
  if (cell.length || row.length) { row.push(cell); rows.push(row); }

  return rows.filter(r => r.some(c => String(c).trim().length));
}

// Header aliases → canonical field name.
const HEADER_ALIASES = {
  question: ['question', 'q', 'question_text', 'problem', 'prompt'],
  option_a: ['option_a', 'optiona', 'option1', 'a', 'choice_a', 'opt_a'],
  option_b: ['option_b', 'optionb', 'option2', 'b', 'choice_b', 'opt_b'],
  option_c: ['option_c', 'optionc', 'option3', 'c', 'choice_c', 'opt_c'],
  option_d: ['option_d', 'optiond', 'option4', 'd', 'choice_d', 'opt_d'],
  answer: ['answer', 'correct', 'correct_answer', 'answer_key', 'solution'],
  subject: ['subject', 'chapter_subject'],
  topic: ['topic', 'unit', 'chapter'],
  subtopic: ['subtopic', 'sub_topic', 'section'],
  difficulty: ['difficulty', 'level', 'complexity'],
  explanation: ['explanation', 'rationale', 'solution_text', 'why'],
  education_level: ['education_level', 'educationlevel', 'level_group', 'grade_level'],
  tags: ['tags', 'labels', 'keywords'],
};

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s\-]+/g, '_');
}

/**
 * Map a header row to canonical field indices.
 * Falls back to positional order when no recognised header is present:
 *   question, option_a..option_d, answer
 */
function mapColumns(headerRow) {
  const normalized = (headerRow || []).map(normalizeHeader);
  const map = {};

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = normalized.findIndex(h => aliases.includes(h));
    if (idx >= 0) map[field] = idx;
  }

  const hasHeader = 'question' in map && Object.keys(map).length >= 2;
  if (hasHeader) return { map, hasHeader: true };

  return {
    map: { question: 0, option_a: 1, option_b: 2, option_c: 3, option_d: 4, answer: 5 },
    hasHeader: false,
  };
}

function cellAt(row, idx) {
  if (idx === undefined || idx === null) return '';
  const v = row[idx];
  return v === undefined || v === null ? '' : String(v).trim();
}

/** Split a `tags` cell on ; | or , into an array. */
function splitTags(value) {
  return String(value || '')
    .split(/[;|,]/)
    .map(t => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

/** Turn a difficulty cell into a supported value. */
function normalizeDifficulty(value) {
  const v = String(value || '').trim().toLowerCase();
  if (['easy', 'basic', 'simple', '1', 'low'].includes(v)) return 'easy';
  if (['hard', 'difficult', 'tough', '3', 'high'].includes(v)) return 'hard';
  return 'medium';
}

/**
 * Convert one tabular row into a question object.
 *
 * `answer` accepts either a 0-based index or the exact text of the correct
 * option — spreadsheets usually store the letter or the option text.
 */
function rowToQuestion(row, map) {
  const question = cellAt(row, map.question);
  const options = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'option_f']
    .map(f => cellAt(row, map[f]))
    .filter(Boolean);

  const answerRaw = cellAt(row, map.answer);
  let answer;

  if (/^\d+$/.test(answerRaw)) {
    answer = Number(answerRaw);
    // Treat 1-based letters/numbers when the index is out of range but
    // shifting by one lands on a valid option (A/B/C/D style sheets).
    if (answer >= options.length && answer - 1 >= 0 && answer - 1 < options.length) {
      answer -= 1;
    }
  } else if (/^[A-Fa-f]$/.test(answerRaw)) {
    answer = answerRaw.toUpperCase().charCodeAt(0) - 65;
  } else if (answerRaw) {
    answer = options.findIndex(o => o.toLowerCase() === answerRaw.toLowerCase());
  }

  return {
    question,
    options,
    answer,
    subject: cellAt(row, map.subject),
    topic: cellAt(row, map.topic),
    subtopic: cellAt(row, map.subtopic),
    difficulty: normalizeDifficulty(cellAt(row, map.difficulty)),
    explanation: cellAt(row, map.explanation),
    education_level: cellAt(row, map.education_level),
    tags: splitTags(cellAt(row, map.tags)),
  };
}

/**
 * Parse a CSV buffer/string into question objects.
 * @returns {{ questions: object[], errors: {row:number, reason:string}[], sheet?: string }}
 */
function parseCsvQuestions(text) {
  const table = parseCsvTable(text);
  if (!table.length) return { questions: [], errors: [{ row: 0, reason: 'file is empty' }] };

  const { map, hasHeader } = mapColumns(table[0]);
  const start = hasHeader ? 1 : 0;

  const questions = [];
  const errors = [];
  for (let i = start; i < table.length && i < MAX_ROWS + start; i++) {
    const q = rowToQuestion(table[i], map);
    if (!q.question) {
      errors.push({ row: i + 1, reason: 'no question text' });
      continue;
    }
    questions.push(q);
  }
  return { questions, errors };
}

/**
 * Parse an .xlsx workbook into question objects. The first non-empty sheet
 * is used; every sheet is reported so the caller can warn about extras.
 */
async function parseXlsxQuestions(buffer) {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  // `buffer` input avoids the zip-bomb amplification of stream readers.
  await workbook.xlsx.load(buffer);

  const populated = workbook.worksheets.filter(ws => {
    let seen = false;
    ws.eachRow(row => { if (!seen && row.values.some(v => String(v ?? '').trim())) seen = true; });
    return seen;
  });

  if (!populated.length) {
    return { questions: [], errors: [{ row: 0, reason: 'workbook has no populated sheets' }], sheets: [] };
  }

  const sheet = populated[0];
  const rows = [];
  sheet.eachRow({ includeEmpty: false }, row => {
    const values = row.values || [];
    // exceljs leaves index 0 empty (1-based addressing); drop it.
    rows.push(values.slice(1).map(v => (v && typeof v === 'object' ? String(v.richText?.map(t => t.text).join('') ?? v.text ?? v.result ?? '') : String(v ?? ''))));
  });

  if (!rows.length) return { questions: [], errors: [{ row: 0, reason: 'sheet is empty' }], sheets: populated.map(w => w.name) };

  const { map, hasHeader } = mapColumns(rows[0]);
  const start = hasHeader ? 1 : 0;

  const questions = [];
  const errors = [];
  for (let i = start; i < rows.length && i < MAX_ROWS + start; i++) {
    const q = rowToQuestion(rows[i], map);
    if (!q.question) {
      errors.push({ row: i + 1, reason: 'no question text' });
      continue;
    }
    questions.push(q);
  }

  return {
    questions,
    errors,
    sheets: populated.map(w => w.name),
    unused_sheets: populated.slice(1).map(w => w.name),
  };
}

/**
 * Extract plain text from a PDF so it can be fed to the LLM pipeline.
 * Returns { ok, text } or { ok:false, error }.
 */
async function extractPdfText(buffer) {
  if (buffer.length > MAX_PDF_BYTES) {
    return { ok: false, error: `PDF is too large (max ${Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB).` };
  }

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = String(result?.text || '').trim().slice(0, 200_000);
    if (!text) {
      return { ok: false, error: 'No extractable text found. This PDF may be a scan — use image extraction instead.' };
    }
    return { ok: true, text, pages: result?.pages?.length ?? 0 };
  } catch (err) {
    return { ok: false, error: `Could not read PDF: ${err.message}` };
  } finally {
    // pdf-parse keeps a document reference that holds the buffer alive.
    if (typeof parser.destroy === 'function') {
      try { parser.destroy(); } catch { /* ignore */ }
    }
  }
}

/**
 * Truncate cells defensively so a hostile file cannot store megabytes in a
 * single question document.
 */
function clampQuestionCells(questions) {
  return questions.map(q => ({
    ...q,
    question: String(q.question || '').slice(0, MAX_CELL_CHARS),
    explanation: String(q.explanation || '').slice(0, MAX_CELL_CHARS),
    options: (q.options || []).map(o => String(o).slice(0, MAX_CELL_CHARS)),
  }));
}

module.exports = {
  MAX_ROWS,
  parseCsvTable,
  parseCsvQuestions,
  parseXlsxQuestions,
  extractPdfText,
  clampQuestionCells,
};
