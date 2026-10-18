/**
 * LLM Service — AI-powered responses with multiple providers
 * 
 * Provider priority:
 *   1. Ollama (free, local — no API key needed)
 *   2. Groq (free tier — Llama/Mixtral models, fast)
 *   3. Google Gemini (free tier — 1500 req/day)
 *   4. OpenAI (paid — GPT-3.5/GPT-4)
 *   5. Mock fallback (always works, no external calls)
 * 
 * Configure in .env:
 *   OLLAMA_BASE_URL=http://localhost:11434
 *   OLLAMA_MODEL=llama3.2
 *   GROQ_API_KEY=gsk_...
 *   GEMINI_API_KEY=AIza...
 *   OPENAI_API_KEY=sk-...
 */

// ─── Provider config ───────────────────────────────────────────
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || '';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const OLLAMA_TIMEOUT = parseInt(process.env.OLLAMA_TIMEOUT || '60000', 10);

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_BASE_URL = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
// Google has retired the 1.5/2.0 families — default to a current free-tier model.
// Alternatives: 'gemini-3.5-flash-lite' (highest free quota), 'gemini-3.6-flash'.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

// ─── System prompts ────────────────────────────────────────────
const SYSTEM_PROMPTS = {
  general: `You are Vishva AI, an intelligent educational assistant for college students in India. 
You help with academic doubts, career guidance, study strategies, and skill development.
Be concise, practical, and encouraging. Use simple language. Reference Indian education context when relevant.
Keep responses under 250 words unless asked for detail.`,
  
  doubt_solver: `You are an expert academic tutor. When a student asks a doubt:
1. Identify the core concept clearly
2. Explain it step-by-step with a real-world example
3. Provide a simple analogy if helpful
4. Suggest 1-2 related topics to review
Keep explanations clear, accurate, and under 200 words.`,
  
  academic_advisor: `You are an academic advisor for engineering/CS students in India. When giving advice:
1. Analyze the student's situation
2. Provide specific, actionable recommendations
3. Prioritize high-impact strategies
4. Consider Indian college context (semesters, internals, placements, CGPA)
Be direct and practical.`,
  
  study_coach: `You are a study coach helping students optimize their learning. When giving tips:
1. Base advice on evidence-based learning techniques (spaced repetition, active recall, interleaving)
2. Provide specific, implementable strategies
3. Consider time constraints of college students
4. Focus on retention and understanding, not just cramming
Keep it actionable and motivating.`,
  
  code_helper: `You are a coding instructor helping students learn programming. When helping with code:
1. Explain the approach before writing code
2. Write clean, commented code with proper variable names
3. Mention time/space complexity when relevant
4. Suggest edge cases to consider
Use JavaScript, Python, or C++ as appropriate. Format code in markdown.`,
  
  assignment_checker: `You are an assignment evaluator. When checking assignments:
1. Evaluate accuracy of content
2. Check completeness of answers
3. Note any conceptual errors
4. Provide a score out of 100 with specific feedback
Be constructive but honest.`,
  
  interview_practice: `You are an interview coach for tech placements. When generating questions:
1. Start with fundamental concepts
2. Progress to moderate difficulty
3. Include both technical and behavioral questions
4. Provide model answers when asked
Focus on topics commonly asked in Indian campus placements.`,

  question_generator: `You are an expert MCQ question generator for educational assessments. When creating questions:
1. Each question must be clear, unambiguous, and academically accurate.
2. All four options must be plausible — avoid obviously wrong distractors.
3. Only ONE option should be clearly correct.
4. The explanation must state why the correct answer is right in 1-2 sentences.
5. Output ONLY raw JSON objects, one per line, no markdown, no numbering, no extra text.
Format: {"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"...","difficulty":"medium"}`,

  question_extractor: `You are an expert at extracting MCQ questions from text, images, or scanned documents. When given content:
1. Identify each complete question with its options.
2. If the correct answer is marked (✓, *, bold, etc.), extract it as the answer index.
3. If no answer is marked, set answer to 0 as a placeholder.
4. Clean up OCR artifacts — fix obvious typos and formatting.
5. Output ONLY raw JSON objects, one per line, no markdown, no extra text.
Format: {"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"","difficulty":"medium"}`,
};

