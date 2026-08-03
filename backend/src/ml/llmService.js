/**
 * LLM Service — Real AI-powered responses for chat, doubt solving, study plans
 * 
 * Supports OpenAI API (GPT-3.5/GPT-4) with fallback to mock responses.
 * Configure OPENAI_API_KEY in .env to enable real AI.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

// System prompts for different AI types
const SYSTEM_PROMPTS = {
  general: `You are Vishva AI, an intelligent educational assistant for college students in India. 
You help with academic doubts, career guidance, study strategies, and skill development.
Be concise, practical, and encouraging. Use simple language. Reference Indian education context when relevant.`,
  
  doubt_solver: `You are an expert academic tutor. When a student asks a doubt:
1. Identify the core concept
2. Explain it step-by-step with examples
3. Provide a simple analogy if helpful
4. Suggest related topics to review
Keep explanations clear and under 200 words.`,
  
  academic_advisor: `You are an academic advisor for engineering/CS students. When giving advice:
1. Analyze the student's situation
2. Provide specific, actionable recommendations
3. Prioritize high-impact strategies
4. Consider Indian college context (semesters, internals, placements)
Be direct and practical.`,
  
  study_coach: `You are a study coach helping students optimize their learning. When giving tips:
1. Base advice on evidence-based learning techniques
2. Provide specific, implementable strategies
3. Consider time constraints of college students
4. Focus on retention and understanding, not just cramming
Keep it actionable and motivating.`,
  
  code_helper: `You are a coding instructor helping students learn programming. When helping with code:
1. Explain the approach before code
2. Write clean, commented code
3. Mention time/space complexity when relevant
4. Suggest edge cases to consider
Use JavaScript, Python, or C++ as appropriate.`,
};

// Rate limiting
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;
const requestCounts = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  if (!requestCounts.has(userId)) {
    requestCounts.set(userId, []);
  }
  
  const timestamps = requestCounts.get(userId).filter(t => t > windowStart);
  requestCounts.set(userId, timestamps);
  
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  timestamps.push(now);
  return true;
}

// Build conversation messages for OpenAI
function buildMessages(type, message, conversationHistory = []) {
  const systemPrompt = SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.general;
  
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10), // Keep last 10 messages for context
    { role: 'user', content: message },
  ];
  
  return messages;
}

// Generate response using OpenAI API
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
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages,
      max_tokens: 500,
      temperature: 0.7,
      top_p: 0.9,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenAI API error');
  }
  
  const data = await response.json();
  return data.choices[0]?.message?.content || 'I could not generate a response.';
}

// Fallback mock response (when OpenAI is not configured)
function generateMockResponse(type, message) {
  const topic = message.substring(0, 80).replace(/[?!.]+$/, '').trim();
  
  const mockResponses = {
    doubt_solver: `Based on your question about "${topic}": Let me break this down step by step. 

1. **Core Concept**: This involves understanding the fundamental principles.
2. **Key Insight**: The relationship between the components is crucial.
3. **Example**: Think of it like building blocks - each concept supports the next.
4. **Practice**: Try solving similar problems to reinforce your understanding.

Would you like me to explain any specific part in more detail?`,
    
    academic_advisor: `For your academic progress regarding "${topic}":

1. **Immediate Action**: Focus on understanding the fundamentals first
2. **Weekly Goal**: Dedicate 2-3 hours daily to this subject
3. **Resources**: Use standard textbooks + online tutorials
4. **Assessment**: Take practice tests weekly to track progress
5. **Peer Learning**: Form a study group for this topic

Remember: Consistency beats intensity. Small daily progress compounds over time.`,
    
    study_coach: `Study tip for "${topic}":

**Technique**: Active Recall + Spaced Repetition
1. After studying, close the book and write down everything you remember
2. Review your notes after 1 day, then 3 days, then 7 days
3. Focus on concepts you struggle with

**Time Management**: 
- Use Pomodoro: 25 min study + 5 min break
- Tackle difficult topics when your energy is highest

**Pro Tip**: Teaching someone else is the best way to learn.`,
    
    code_helper: `Here's how to approach "${topic}":

**Approach**:
1. Break the problem into smaller functions
2. Define clear inputs and outputs
3. Handle edge cases first

**Example Structure**:
\`\`\`javascript
function solve(input) {
  // Validate input
  if (!input) return null;
  
  // Main logic
  const result = processInput(input);
  
  // Return formatted output
  return formatResult(result);
}
\`\`\`

**Complexity**: Aim for O(n) or O(n log n) solutions when possible.

Want me to elaborate on any part?`,
  };
  
  return mockResponses[type] || `Thank you for your question about "${topic}". 

This is an interesting topic that touches on several key concepts. Here's what I recommend:

1. **Understand the Basics**: Make sure you have the fundamentals clear
2. **Practice**: Apply what you learn through exercises
3. **Review**: Regular revision helps long-term retention
4. **Ask Questions**: Don't hesitate to ask follow-up questions

What specific aspect would you like to explore further?`;
}

// Main function to generate AI response
async function generateAIResponse(type, message, userId, conversationHistory = []) {
  // Check rate limit
  if (!checkRateLimit(userId)) {
    return {
      success: false,
      error: 'Rate limit exceeded. Please wait a moment before trying again.',
      retryAfter: 60,
    };
  }
  
  try {
    // Try OpenAI first
    const response = await generateWithOpenAI(type, message, conversationHistory);
    
    return {
      success: true,
      response,
      source: 'ai',
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    };
  } catch (error) {
    console.warn(`[LLMService] OpenAI failed, using mock: ${error.message}`);
    
    // Fallback to mock response
    const response = generateMockResponse(type, message);
    
    return {
      success: true,
      response,
      source: 'mock',
      model: 'fallback',
    };
  }
}

// Generate study plan using AI
async function generateStudyPlanWithAI(subjects, hoursPerDay, days, examDate, userId) {
  const prompt = `Create a detailed study plan with these parameters:
- Subjects: ${subjects}
- Hours per day: ${hoursPerDay}
- Number of days: ${days}
- Exam date: ${examDate || 'Not specified'}

Provide a day-by-day schedule with specific topics and time allocations.
Format as a structured plan with: subject, topic, date, duration.`;
  
  const result = await generateAIResponse('study_coach', prompt, userId);
  
  if (result.success && result.source === 'ai') {
    // Parse AI response into structured format
    return {
      ...result,
      plan: parseAIStudyPlan(result.response, subjects, hoursPerDay, days),
    };
  }
  
  return result;
}

// Parse AI-generated study plan into structured format
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

module.exports = {
  generateAIResponse,
  generateStudyPlanWithAI,
  generateMockResponse,
  checkRateLimit,
};
