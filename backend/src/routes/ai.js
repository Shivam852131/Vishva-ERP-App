const express = require('express');
const { getDB, oid } = require('../db');
const { serializeUser, sendError, makeCode, nowIso, roomForUser } = require('../utils');
const { generateAIResponse, generateStudyPlanWithAI } = require('../ml/llmService');
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
      const messages = await db.collection('ai_messages')
        .find({ sessionId: oid(req.params.id) })
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
        .find({ sessionId: oid(sid) })
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
      });

      if (!plan) return sendError(res, 'Plan not found', 404);

      const index = parseInt(taskIndex);
      if (isNaN(index) || index < 0 || index >= plan.tasks.length) {
        return sendError(res, 'Invalid task index', 400);
      }

      plan.tasks[index].completed = !plan.tasks[index].completed;

      await db.collection('study_plans').updateOne(
        { _id: oid(req.params.id) },
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
      });

      if (result.deletedCount === 0) return sendError(res, 'Plan not found', 404);

      res.json({ message: 'Plan deleted' });
    } catch (err) {
      sendError(res, err);
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

  return router;
}

module.exports = { createAiRouter };