// ─── Rate limiting ─────────────────────────────────────────────
const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS_PER_WINDOW = 20;
const requestCounts = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  if (!requestCounts.has(userId)) requestCounts.set(userId, []);
  const timestamps = requestCounts.get(userId).filter(t => t > windowStart);
  requestCounts.set(userId, timestamps);
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) return false;
  timestamps.push(now);
  return true;
}

// ─── Message builder ───────────────────────────────────────────
function buildMessages(type, message, conversationHistory = []) {
  const systemPrompt = SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.general;
  return [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10),
    { role: 'user', content: message },
  ];
}

// ─── Provider 1: Ollama (free, local) ──────────────────────────
async function generateWithOllama(type, message, conversationHistory = []) {
  if (!OLLAMA_BASE_URL) {
    throw new Error('OLLAMA_BASE_URL not configured');
  }
  
  const messages = buildMessages(type, message, conversationHistory);
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT);
  
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          num_predict: 512,
        },
      }),
      signal: controller.signal,
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama API error ${response.status}: ${text.substring(0, 200)}`);
    }
    
    const data = await response.json();
    return data.message?.content || 'I could not generate a response.';
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Provider 2: Groq (free tier, fast) ────────────────────────
async function generateWithGroq(type, message, conversationHistory = []) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured');
  }
  
  const messages = buildMessages(type, message, conversationHistory);
  
  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      max_tokens: 512,
      temperature: 0.7,
      top_p: 0.9,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Groq API error ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices[0]?.message?.content || 'I could not generate a response.';
}

/**
 * Pull the visible answer text out of a Gemini response payload.
 * Newer models can emit reasoning segments (`part.thought === true`) and may
 * split the answer across several parts, so concatenate only the real text.
 */
function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((p) => typeof p?.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('');
}

// ─── Provider 3: Google Gemini (free tier) ─────────────────────
async function generateWithGemini(type, message, conversationHistory = []) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  
  const systemPrompt = SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.general;
  
  // Build conversation contents for Gemini format
  const contents = [];
  for (const msg of conversationHistory.slice(-10)) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }
  contents.push({ role: 'user', parts: [{ text: message }] });
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 512,
        },
      }),
    }
  );
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Gemini API error ${response.status}`);
  }
  
  const data = await response.json();
  return extractGeminiText(data) || 'I could not generate a response.';
}

// ─── Provider 4: OpenAI (paid) ─────────────────────────────────
async function generateWithOpenAI(type, message, conversationHistory = []) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  
  const messages = buildMessages(type, message, conversationHistory);
  
  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      max_tokens: 500,
      temperature: 0.7,
      top_p: 0.9,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `OpenAI API error ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices[0]?.message?.content || 'I could not generate a response.';
}

// ─── Vision: image → text ──────────────────────────────────────
// Only providers with genuine multimodal support are attempted. The text
// cascade above ends in a mock that would cheerfully invent questions for an
// image it never saw, so this path deliberately has NO mock fallback — if no
// vision provider is configured the caller is told to paste text instead.
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'llama3.2-vision';
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || GEMINI_MODEL;
const OPENAI_VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';

const IMAGE_MIME = /^data:(image\/(?:png|jpeg|webp|gif));base64,([\s\S]+)$/;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Normalise whatever the client sent into { mime, base64 }.
 * Accepts a bare base64 string, a data URL, or an http(s) URL (which the
 * multimodal APIs can fetch themselves).
 * @returns {{ mime, base64 } | { url } | null}
 */
function normalizeImage(image) {
  const raw = String(image || '').trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) return { url: raw };

  const dataUrl = raw.match(IMAGE_MIME);
  if (dataUrl) {
    const b64 = dataUrl[2].replace(/\s+/g, '');
    if (b64.length * 0.75 > MAX_IMAGE_BYTES) return null;
    return { mime: dataUrl[1], base64: b64 };
  }

  // Bare base64 — assume PNG, the format camera capture produces.
  const b64 = raw.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/=]+$/.test(b64) || b64.length * 0.75 > MAX_IMAGE_BYTES) return null;
  return { mime: 'image/png', base64: b64 };
}

function visionUrl(img) {
  return img.url || `data:${img.mime};base64,${img.base64}`;
}

function visionAvailable() {
  return Boolean(OLLAMA_BASE_URL || GROQ_API_KEY || GEMINI_API_KEY || OPENAI_API_KEY);
}

async function visionWithOllama(type, message, img) {
  if (!OLLAMA_BASE_URL) throw new Error('OLLAMA_BASE_URL not configured');
  if (img.url) throw new Error('Ollama requires raw image bytes, not a URL');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT);
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_VISION_MODEL,
        messages: [{ role: 'user', content: message, images: [img.base64] }],
        stream: false,
        options: { temperature: 0.4, num_predict: 2048 },
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Ollama vision error ${response.status}`);
    const data = await response.json();
    return data.message?.content || '';
  } finally {
    clearTimeout(timeout);
  }
}

