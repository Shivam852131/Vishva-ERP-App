const express = require('express');
const { prisma } = require('../db');
const { authUser, requireRole } = require('../auth');
const { sendError, paginationParams, sendPaginated } = require('../utils');

const router = express.Router();

function serializeCourse(course) {
  return {
    id: course.id,
    code: course.code,
    name: course.name,
    faculty_id: course.facultyId || undefined,
    faculty_name: course.faculty ? course.faculty.name : undefined,
    credits: course.credits,
    color: course.color,
  };
}

function serializeTimetableSlot(slot) {
  return {
    id: slot.id,
    day: slot.day,
    start: slot.start,
    end: slot.end,
    course_id: slot.courseId,
    course_name: slot.course.name,
    course_code: slot.course.code,
    faculty_name: slot.course.faculty ? slot.course.faculty.name : undefined,
    room: slot.room,
  };
}

function serializeAssignment(assignment) {
  return {
    id: assignment.id,
    course_id: assignment.courseId,
    course_name: assignment.course.name,
    title: assignment.title,
    description: assignment.description,
    due_date: assignment.dueDate.toISOString(),
    max_marks: assignment.maxMarks,
    created_at: assignment.createdAt.toISOString(),
    submitted: assignment.submissions.length > 0,
    submission: assignment.submissions[0]
      ? {
          id: assignment.submissions[0].id,
          assignment_id: assignment.submissions[0].assignmentId,
          student_id: assignment.submissions[0].studentId,
          content: assignment.submissions[0].content,
          submitted_at: assignment.submissions[0].submittedAt.toISOString(),
          status: assignment.submissions[0].status,
        }
      : null,
  };
}

function serializeNote(note) {
  return {
    id: note.id,
    course_id: note.courseId || undefined,
    course_name: note.course ? note.course.name : note.subject,
    subject: note.subject,
    class_name: note.className,
    title: note.title,
    type: note.type,
    url: note.url,
    uploaded_by: note.uploadedBy,
    created_at: note.createdAt.toISOString(),
    description: note.description,
    downloads: note.downloads,
    helpful_count: note.helpfulCount,
  };
}

router.get('/courses', async (_req, res) => {
  const courses = await prisma.course.findMany({ include: { faculty: true } });
  res.json(courses.map(serializeCourse));
});

router.post('/admin/courses', requireRole('college_admin', 'super_admin'), async (req, res) => {
  const faculty = req.body.faculty_id ? await prisma.user.findUnique({ where: { id: req.body.faculty_id } }) : null;
  const course = await prisma.course.create({
    data: {
      code: req.body.code,
      name: req.body.name,
      credits: Number(req.body.credits || 3),
      facultyId: faculty ? faculty.id : null,
      color: '#059669',
    },
    include: { faculty: true },
  });
  res.json(serializeCourse(course));
});

router.put('/admin/courses/:id', requireRole('college_admin', 'super_admin'), async (req, res) => {
  const course = await prisma.course.findUnique({ where: { id: req.params.id } });
  if (!course) return sendError(res, 'Course not found.', 404);
  const faculty = req.body.faculty_id ? await prisma.user.findUnique({ where: { id: req.body.faculty_id } }) : null;
  const updated = await prisma.course.update({
    where: { id: course.id },
    data: {
      code: req.body.code || course.code,
      name: req.body.name || course.name,
      credits: Number(req.body.credits || course.credits || 3),
      facultyId: faculty ? faculty.id : course.facultyId,
    },
    include: { faculty: true },
  });
  res.json(serializeCourse(updated));
});

router.delete('/admin/courses/:id', requireRole('college_admin', 'super_admin'), async (req, res) => {
  const course = await prisma.course.findUnique({ where: { id: req.params.id } });
  if (!course) return sendError(res, 'Course not found.', 404);
  await prisma.course.delete({ where: { id: course.id } });
  res.json({ ok: true });
});

router.get('/timetable', async (_req, res) => {
  const slots = await prisma.timetableSlot.findMany({ include: { course: { include: { faculty: true } } } });
  res.json(slots.map(serializeTimetableSlot));
});

router.post('/admin/timetable', requireRole('college_admin', 'super_admin'), async (req, res) => {
  const course = await prisma.course.findUnique({ where: { id: req.body.course_id }, include: { faculty: true } });
  if (!course) return sendError(res, 'Course not found.', 404);
  const slot = await prisma.timetableSlot.create({
    data: {
      day: req.body.day || 'Mon',
      start: req.body.start || '09:00',
      end: req.body.end || '10:00',
      courseId: course.id,
      room: req.body.room || 'TBD',
    },
    include: { course: { include: { faculty: true } } },
  });
  res.json(serializeTimetableSlot(slot));
});

