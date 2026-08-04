const express = require('express');
const { getDB, oid } = require('../db');
const { serializeUser, sendError, makeCode, nowIso } = require('../utils');
const { collegeFilter, requireCollegeAccess } = require('../auth');

const router = express.Router();

router.get('/books', requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const { department, search } = req.query;
    const filter = { ...collegeFilter(req) };

    if (department) filter.department = department;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
      ];
    }

    const books = await db.collection('books')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    res.json(books);
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/my-issues', requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const userId = req.user._id;
    const { active } = req.query;

    const filter = { ...collegeFilter(req), userId: oid(userId) };
    if (active === 'true') filter.status = 'issued';

    const issues = await db.collection('book_issues')
      .find(filter)
      .sort({ issueDate: -1 })
      .toArray();

    const bookIds = [...new Set(issues.map(i => i.bookId).filter(Boolean))];
    const books = await db.collection('books')
      .find({ _id: { $in: bookIds }, ...collegeFilter(req) })
      .toArray();

    const bookMap = {};
    books.forEach(b => { bookMap[b._id.toString()] = b; });

    const result = issues.map(i => ({
      ...i,
      book: bookMap[i.bookId.toString()] || null,
    }));

    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/issue', requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const { bookId, userId, dueDate } = req.body;
    const targetUserId = oid(userId) || oid(req.user._id);

    const book = await db.collection('books').findOne({ _id: oid(bookId), ...collegeFilter(req) });
    if (!book) return sendError(res, 'Book not found', 404);
    if (book.available <= 0) return sendError(res, 'Book not available', 400);

    const existingIssue = await db.collection('book_issues').findOne({
      bookId: oid(bookId),
      userId: targetUserId,
      status: 'issued',
      ...collegeFilter(req),
    });
    if (existingIssue) return sendError(res, 'You already have this book issued.', 409);

    await db.collection('books').updateOne(
      { _id: oid(bookId), ...collegeFilter(req) },
      { $inc: { available: -1 } }
    );

    const issue = {
      collegeId: oid(req.userCollegeId),
      bookId: oid(bookId),
      userId: targetUserId,
      issueDate: nowIso(),
      dueDate,
      returnDate: null,
      fine: 0,
      status: 'issued',
    };

    const { insertedId } = await db.collection('book_issues').insertOne(issue);

    res.status(201).json({ ...issue, _id: insertedId });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/return/:issueId', requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const { issueId } = req.params;

    const issue = await db.collection('book_issues').findOne({ _id: oid(issueId), ...collegeFilter(req) });
    if (!issue) return sendError(res, 'Issue not found', 404);
    const isStaff = ['college_admin', 'super_admin', 'faculty', 'collegeAdmin', 'superadmin'].includes(req.user.role);
    if (!isStaff && String(issue.userId) !== String(req.user._id)) return sendError(res, 'Issue not found', 404);
    if (issue.status === 'returned') return sendError(res, 'Already returned', 400);

    const returnDate = nowIso();
    let fine = 0;

    if (issue.dueDate) {
      const due = new Date(issue.dueDate);
      const ret = new Date(returnDate);
      const diffDays = Math.floor((ret - due) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) fine = diffDays * 10;
    }

    await db.collection('book_issues').updateOne(
      { _id: oid(issueId), ...collegeFilter(req) },
      { $set: { returnDate, fine, status: 'returned' } }
    );

    await db.collection('books').updateOne(
      { _id: issue.bookId, ...collegeFilter(req) },
      { $inc: { available: 1 } }
    );

    res.json({ message: 'Book returned', fine });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