async function visionWithOpenAICompatible(baseUrl, apiKey, model, type, message, img) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: message },
          { type: 'image_url', image_url: { url: visionUrl(img) } },
        ],
      }],
      max_tokens: 2048,
      temperature: 0.4,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `${model} vision error ${response.status}`);
  }
  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

async function visionWithGemini(type, message, img) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: message },
            img.url
              ? { fileData: { fileUri: img.url, mimeType: img.mime || 'image/png' } }
              : { inlineData: { mimeType: img.mime, data: img.base64 } },
          ],
        }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.question_extractor }] },
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
      }),
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini vision error ${response.status}`);
  }
  const data = await response.json();
  return extractGeminiText(data) || '';
}

/**
 * Multimodal generation. Same provider priority as generateAIResponse(), but
 * only for providers that can actually see the image, and with no mock
 * fallback: returning invented content for an image would be worse than an
 * honest error telling the user to paste the text.
 *
 * @returns {Promise<{success:boolean, response?:string, source?:string, model?:string, error?:string}>}
 */
async function generateVisionResponse(type, message, image, userId) {
  const img = normalizeImage(image);
  if (!img) {
    return { success: false, error: 'Image is missing, unreadable, or larger than 8 MB.' };
  }
  if (!checkRateLimit(userId)) {
    return { success: false, error: 'Rate limit exceeded. Please wait a moment before trying again.', retryAfter: 60 };
  }
  if (!visionAvailable()) {
    return {
      success: false,
      error: 'No vision-capable AI provider is configured. Set OLLAMA_BASE_URL, GROQ_API_KEY, GEMINI_API_KEY or OPENAI_API_KEY — or paste the text from the image instead.',
    };
  }

  const systemPrompt = SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.question_extractor;
  const prompt = `${systemPrompt}\n\n${message}`;

  const attempts = [
    ['ollama', () => visionWithOllama(type, prompt, img), OLLAMA_VISION_MODEL],
    ['groq', () => visionWithOpenAICompatible(GROQ_BASE_URL, GROQ_API_KEY, GROQ_VISION_MODEL, type, prompt, img), GROQ_VISION_MODEL],
    ['gemini', () => visionWithGemini(type, prompt, img), GEMINI_VISION_MODEL],
    ['openai', () => visionWithOpenAICompatible(OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_VISION_MODEL, type, prompt, img), OPENAI_VISION_MODEL],
  ];

  for (const [name, run, model] of attempts) {
    if (name === 'ollama' && !OLLAMA_BASE_URL) continue;
    if (name === 'groq' && !GROQ_API_KEY) continue;
    if (name === 'gemini' && !GEMINI_API_KEY) continue;
    if (name === 'openai' && !OPENAI_API_KEY) continue;

    try {
      const response = await run();
      if (response) {
        console.log(`[LLMService] ${name} vision responded (${model})`);
        return { success: true, response, source: 'ai', model: `${name}/${model}` };
      }
      console.warn(`[LLMService] ${name} vision returned an empty response`);
    } catch (error) {
      console.warn(`[LLMService] ${name} vision failed: ${error.message}`);
    }
  }

  return {
    success: false,
    error: 'No vision-capable provider could read this image. Paste the text from the image instead.',
  };
}

// ─── Provider 5: Mock fallback (always works) ──────────────────
function generateMockResponse(type, message) {
  const topic = message.substring(0, 80).replace(/[?!.]+$/, '').trim();
  
  const mockResponses = {
    doubt_solver: `Based on your question about "${topic}": Let me break this down step by step.