router.delete('/admin/timetable/:id', requireRole('college_admin', 'super_admin'), async (req, res) => {
  const slot = await prisma.timetableSlot.findUnique({ where: { id: req.params.id } });
  if (!slot) return sendError(res, 'Timetable slot not found.', 404);
  await prisma.timetableSlot.delete({ where: { id: slot.id } });
  res.json({ ok: true });
});

router.get('/assignments', async (_req, res) => {
  const assignments = await prisma.assignment.findMany({ include: { course: true, submissions: true } });
  res.json(assignments.map(serializeAssignment));
});

router.post('/assignments', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
  const course = await prisma.course.findUnique({ where: { id: req.body.course_id } });
  if (!course) return sendError(res, 'Course not found.', 404);
  const assignment = await prisma.assignment.create({
    data: {
      courseId: course.id,
      title: req.body.title,
      description: req.body.description || '',
      dueDate: new Date(req.body.due_date || Date.now() + 7 * 86400000),
      maxMarks: Number(req.body.max_marks || 20),
    },
    include: { course: true, submissions: true },
  });
  res.json(serializeAssignment(assignment));
});

router.post('/assignments/submit', requireRole('student'), async (req, res) => {
  const user = await authUser(req);
  const assignment = await prisma.assignment.findUnique({ where: { id: req.body.assignment_id } });
  if (!assignment) return sendError(res, 'Assignment not found.', 404);
  const submission = await prisma.submission.upsert({
    where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: user.id } },
    create: { assignmentId: assignment.id, studentId: user.id, content: req.body.content || '', status: 'submitted' },
    update: { content: req.body.content || '', status: 'submitted', submittedAt: new Date() },
  });
  res.json({
    ok: true,
    submission: {
      id: submission.id,
      assignment_id: submission.assignmentId,
      student_id: submission.studentId,
      content: submission.content,
      submitted_at: submission.submittedAt.toISOString(),
      status: submission.status,
    },
  });
});

router.get('/notes', async (_req, res) => {
  const notes = await prisma.note.findMany({ include: { course: true } });
  res.json(notes.map(serializeNote));
});

router.post('/notes', async (req, res) => {
  const user = await authUser(req);
  const subject = req.body.subject || req.body.course_name || 'General';
  const note = await prisma.note.create({
    data: {
      subject,
      className: req.body.class_name || 'All Classes',
      title: req.body.title || 'Shared note',
      type: req.body.type || 'notes',
      url: req.body.url || '',
      uploadedBy: user.name,
      description: req.body.description || '',
    },
    include: { course: true },
  });
  res.json(serializeNote(note));
});

router.get('/results/me', requireRole('student'), async (req, res) => {
  const user = await authUser(req);
  const results = await prisma.examResult.findMany({ where: { studentId: user.id }, include: { course: true } });
  res.json(results.map(result => ({
    id: result.id,
    course_id: result.courseId,
    course_name: result.course.name,
    course_code: result.course.code,
    marks: result.marks,
    max_marks: result.maxMarks,
    grade: result.grade,
    semester: result.semester,
  })));
});

router.get('/events', async (_req, res) => {
  const events = await prisma.event.findMany();
  res.json(events.map(event => ({
    id: event.id,
    title: event.title,
    date: event.date.toISOString(),
    venue: event.venue,
    description: event.description,
  })));
});

router.get('/exams', async (_req, res) => {
  const exams = await prisma.exam.findMany({ include: { course: true } });
  res.json(exams.map(exam => ({
    id: exam.id,
    course_id: exam.courseId,
    course_name: exam.course.name,
    course_code: exam.course.code,
    exam_type: exam.examType,
    date: exam.date.toISOString().slice(0, 10),
    start_time: exam.startTime,
    end_time: exam.endTime,
    venue: exam.venue,
    max_marks: exam.maxMarks,
  })));
});

router.get('/exams/my-hallticket', requireRole('student'), async (req, res) => {
  const user = await authUser(req);
  const exams = await prisma.exam.findMany({ include: { course: true } });
  res.json({
    student_name: user.name,
    exams: exams.map(exam => ({ exam_id: exam.id, course_name: exam.course.name, venue: exam.venue, date: exam.date.toISOString().slice(0, 10) })),
  });
});

