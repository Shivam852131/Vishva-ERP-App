const express = require('express');
const { prisma } = require('../db');
const { authUser } = require('../auth');
const { sendError, isoDate, daysFromNow } = require('../utils');

function aiReply(prompt, mode) {
  const base = String(prompt || '').trim() || 'your question';
  if (mode === 'doubt') {
    return `Here is a clear explanation for ${base}: break it into concepts, identify one worked example, and then solve one similar practice problem yourself.`;
  }
  if (mode === 'study') {
    return `For ${base}, spend one session on understanding core ideas, one on examples, and one on recall practice. End with a quick self-test.`;
  }
  return `For ${base}, start with the key definition, then connect it to one practical example and one exam-style takeaway.`;
}

function generateStudyPlan(body) {
  const totalDays = Math.max(1, Math.min(30, Number(body.days || 7)));
  const hoursPerDay = Math.max(1, Math.min(12, Number(body.hours_per_day || 3)));
  const goal = body.goal || `${body.plan_type || 'study'} plan`;
  const days = Array.from({ length: totalDays }, (_, index) => ({
    day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index % 7],
    date: isoDate(daysFromNow(index)),
    focus: index % 2 === 0 ? 'Revision and active recall' : 'Problem solving and notes review',
    tasks: [
      { time: '07:00', task: `Warm-up review for ${goal}`, course: 'General', done: false },
      { time: '18:00', task: `Focused ${hoursPerDay}h study block`, course: 'General', done: false },
      { time: '21:00', task: 'Quick recap and self-test', course: 'General', done: false },
    ],
  }));
  return {
    plan_type: body.plan_type || 'study',
    goal,
    plan: {
      title: `${totalDays}-Day ${body.plan_type === 'revision' ? 'Revision' : 'Study'} Plan`,
      tips: ['Use 45-minute focus blocks', 'Review weak topics before ending the day', 'Keep one short recall session daily'],
      days,
    },
  };
}

function createAiRouter(io) {
  const router = express.Router();

  async function ensureAiSession(sessionId, userId, title) {
    let session = sessionId ? await prisma.aiSession.findUnique({ where: { id: sessionId } }) : null;
    if (!session) {
      session = await prisma.aiSession.create({
        data: { ...(sessionId ? { id: sessionId } : {}), userId, title },
      });
    }
    return session;
  }

  router.get('/ai/sessions', async (req, res) => {
    const user = await authUser(req);
    const sessions = await prisma.aiSession.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
    res.json(sessions.map(session => ({
      session_id: session.id,
      user_id: session.userId,
      title: session.title,
      created_at: session.createdAt.toISOString(),
      updated_at: session.updatedAt.toISOString(),
      message_count: session._count.messages,
    })));
  });

  router.get('/ai/history/:sessionId', async (req, res) => {
    const messages = await prisma.aiMessage.findMany({
      where: { sessionId: req.params.sessionId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(messages.map(message => ({
      id: message.id,
      user_msg: message.userMsg,
      ai_msg: message.aiMsg,
      created_at: message.createdAt.toISOString(),
    })));
  });

  router.post('/ai/doubt', async (req, res) => {
    const user = await authUser(req);
    const session = await ensureAiSession(req.body.session_id, user.id, 'Doubt Solver');
    const reply = aiReply(req.body.message, 'doubt');
    await prisma.aiMessage.create({ data: { sessionId: session.id, userMsg: req.body.message || '', aiMsg: reply } });
    await prisma.aiSession.update({ where: { id: session.id }, data: { updatedAt: new Date() } });
    io.emit('ai:sessions:update', { sessionId: session.id, userId: user.id });
    res.json({ reply });
  });

  router.post('/ai/chat', async (req, res) => {
    const user = await authUser(req);
    const session = await ensureAiSession(req.body.session_id, user.id, 'Academic Advisor');
    const reply = aiReply(req.body.message, req.body.context || 'general');
    await prisma.aiMessage.create({ data: { sessionId: session.id, userMsg: req.body.message || '', aiMsg: reply } });
    await prisma.aiSession.update({ where: { id: session.id }, data: { updatedAt: new Date() } });
    io.emit('ai:sessions:update', { sessionId: session.id, userId: user.id });
    res.json({ reply });
  });

  router.get('/ai/study-plans', async (_req, res) => {
    const plans = await prisma.studyPlan.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(plans.map(plan => ({
      id: plan.id,
      plan_type: plan.planType,
      goal: plan.goal,
      created_at: plan.createdAt.toISOString(),
      plan: plan.plan,
    })));
  });

  router.post('/ai/study-plan', async (req, res) => {
    const user = await authUser(req);
    const result = generateStudyPlan(req.body || {});
    const created = await prisma.studyPlan.create({
      data: { userId: user.id, planType: result.plan_type, goal: result.goal, plan: result.plan },
    });
    io.emit('study-plans:update', { planId: created.id });
    res.json({
      id: created.id,
      plan_type: created.planType,
      goal: created.goal,
      created_at: created.createdAt.toISOString(),
      plan: created.plan,
    });
  });

  router.post('/ai/study-plans/:planId/toggle', async (req, res) => {
    const plan = await prisma.studyPlan.findUnique({ where: { id: req.params.planId } });
    if (!plan) return sendError(res, 'Plan not found.', 404);
    const planData = plan.plan;
    const day = planData.days && planData.days[Number(req.body.day_index)];
    const task = day && day.tasks[Number(req.body.task_index)];
    if (!task) return sendError(res, 'Task not found.', 404);
    task.done = !task.done;
    await prisma.studyPlan.update({ where: { id: plan.id }, data: { plan: planData } });
    io.emit('study-plans:update', { planId: plan.id });
    res.json({ ok: true });
  });

  router.delete('/ai/study-plans/:planId', async (req, res) => {
    await prisma.studyPlan.deleteMany({ where: { id: req.params.planId } });
    io.emit('study-plans:update', { planId: req.params.planId });
    res.json({ ok: true });
  });

  return router;
}

module.exports = { createAiRouter };
