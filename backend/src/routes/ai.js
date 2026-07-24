const express = require('express');
const { getDB, oid } = require('../db');
const { serializeUser, sendError, makeCode, nowIso } = require('../utils');

function generateMockResponse(type, message) {
  const topic = message.substring(0, 80).replace(/[?!.]+$/, '').trim();

  switch (type) {
    case 'doubt_solver':
      return `Based on your question about "${topic}", here's a detailed explanation: The concept involves understanding the fundamental principles and applying them step by step. First, identify the core components of the problem. Then, analyze how they relate to each other. The key insight is that this topic builds on previously learned concepts, so reviewing foundational material can be helpful. Consider working through practice examples to solidify your understanding.`;

    case 'academic_advisor':
      return `For your academic progress, I recommend: Focus on maintaining a consistent study schedule. Break down complex subjects into manageable chunks. Regular revision is more effective than cramming before exams. Consider forming study groups for collaborative learning. Pay attention to subjects where you feel less confident and allocate extra time for them. Track your progress weekly to stay on top of your goals.`;

    case 'study_coach':
      return `Here's a study tip: Try the Pomodoro Technique — study for 25 minutes, then take a 5-minute break. After four cycles, take a longer 15-30 minute break. This helps maintain focus and prevents burnout. Active recall and spaced repetition are proven techniques for long-term retention. Quiz yourself regularly rather than passively re-reading material.`;

    case 'code_helper':
      return `Here's how to approach this coding problem: Break the problem into smaller sub-problems. Identify the inputs and expected outputs clearly. Consider edge cases early. Start with a brute-force approach to get a working solution, then optimize. Use meaningful variable names and add comments for complex logic. Test your solution with different inputs including edge cases before finalizing.`;

    default:
      return `Thank you for your question about "${topic}". Here's what I can help with: This is an interesting topic that touches on several key concepts. To give you the best guidance, I'd recommend exploring the subject from both theoretical and practical perspectives. Feel free to ask follow-up questions for more specific information.`;
  }
}

function generateStudyPlan(subjects, hoursPerDay, days, examDate) {
  const plan = [];
  const subjectsList = Array.isArray(subjects) ? subjects : subjects.split(',').map(s => s.trim());
  const totalDays = parseInt(days) || 7;
  const hours = parseInt(hoursPerDay) || 4;
  const hoursPerSubjectPerDay = Math.floor(hours / subjectsList.length) || 1;

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date();
    date.setDate(date.getDate() + day);
    const dateStr = date.toISOString().split('T')[0];

    subjectsList.forEach((subject) => {
      plan.push({
        subject,
        topic: `Review and practice ${subject} - Day ${day}`,
        date: dateStr,
        duration: `${hoursPerSubjectPerDay}h`,
        completed: false,
      });
    });
  }

  return {
    title: `Study Plan - ${subjectsList.join(', ')}`,
    startDate: new Date().toISOString().split('T')[0],
    endDate: examDate || new Date(Date.now() + totalDays * 86400000).toISOString().split('T')[0],
    tasks: plan,
  };
}

function createAiRouter(io) {
  const router = express.Router();

  router.get('/sessions', async (req, res) => {
    try {
      const db = getDB();
      const sessions = await db.collection('ai_sessions')
        .find({ userId: oid(req.user._id) })
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
          userId: oid(currentUserId),
          type: aiType,
          title: message.substring(0, 60),
          createdAt: nowIso(),
        };
        const { insertedId } = await db.collection('ai_sessions').insertOne(session);
        sid = insertedId;
      }

      const userMessage = {
        sessionId: oid(sid),
        role: 'user',
        content: message,
        createdAt: nowIso(),
      };
      await db.collection('ai_messages').insertOne(userMessage);

      const assistantContent = generateMockResponse(aiType, message);
      const assistantMessage = {
        sessionId: oid(sid),
        role: 'assistant',
        content: assistantContent,
        createdAt: nowIso(),
      };
      await db.collection('ai_messages').insertOne(assistantMessage);

      io.to(currentUserId.toString()).emit('ai:message', {
        sessionId: sid,
        userMessage,
        assistantMessage,
      });

      res.status(201).json({ sessionId: sid, message: assistantMessage });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/doubt-solver', async (req, res) => {
    try {
      const { question } = req.body;
      if (!question) return sendError(res, 'Question is required', 400);

      const answer = generateMockResponse('doubt_solver', question);
      res.json({ question, answer });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/academic-advisor', async (req, res) => {
    try {
      const { question } = req.body;
      if (!question) return sendError(res, 'Question is required', 400);

      const advice = generateMockResponse('academic_advisor', question);
      res.json({ question, advice });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/study-plan', async (req, res) => {
    try {
      const db = getDB();
      const { subjects, hoursPerDay, days, examDate } = req.body;

      if (!subjects) return sendError(res, 'Subjects are required', 400);

      const planData = generateStudyPlan(subjects, hoursPerDay, days, examDate);

      const plan = {
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
        .find({ userId: oid(req.user._id) })
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

  return router;
}

module.exports = { createAiRouter };
