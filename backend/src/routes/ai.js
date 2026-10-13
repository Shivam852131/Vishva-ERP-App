const express = require('express');
const { getDB, oid } = require('../db');
const { serializeUser, sendError, makeCode, nowIso, roomForUser } = require('../utils');
const { generateAIResponse, generateStudyPlanWithAI, checkProviderHealth } = require('../ml/llmService');
const { getPerformanceInsights } = require('../ml/performancePredictor');
const { collegeFilter, requireCollegeAccess } = require('../auth');

function createAiRouter(io) {
  const router = express.Router();

  router.get('/sessions', async (req, res) => {
    try {
      const db = getDB();
      const sessions = await db.collection('ai_sessions')
        .find({ userId: oid(req.user._id), ...collegeFilter(req) })
        .sort({ createdAt: -1 })
        .toArray();

      res.json(sessions);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/sessions/:id/messages', async (req, res) => {
    try {
      const db = getDB();
      const session = await db.collection('ai_sessions').findOne({
        _id: oid(req.params.id),
        userId: oid(req.user._id),
        ...collegeFilter(req),
      });
      if (!session) return sendError(res, 'Session not found', 404);
      const messages = await db.collection('ai_messages')
        .find({ sessionId: session._id, ...collegeFilter(req) })
        .sort({ createdAt: 1 })
        .toArray();

      res.json(messages);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/chat', async (req, res) => {
    try {
      const db = getDB();
      const { sessionId, message, type } = req.body;
      const aiType = type || 'general';
      const currentUserId = req.user._id;

      let sid = sessionId;

      if (!sid) {
        const session = {
          collegeId: oid(req.userCollegeId),
          userId: oid(currentUserId),
          type: aiType,
          title: message.substring(0, 60),
          createdAt: nowIso(),
        };
        const { insertedId } = await db.collection('ai_sessions').insertOne(session);
        sid = insertedId;
      } else {
        const session = await db.collection('ai_sessions').findOne({
          _id: oid(sid),
          userId: oid(currentUserId),
          ...collegeFilter(req),
        });
        if (!session) return sendError(res, 'Session not found', 404);
      }

      const userMessage = {
        collegeId: oid(req.userCollegeId),
        sessionId: oid(sid),
        role: 'user',
        content: message,
        createdAt: nowIso(),
      };
      await db.collection('ai_messages').insertOne(userMessage);

      // Get conversation history for context
      const history = await db.collection('ai_messages')
        .find({ sessionId: oid(sid), ...collegeFilter(req) })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray()
        .then(msgs => msgs.reverse().map(m => ({ role: m.role, content: m.content })));

      // Generate AI response using LLM service
      const aiResult = await generateAIResponse(aiType, message, currentUserId, history);

      const assistantMessage = {
        collegeId: oid(req.userCollegeId),
        sessionId: oid(sid),
        role: 'assistant',
        content: aiResult.response,
        metadata: {
          source: aiResult.source,
          model: aiResult.model,
        },
        createdAt: nowIso(),
      };
      await db.collection('ai_messages').insertOne(assistantMessage);

      io.to(roomForUser(currentUserId)).emit('ai:message', {
        sessionId: sid,
        userMessage,
        assistantMessage,
      });

      res.status(201).json({ 
        sessionId: sid, 
        message: assistantMessage,
        source: aiResult.source,
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/doubt-solver', async (req, res) => {
    try {
      const { question } = req.body;
      if (!question) return sendError(res, 'Question is required', 400);

      const result = await generateAIResponse('doubt_solver', question, req.user._id);
      res.json({ 
        question, 
        answer: result.response,
        source: result.source,
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/academic-advisor', async (req, res) => {
    try {
      const { question } = req.body;
      if (!question) return sendError(res, 'Question is required', 400);

      const result = await generateAIResponse('academic_advisor', question, req.user._id);
      res.json({ 
        question, 
        advice: result.response,
        source: result.source,
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/study-plan', async (req, res) => {
    try {
      const db = getDB();
      const { subjects, hoursPerDay, days, examDate } = req.body;

      if (!subjects) return sendError(res, 'Subjects are required', 400);

      // Generate study plan using AI
      const aiResult = await generateStudyPlanWithAI(
        subjects, hoursPerDay, days, examDate, req.user._id
      );

      let planData;
      if (aiResult.success && aiResult.plan) {
        planData = {
          title: `AI Study Plan - ${Array.isArray(subjects) ? subjects.join(', ') : subjects}`,
          startDate: new Date().toISOString().split('T')[0],
          endDate: examDate || new Date(Date.now() + (parseInt(days) || 7) * 86400000).toISOString().split('T')[0],
          tasks: aiResult.plan,
          aiGenerated: true,
          aiSource: aiResult.source,
        };
      } else {
        // Fallback to basic plan generation
        const subjectsList = Array.isArray(subjects) ? subjects : subjects.split(',').map(s => s.trim());
        const totalDays = parseInt(days) || 7;
        const hours = parseInt(hoursPerDay) || 4;
        
        const tasks = [];
        for (let day = 1; day <= totalDays; day++) {
          const date = new Date();
          date.setDate(date.getDate() + day);
          const dateStr = date.toISOString().split('T')[0];
          
          subjectsList.forEach((subject) => {
            tasks.push({
              subject,
              topic: `Study ${subject} - Day ${day}`,
              date: dateStr,
              duration: `${Math.floor(hours / subjectsList.length)}h`,
              completed: false,
            });
          });
        }
        
        planData = {
          title: `Study Plan - ${subjectsList.join(', ')}`,
          startDate: new Date().toISOString().split('T')[0],
          endDate: examDate || new Date(Date.now() + totalDays * 86400000).toISOString().split('T')[0],
          tasks,
          aiGenerated: false,
        };
      }

      const plan = {
        collegeId: oid(req.userCollegeId),
        userId: oid(req.user._id),
        ...planData,
        createdAt: nowIso(),
      };

      const { insertedId } = await db.collection('study_plans').insertOne(plan);

      res.status(201).json({ ...plan, _id: insertedId });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/study-plans', async (req, res) => {
    try {
      const db = getDB();
      const plans = await db.collection('study_plans')
        .find({ userId: oid(req.user._id), ...collegeFilter(req) })
        .sort({ createdAt: -1 })
        .toArray();

      res.json(plans);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/study-plans/:id/toggle', async (req, res) => {
    try {
      const db = getDB();
      const { taskIndex } = req.body;

      const plan = await db.collection('study_plans').findOne({
        _id: oid(req.params.id),
        userId: oid(req.user._id),
        ...collegeFilter(req),
      });

      if (!plan) return sendError(res, 'Plan not found', 404);

      const index = parseInt(taskIndex);
      if (isNaN(index) || index < 0 || index >= plan.tasks.length) {
        return sendError(res, 'Invalid task index', 400);
      }

      plan.tasks[index].completed = !plan.tasks[index].completed;

      await db.collection('study_plans').updateOne(
        { _id: oid(req.params.id), userId: oid(req.user._id), ...collegeFilter(req) },
        { $set: { tasks: plan.tasks } }
      );

      res.json(plan);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.delete('/study-plans/:id', async (req, res) => {
    try {
      const db = getDB();
      const result = await db.collection('study_plans').deleteOne({
        _id: oid(req.params.id),
        userId: oid(req.user._id),
        ...collegeFilter(req),
      });

      if (result.deletedCount === 0) return sendError(res, 'Plan not found', 404);

      res.json({ message: 'Plan deleted' });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/stats', async (req, res) => {
    try {
      const db = getDB();
      const userId = oid(req.user._id);
      const collegeQ = collegeFilter(req);
      const sessions = await db.collection('ai_sessions').find({ userId, ...collegeQ }, { projection: { _id: 1 } }).toArray();
      const sessionIds = sessions.map(session => session._id);
      const [questions, plans, submissions] = await Promise.all([
        sessionIds.length ? db.collection('ai_messages').countDocuments({ sessionId: { $in: sessionIds }, role: 'user', ...collegeQ }) : 0,
        db.collection('study_plans').find({ userId, ...collegeQ }).toArray(),
        db.collection('ai_assignment_checks').countDocuments({ userId, ...collegeQ }),
      ]);
      const tasksDone = plans.reduce((sum, plan) => sum + (plan.tasks || []).filter(t => t.completed).length, 0) + submissions;
      res.json({ questions, studyHours: `${plans.length * 2}h`, tasksDone, streak: 0 });
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  router.get('/submissions', async (req, res) => {
    try {
      const db = getDB();
      const submissions = await db.collection('ai_assignment_checks')
        .find({ userId: oid(req.user._id), ...collegeFilter(req) })
        .sort({ createdAt: -1 })
        .limit(25)
        .toArray();
      res.json(submissions.map(s => ({
        id: String(s._id),
        subject: s.subject,
        topic: s.topic,
        score: s.result?.score || 0,
        created_at: s.createdAt,
      })));
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  router.post('/check-assignment', async (req, res) => {
    try {
      const db = getDB();
      const { subject, topic, content } = req.body || {};
      if (!subject) return sendError(res, 'subject is required.', 400);

      const prompt = `Evaluate this ${subject} assignment${topic ? ` on ${topic}` : ''}. Give concise strengths, issues, and improvement suggestions. Assignment content: ${content || ''}`;
      const aiResult = await generateAIResponse('assignment_checker', prompt, req.user._id);
      const feedback = aiResult.response || '';
      const result = {
        score: 75,
        breakdown: [
          { label: 'Concepts', score: 75, color: '#4F46E5' },
          { label: 'Structure', score: 72, color: '#059669' },
          { label: 'Completeness', score: 78, color: '#F59E0B' },
        ],
        comments: [
          { type: 'good', text: feedback || 'Submission reviewed successfully.' },
        ],
        suggestions: feedback ? [feedback] : ['Review feedback and resubmit after improvements.'],
      };

      await db.collection('ai_assignment_checks').insertOne({
        collegeId: oid(req.userCollegeId),
        userId: oid(req.user._id),
        subject,
        topic: topic || '',
        result,
        createdAt: nowIso(),
      });
      res.json(result);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  router.get('/interview-questions', async (req, res) => {
    try {
      const db = getDB();
      const type = req.query.type || 'technical';
      const stored = await db.collection('interview_questions')
        .find({ type, ...collegeFilter(req) })
        .limit(10)
        .toArray();
      if (stored.length) {
        return res.json({ questions: stored.map(q => ({ q: q.question || q.q, tips: q.tips || [], sampleAnswer: q.sampleAnswer || q.sample_answer || '' })) });
      }

      const aiResult = await generateAIResponse('interview_practice', `Create 5 ${type} interview questions with concise tips and sample answers.`, req.user._id);
      const text = aiResult.response || '';
      const questions = text
        .split(/\n+/)
        .map(line => line.replace(/^\d+[.)]\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 5)
        .map(q => ({ q, tips: ['Answer with a clear example.', 'Keep it concise and measurable.'], sampleAnswer: 'Structure your answer using context, action, and result.' }));
      res.json({ questions });
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  router.get('/insights', async (req, res) => {
    try {
      const db = getDB();
      const results = await db.collection('exam_results')
        .find({ studentId: oid(req.user._id), ...collegeFilter(req) })
        .sort({ createdAt: -1 })
        .toArray();
      if (!results.length) return res.json([]);

      const avg = Math.round(results.reduce((sum, r) => sum + Number(r.marks || r.score || 0), 0) / results.length);
      const best = results.reduce((a, b) => Number(a.marks || a.score || 0) >= Number(b.marks || b.score || 0) ? a : b);
      const worst = results.reduce((a, b) => Number(a.marks || a.score || 0) <= Number(b.marks || b.score || 0) ? a : b);
      res.json([
        { type: avg >= 75 ? 'strength' : 'improvement', text: `Your current average is ${avg}%. ${avg >= 75 ? 'Maintain this consistency.' : 'Focus on revision and practice tests.'}` },
        { type: 'strength', text: `Strongest subject: ${best.subject || best.courseName || 'Top subject'} with ${best.marks || best.score || 0} marks.` },
        { type: 'improvement', text: `Needs focus: ${worst.subject || worst.courseName || 'Lowest subject'} with ${worst.marks || worst.score || 0} marks.` },
      ]);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  // New endpoint: Get performance insights
  router.get('/performance-insights', async (req, res) => {
    try {
      const insights = await getPerformanceInsights(req.user._id);
      res.json(insights);
    } catch (err) {
      sendError(res, err);
    }
  });

  // New endpoint: Get AI-powered study recommendations
  router.post('/study-recommendations', async (req, res) => {
    try {
      const { weakAreas } = req.body;
      
      const prompt = `Based on these weak areas: ${JSON.stringify(weakAreas)}, 
Provide specific study recommendations. Include:
1. Which topics to focus on first
2. Suggested study techniques for each
3. Time allocation recommendations
4. Practice resources`;
      
      const result = await generateAIResponse('study_coach', prompt, req.user._id);
      
      res.json({
        recommendations: result.response,
        source: result.source,
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/providers', async (req, res) => {
    try {
      const providers = await checkProviderHealth();
      res.json({ providers });
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
}

module.exports = { createAiRouter };
