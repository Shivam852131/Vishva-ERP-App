const express = require('express');
const { prisma } = require('../db');
const { authUser } = require('../auth');

const router = express.Router();

router.get('/library/books', async (_req, res) => {
  const books = await prisma.book.findMany();
  res.json(books.map(book => ({
    id: book.id,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    category: book.category,
    total_copies: book.totalCopies,
    shelf_location: book.shelfLocation,
  })));
});

router.get('/library/issues', async (req, res) => {
  const user = await authUser(req);
  const activeOnly = String(req.query.active_only || '') === 'true';
  const issues = await prisma.bookIssue.findMany({
    where: { studentId: user.id, ...(activeOnly ? { returnedAt: null } : {}) },
    include: { book: true },
  });
  res.json(issues.map(issue => ({
    id: issue.id,
    book_id: issue.bookId,
    book_title: issue.book.title,
    student_id: issue.studentId,
    student_name: user.name,
    issued_at: issue.issuedAt.toISOString(),
    due_date: issue.dueDate.toISOString(),
    returned_at: issue.returnedAt ? issue.returnedAt.toISOString() : undefined,
    fine: issue.fine,
  })));
});

module.exports = router;