router.get('/exams/generated', async (_req, res) => {
  const generated = await prisma.generatedExam.findMany({ include: { createdBy: true } });
  res.json(generated.map(exam => ({
    id: exam.id,
    title: exam.title,
    subject: exam.subject,
    total_questions: exam.totalQuestions,
    total_marks: exam.totalMarks,
    difficulty: exam.difficulty,
    created_at: exam.createdAt.toISOString(),
    created_by_name: exam.createdBy.name,
    instructions: exam.instructions,
  })));
});

router.post('/exams/generate', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
  const user = await authUser(req);
  const exam = await prisma.generatedExam.create({
    data: {
      title: req.body.title || `${req.body.subject || 'Subject'} Practice Paper`,
      subject: req.body.subject || 'General',
      totalQuestions: Number(req.body.total_questions || 20),
      totalMarks: Number(req.body.total_marks || 50),
      difficulty: req.body.difficulty || 'mixed',
      createdById: user.id,
      instructions: req.body.instructions || 'Answer all questions.',
    },
    include: { createdBy: true },
  });
  res.json({
    id: exam.id,
    title: exam.title,
    subject: exam.subject,
    total_questions: exam.totalQuestions,
    total_marks: exam.totalMarks,
    difficulty: exam.difficulty,
    created_at: exam.createdAt.toISOString(),
    created_by_name: exam.createdBy.name,
    instructions: exam.instructions,
  });
});

router.get('/question-bank/subjects', async (_req, res) => {
  const rows = await prisma.questionBankItem.findMany({ select: { subject: true }, distinct: ['subject'] });
  res.json(rows.map(row => row.subject));
});

router.get('/question-bank/stats', async (_req, res) => {
  const [total, subjects, easy, medium, hard] = await Promise.all([
    prisma.questionBankItem.count(),
    prisma.questionBankItem.findMany({ select: { subject: true }, distinct: ['subject'] }),
    prisma.questionBankItem.count({ where: { difficulty: 'easy' } }),
    prisma.questionBankItem.count({ where: { difficulty: 'medium' } }),
    prisma.questionBankItem.count({ where: { difficulty: 'hard' } }),
  ]);
  res.json({ total, subjects: subjects.map(row => row.subject), easy, medium, hard });
});

router.get('/question-bank', async (req, res) => {
  const { skip, take } = paginationParams(req.query);
  const [questions, total] = await Promise.all([
    prisma.questionBankItem.findMany({ skip, take }),
    prisma.questionBankItem.count(),
  ]);
  sendPaginated(res, questions.map(question => ({
    id: question.id,
    subject: question.subject,
    unit: question.unit,
    chapter: question.chapter,
    question_text: question.questionText,
    question_type: question.questionType,
    options: question.options,
    correct_answer: question.correctAnswer,
    difficulty: question.difficulty,
    marks: question.marks,
    image_url: question.imageUrl,
  })), total);
});

router.post('/question-bank', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
  const question = await prisma.questionBankItem.create({
    data: {
      subject: req.body.subject || 'General',
      unit: req.body.unit || 'Unit 1',
      chapter: req.body.chapter || 'Chapter 1',
      questionText: req.body.question_text || '',
      questionType: req.body.question_type || 'subjective',
      options: Array.isArray(req.body.options) ? req.body.options : [],
      correctAnswer: req.body.correct_answer || '',
      difficulty: req.body.difficulty || 'medium',
      marks: Number(req.body.marks || 1),
      imageUrl: req.body.image_base64 ? 'data:image/jpeg;base64,attached' : '',
    },
  });
  res.json({
    id: question.id,
    subject: question.subject,
    unit: question.unit,
    chapter: question.chapter,
    question_text: question.questionText,
    question_type: question.questionType,
    options: question.options,
    correct_answer: question.correctAnswer,
    difficulty: question.difficulty,
    marks: question.marks,
    image_url: question.imageUrl,
  });
});

router.delete('/question-bank/:id', requireRole('faculty', 'college_admin', 'super_admin'), async (req, res) => {
  const question = await prisma.questionBankItem.findUnique({ where: { id: req.params.id } });
  if (!question) return sendError(res, 'Question not found.', 404);
  await prisma.questionBankItem.delete({ where: { id: question.id } });
  res.json({ ok: true });
});

module.exports = router;
