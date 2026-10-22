// Regression tests for the AI chat pipeline. What these guard against:
//
//   1. Gemini 3.x spends `maxOutputTokens` on internal "thinking" (490 of a
//      512 budget was measured), so the visible answer was truncated after
//      ~18 tokens with finishReason MAX_TOKENS — replies looked unfinished and
//      unrelated to the question.
//   2. Free-tier 429/503 responses fell straight through to the canned mock,
//      which answered a generic template instead of the question asked.
//   3. Persona keys sent by the app ('doubt', 'study') never matched a system
//      prompt, so every chat silently used the generic one.
//   4. History was read *after* the current question was stored, so the model
//      was given the same question twice and could answer the wrong turn.
//
// `fetch` is stubbed throughout, so these never touch the network.

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-gemini-key';

const request = require('supertest');
const { buildTestApp } = require('./helpers/testApp');
const { resetDb, getDB } = require('./helpers/db');
const { createUser, tokenFor } = require('./helpers/factories');
const llm = require('../src/ml/llmService');

const app = buildTestApp();
const realFetch = global.fetch;

function geminiOk(text, finishReason = 'STOP') {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason, index: 0 }],
    }),
  };
}

function geminiError(status, message = 'upstream error') {
  return { ok: false, status, json: async () => ({ error: { message } }) };
}

function sentBody(mock, callIndex = 0) {
  return JSON.parse(mock.mock.calls[callIndex][1].body);
}

function turnsIn(mock, callIndex = 0) {
  return sentBody(mock, callIndex).contents.map((c) => c.parts[0].text);
}

let fetchMock;

beforeEach(async () => {
  await resetDb();
  const db = getDB();
  await db.collection('ai_sessions').deleteMany({}).catch(() => {});
  await db.collection('ai_messages').deleteMany({}).catch(() => {});
  fetchMock = jest.fn();
  global.fetch = fetchMock;
});

afterEach(() => {
  global.fetch = realFetch;
});

afterAll(() => {
  global.fetch = realFetch;
});

describe('AI chat (/api/ai/chat)', () => {
  it('gives Gemini room to think, applies the persona prompt, and asks once', async () => {
    fetchMock.mockResolvedValue(geminiOk('Polymorphism means "many forms": one interface, many implementations.'));
    const student = await createUser({ role: 'student' });

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${tokenFor(student)}`)
      .send({ message: 'What is polymorphism?', type: 'doubt' });

    expect(res.status).toBe(201);
    expect(res.body.source).toBe('ai');
    expect(res.body.response).toContain('Polymorphism');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = sentBody(fetchMock);

    // Enough budget for thinking + answer (was 512, which truncated replies).
    expect(sent.generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(2048);

    // type 'doubt' must resolve to the tutor prompt, not the generic one.
    expect(sent.systemInstruction.parts[0].text).toContain('expert academic tutor');

    // The question is the latest turn and appears exactly once.
    const turns = turnsIn(fetchMock);
    expect(turns[turns.length - 1]).toBe('What is polymorphism?');
    expect(turns.filter((t) => t === 'What is polymorphism?')).toHaveLength(1);
  });

  it('resolves the other persona keys to their own system prompts', async () => {
    fetchMock.mockResolvedValue(geminiOk('Here is a plan.'));
    const student = await createUser({ role: 'student' });

    await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${tokenFor(student)}`)
      .send({ message: 'Help me study for finals', type: 'study' });

    expect(sentBody(fetchMock).systemInstruction.parts[0].text).toContain('study coach');
  });

  it('carries prior turns forward without repeating the new question', async () => {
    fetchMock.mockResolvedValue(geminiOk('First answer.'));
    const student = await createUser({ role: 'student' });
    const auth = `Bearer ${tokenFor(student)}`;

    const first = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', auth)
      .send({ message: 'What is polymorphism?', type: 'general' });
    expect(first.status).toBe(201);
    const sessionId = first.body.sessionId;

    fetchMock.mockResolvedValue(geminiOk('Second answer.'));
    const second = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', auth)
      .send({ sessionId, message: 'And what about inheritance?', type: 'general' });
    expect(second.status).toBe(201);

    const turns = turnsIn(fetchMock, 1);
    expect(turns).toContain('What is polymorphism?');
    expect(turns).toContain('First answer.');
    expect(turns[turns.length - 1]).toBe('And what about inheritance?');
    expect(turns.filter((t) => t === 'And what about inheritance?')).toHaveLength(1);
  });

  it('retries transient upstream failures instead of serving the canned mock', async () => {
    fetchMock
      .mockResolvedValueOnce(geminiError(503, 'The model is overloaded'))
      .mockResolvedValueOnce(geminiOk('A real answer about stacks and queues.'));
    const student = await createUser({ role: 'student' });

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${tokenFor(student)}`)
      .send({ message: 'Explain stacks and queues', type: 'general' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.body.source).toBe('ai');
    expect(res.body.response).toBe('A real answer about stacks and queues.');
  });

  it('retries with a larger budget when thinking eats the whole allowance', async () => {
    fetchMock
      .mockResolvedValueOnce(geminiOk('Poly', 'MAX_TOKENS'))
      .mockResolvedValueOnce(geminiOk('A complete, well-formed answer.', 'STOP'));
    const student = await createUser({ role: 'student' });

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${tokenFor(student)}`)
      .send({ message: 'Explain polymorphism', type: 'general' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(fetchMock, 1).generationConfig.maxOutputTokens)
      .toBeGreaterThan(sentBody(fetchMock, 0).generationConfig.maxOutputTokens);
    expect(res.body.response).toBe('A complete, well-formed answer.');
  });

  it('moves to the next model when one answers 200 with no visible text', async () => {
    const blank = {
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { role: 'model', parts: [] }, finishReason: 'STOP', index: 0 }] }),
    };
    fetchMock.mockResolvedValueOnce(blank).mockResolvedValueOnce(geminiOk('A real answer.'));
    const student = await createUser({ role: 'student' });

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${tokenFor(student)}`)
      .send({ message: 'Explain polymorphism', type: 'general' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.body.response).toBe('A real answer.');
  });

  it('rejects an empty message instead of crashing on .substring', async () => {
    const student = await createUser({ role: 'student' });
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${tokenFor(student)}`)
      .send({ type: 'general' });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('mock fallback', () => {
  it('returns only an honest notice — never a canned answer', () => {
    const reply = llm.generateMockResponse('study_coach', 'What is python?');
    expect(reply.startsWith('\u26A0')).toBe(true);
    // The old fallback appended a generic study-tips template under the notice,
    // which reads as "the AI answered a completely different question".
    expect(reply).not.toContain('Memory Palace');
    expect(reply).not.toContain('Active Recall');
    expect(reply).not.toContain('---');
    expect(reply.length).toBeLessThan(300);

    expect(llm.generateMockResponse('general', 'What is recursion?').startsWith('\u26A0')).toBe(true);
    expect(llm.generateMockResponse('doubt_solver', 'Solve x+2=5').startsWith('\u26A0')).toBe(true);
  });

  it('keeps question_generator output as parseable JSON lines', () => {
    const jsonl = llm.generateMockResponse('question_generator', 'make questions');
    const first = jsonl.split('\n').find((line) => line.trim());
    expect(() => JSON.parse(first)).not.toThrow();
  });

  it('returns nothing for question_extractor so no bogus questions are invented', () => {
    expect(llm.generateMockResponse('question_extractor', 'scan this')).toBe('');
  });
});