**1. Core Concept**: This involves understanding the fundamental principles that govern this topic.

**2. Key Insight**: The relationship between the components is crucial — once you grasp this, everything clicks.

**3. Example**: Think of it like building blocks — each concept supports the next. Start with the basics and build up.

**4. Practice**: Try solving similar problems to reinforce your understanding. Start with simpler cases first.

Would you like me to explain any specific part in more detail?`,
    
    academic_advisor: `For your academic progress regarding "${topic}":

**Immediate Actions:**
1. Focus on understanding fundamentals — don't skip basics
2. Dedicate 2-3 hours daily to this subject
3. Use standard textbooks + NPTEL/YouTube tutorials

**Weekly Goals:**
- Solve at least 5 practice problems
- Take a mini quiz every Friday
- Form a study group with 2-3 classmates

**Long-term Strategy:**
- Track your progress weekly
- Focus on conceptual clarity over memorization
- Connect this subject to your career goals

Remember: Consistency beats intensity. Small daily progress compounds over time.`,
    
    study_coach: `Study optimization tips for "${topic}":

**Active Recall Technique:**
1. Study for 25 minutes (Pomodoro)
2. Close your book and write everything you remember
3. Check what you missed and focus on those gaps
4. Repeat after 1 day, then 3 days, then 7 days

**Memory Palace Method:**
- Associate concepts with familiar locations
- Create a story linking the ideas together
- Review the mental map before sleep

**Time Management:**
- Tackle difficult topics when energy is highest (usually morning)
- Use interleaving: mix different topics in one session
- Take breaks — your brain consolidates learning during rest

**Pro Tip:** Teaching someone else is the best way to learn. Explain the concept to a friend or even to yourself out loud.`,
    
    code_helper: `Here's how to approach "${topic}":

**Approach:**
1. Understand the problem: What are the inputs and expected outputs?
2. Break it into smaller functions
3. Handle edge cases first (empty input, null values, etc.)
4. Write the main logic
5. Test with examples

**Example Structure:**
\`\`\`javascript
function solve(input) {
  // 1. Validate input
  if (!input || input.length === 0) return null;
  
  // 2. Process
  const result = input.map(item => transform(item));
  
  // 3. Return formatted output
  return result.filter(Boolean);
}
\`\`\`

**Complexity Analysis:**
- Time: O(n) for single pass, O(n²) for nested loops
- Space: O(1) if in-place, O(n) if creating new arrays

**Common Pitfalls:**
- Off-by-one errors in loops
- Not handling null/undefined
- Forgetting to return values

Want me to elaborate on any part?`,
    
    assignment_checker: `Assignment Evaluation:

**Score: 78/100**

**Strengths:**
- Good understanding of core concepts
- Clear explanation in most sections
- Proper structure and formatting

**Areas for Improvement:**
- Section 3 needs more specific examples
- Some claims lack supporting evidence
- Consider adding a conclusion that ties everything together

**Detailed Feedback:**
1. Content Accuracy: 8/10 — Mostly correct, minor gaps
2. Completeness: 7/10 — Missing 2 required sections
3. Presentation: 9/10 — Well-organized and readable
4. Critical Thinking: 7/10 — Could go deeper in analysis

**Recommendation:** Revise sections 3 and 5 with concrete examples, and you'll easily score 90+.`,
    
    interview_practice: `Technical Interview Questions:

**Question 1:** Explain the difference between stack and array.
*Expected answer:* Stack is LIFO with push/pop operations; array is indexed access. Stack is abstract data type, array is data structure.

**Question 2:** What is the time complexity of searching in a sorted array vs unsorted array?
*Expected answer:* Sorted: O(log n) with binary search. Unsorted: O(n) with linear search.

**Question 3:** Tell me about a challenging project you worked on.
*Tip:* Use STAR method — Situation, Task, Action, Result. Be specific about YOUR contribution.

**Question 4:** How do you handle disagreements in a team?
*Tip:* Show maturity — listen first, present data, find compromise, focus on the goal.

**Question 5:** Where do you see yourself in 5 years?
*Tip:* Show ambition tied to the company's growth. Be realistic but aspirational.

Want me to do a mock interview on any specific topic?`,

    question_generator: `{"question":"Which data structure follows Last-In, First-Out (LIFO) order?","options":["Queue","Stack","Array","Linked List"],"answer":1,"explanation":"A stack operates on LIFO semantics with push and pop operations.","difficulty":"easy"}
{"question":"What is the average time complexity of searching an element in a binary search tree?","options":["O(1)","O(n)","O(log n)","O(n log n)"],"answer":2,"explanation":"Each comparison halves the search space in a balanced BST.","difficulty":"medium"}
{"question":"Which protocol operates at the Transport Layer of the OSI model?","options":["HTTP","IP","TCP","Ethernet"],"answer":2,"explanation":"TCP provides reliable, ordered transport between processes.","difficulty":"medium"}`,
  };
  
  return mockResponses[type] || `Thank you for your question about "${topic}".

This is a great topic! Here's my recommendation:

**1. Understand the Basics**
Make sure you have the fundamentals clear before moving to advanced concepts.

**2. Practice Regularly**
Apply what you learn through exercises and projects. Theory without practice is incomplete.

**3. Review and Reflect**
Regular revision helps long-term retention. Take 10 minutes at the end of each study session to summarize what you learned.

**4. Ask Questions**
Don't hesitate to ask follow-up questions. Curiosity is the engine of learning.

What specific aspect would you like to explore further?`;
}

// ─── Main function: try providers in order ─────────────────────
async function generateAIResponse(type, message, userId, conversationHistory = []) {
  if (!checkRateLimit(userId)) {
    return {
      success: false,
      error: 'Rate limit exceeded. Please wait a moment before trying again.',
      retryAfter: 60,
    };
  }
  
  // Provider 1: Ollama (free, local)
  if (OLLAMA_BASE_URL) {
    try {
      const response = await generateWithOllama(type, message, conversationHistory);
      console.log(`[LLMService] Ollama responded (${OLLAMA_MODEL})`);
      return { success: true, response, source: 'ai', model: `ollama/${OLLAMA_MODEL}` };
    } catch (error) {
      console.warn(`[LLMService] Ollama failed: ${error.message}`);
    }
  }
  
  // Provider 2: Groq (free tier)
  if (GROQ_API_KEY) {
    try {
      const response = await generateWithGroq(type, message, conversationHistory);
      console.log(`[LLMService] Groq responded (${GROQ_MODEL})`);
      return { success: true, response, source: 'ai', model: `groq/${GROQ_MODEL}` };
    } catch (error) {
      console.warn(`[LLMService] Groq failed: ${error.message}`);
    }
  }
  
  // Provider 3: Google Gemini (free tier, 1500 req/day)
  if (GEMINI_API_KEY) {
    try {
      const response = await generateWithGemini(type, message, conversationHistory);
      console.log(`[LLMService] Gemini responded (${GEMINI_MODEL})`);
      return { success: true, response, source: 'ai', model: `gemini/${GEMINI_MODEL}` };
    } catch (error) {
      console.warn(`[LLMService] Gemini failed: ${error.message}`);
    }
  }
  
  // Provider 4: OpenAI (paid)
  if (OPENAI_API_KEY) {
    try {
      const response = await generateWithOpenAI(type, message, conversationHistory);
      console.log(`[LLMService] OpenAI responded (${OPENAI_MODEL})`);
      return { success: true, response, source: 'ai', model: `openai/${OPENAI_MODEL}` };
    } catch (error) {
      console.warn(`[LLMService] OpenAI failed: ${error.message}`);
    }
  }
  
  // Provider 5: Mock fallback (always works)
  console.log(`[LLMService] All providers unavailable, using mock responses`);
  const response = generateMockResponse(type, message);
  return { success: true, response, source: 'mock', model: 'mock' };
}

// ─── Study plan generator ──────────────────────────────────────
async function generateStudyPlanWithAI(subjects, hoursPerDay, days, examDate, userId) {
  const prompt = `Create a detailed study plan with these parameters:
- Subjects: ${subjects}
- Hours per day: ${hoursPerDay}
- Number of days: ${days}
- Exam date: ${examDate || 'Not specified'}

Provide a day-by-day schedule with specific topics and time allocations.
Format as a structured plan with: subject, topic, date, duration.`;
  
  const result = await generateAIResponse('study_coach', prompt, userId);
  
  if (result.success) {
    return {
      ...result,
      plan: parseAIStudyPlan(result.response, subjects, hoursPerDay, days),
    };
  }
  
  return result;
}

function parseAIStudyPlan(response, subjects, hoursPerDay, days) {
  const subjectsList = Array.isArray(subjects) ? subjects : subjects.split(',').map(s => s.trim());
  const totalDays = parseInt(days) || 7;
  const hours = parseInt(hoursPerDay) || 4;
  
  const plan = [];
  for (let day = 1; day <= totalDays; day++) {
    const date = new Date();
    date.setDate(date.getDate() + day);
    const dateStr = date.toISOString().split('T')[0];
    
    subjectsList.forEach((subject) => {
      plan.push({
        subject,
        topic: `Study ${subject} - Day ${day}`,
        date: dateStr,
        duration: `${Math.floor(hours / subjectsList.length)}h`,
        completed: false,
      });
    });
  }
  
  return plan;
}

// ─── Health check ──────────────────────────────────────────────
async function checkProviderHealth() {
  const providers = [];
  
  if (OLLAMA_BASE_URL) {
    try {
      const r = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
      const data = await r.json();
      providers.push({ name: 'ollama', status: 'available', models: data.models?.map(m => m.name) || [] });
    } catch {
      providers.push({ name: 'ollama', status: 'unavailable' });
    }
  } else {
    providers.push({ name: 'ollama', status: 'not_configured' });
  }
  
  providers.push({ name: 'groq', status: GROQ_API_KEY ? 'configured' : 'not_configured' });
  providers.push({ name: 'gemini', status: GEMINI_API_KEY ? 'configured' : 'not_configured' });
  providers.push({ name: 'openai', status: OPENAI_API_KEY ? 'configured' : 'not_configured' });
  providers.push({ name: 'mock', status: 'always_available' });
  
  return providers;
}

// ─── Streaming (real-time token delivery) ─────────────────────
// Same provider priority as generateAIResponse(). Each helper is an async
// generator that yields text chunks as the provider produces them, so the
// client sees the answer appear word by word instead of waiting for the
// whole response.

/** Parse an SSE (text/event-stream) body and map each event to a text chunk. */
async function* iterateSse(response, mapEvent) {
  const reader = typeof response.body?.getReader === 'function' ? response.body.getReader() : null;
  if (!reader) {
    // No streaming body available — fall back to a single JSON payload.
    const data = await response.json().catch(() => ({}));
    const text = mapEvent(data);
    if (text) yield text;
    return;
  }
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith(':') || line.startsWith('event:')) continue;
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let text = '';
      try {
        text = mapEvent(JSON.parse(payload)) || '';
      } catch {
        text = '';
      }
      if (text) yield text;
    }
  }
}

async function* streamWithOllama(type, message, conversationHistory = []) {
  const systemPrompt = SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.general;
  const prompt = [
    `System: ${systemPrompt}`,
    ...conversationHistory.slice(-10).map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`),
    `User: ${message}`,
    'Assistant:',
  ].join('\n');

  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: true }),
    signal: AbortSignal.timeout(OLLAMA_TIMEOUT),
  });
  if (!response.ok) throw new Error(`Ollama API error ${response.status}`);

  // Ollama streams NDJSON (one JSON object per line), not SSE.
  const reader = typeof response.body?.getReader === 'function' ? response.body.getReader() : null;
  if (!reader) {
    const data = await response.json().catch(() => ({}));
    if (data.response) yield data.response;
    return;
  }
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const chunk = JSON.parse(line);
        if (chunk.response) yield chunk.response;
      } catch { /* incomplete line — buffered for the next read */ }
    }
  }
}

async function* streamWithOpenAICompatible(baseUrl, apiKey, model, type, message, conversationHistory = []) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: buildMessages(type, message, conversationHistory),
      stream: true,
      temperature: 0.7,
      max_tokens: 512,
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error ${response.status}`);
  }
  yield* iterateSse(response, data => data.choices?.[0]?.delta?.content || '');
}

/** Google Gemini streaming via :streamGenerateContent?alt=sse */
async function* streamWithGemini(type, message, conversationHistory = []) {
  const systemPrompt = SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.general;
  const contents = [];
  for (const msg of conversationHistory.slice(-10)) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }
  contents.push({ role: 'user', parts: [{ text: message }] });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.7, topP: 0.9, maxOutputTokens: 1024 },
      }),
      signal: AbortSignal.timeout(90000),
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Gemini API error ${response.status}`);
  }
  yield* iterateSse(response, (data) => extractGeminiText(data));
}

/**
 * Stream an AI response in real time.
 *
 * Yields `{ token: string }` chunks while generating, and finishes with a
 * `{ final: { success, source, model } }` event so the caller knows which
 * provider produced the answer.
 */
async function* streamAIResponse(type, message, userId, conversationHistory = []) {
  if (!checkRateLimit(userId)) {
    yield { token: 'Rate limit exceeded. Please wait a moment before trying again.' };
    yield { final: { success: false, source: 'rate_limit', model: null } };
    return;
  }

  const providers = [
    ['ollama', Boolean(OLLAMA_BASE_URL), `ollama/${OLLAMA_MODEL}`,
      () => streamWithOllama(type, message, conversationHistory)],
    ['groq', Boolean(GROQ_API_KEY), `groq/${GROQ_MODEL}`,
      () => streamWithOpenAICompatible(GROQ_BASE_URL, GROQ_API_KEY, GROQ_MODEL, type, message, conversationHistory)],
    ['gemini', Boolean(GEMINI_API_KEY), `gemini/${GEMINI_MODEL}`,
      () => streamWithGemini(type, message, conversationHistory)],
    ['openai', Boolean(OPENAI_API_KEY), `openai/${OPENAI_MODEL}`,
      () => streamWithOpenAICompatible(OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL, type, message, conversationHistory)],
  ];

  for (const [name, enabled, model, run] of providers) {
    if (!enabled) continue;
    let emitted = '';
    try {
      for await (const chunk of run()) {
        emitted += chunk;
        yield { token: chunk };
      }
      if (emitted) {
        console.log(`[LLMService] ${name} streamed a response (${model})`);
        yield { final: { success: true, source: 'ai', model } };
        return;
      }
      console.warn(`[LLMService] ${name} returned an empty streamed response`);
    } catch (error) {
      console.warn(`[LLMService] ${name} streaming failed: ${error.message}`);
      if (emitted) {
        // Partial answer already delivered — keep it instead of restarting
        // with another provider's fresh answer.
        yield { final: { success: true, source: 'ai', model } };
        return;
      }
    }
  }

  console.log('[LLMService] All providers unavailable for streaming, using mock response');
  yield { token: generateMockResponse(type, message) };
  yield { final: { success: true, source: 'mock', model: 'mock' } };
}

module.exports = {
  generateAIResponse,
  streamAIResponse,
  generateVisionResponse,
  generateStudyPlanWithAI,
  generateMockResponse,
  checkRateLimit,
  checkProviderHealth,
};
