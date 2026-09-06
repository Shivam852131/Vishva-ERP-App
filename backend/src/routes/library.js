const express = require('express');
const { getDB, oid } = require('../db');
const { serializeUser, sendError, makeCode, nowIso } = require('../utils');
const { collegeFilter, requireCollegeAccess, requireRole } = require('../auth');

const router = express.Router();

// ── GET /library/stats ──────────────────────────────────────────────
router.get('/stats', requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const collegeQ = collegeFilter(req);

    const books = await db.collection('books').find(collegeQ).toArray();
    const totalTitles = books.length;
    const totalCopies = books.reduce((s, b) => s + (Number(b.total) || Number(b.available) || 1), 0);
    const availableCopies = books.reduce((s, b) => s + (Number(b.available) || 0), 0);

    const activeIssues = await db.collection('book_issues').find({
      ...collegeQ,
      status: 'issued',
    }).toArray();

    const issuedCount = activeIssues.length;
    const now = new Date();
    const overdueCount = activeIssues.filter(i => i.dueDate && new Date(i.dueDate) < now).length;

    const allIssues = await db.collection('book_issues').find(collegeQ).toArray();
    const totalFines = allIssues.reduce((s, i) => s + (Number(i.fine) || 0), 0);

    res.json({
      total_titles: totalTitles,
      total_copies: totalCopies,
      available_copies: availableCopies,
      issued_count: issuedCount,
      overdue_count: overdueCount,
      total_fines: totalFines,
    });
  } catch (err) {
    sendError(res, err);
  }
});

// ── GET /library/books ──────────────────────────────────────────────
router.get('/books', requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const { department, search } = req.query;
    const filter = { ...collegeFilter(req) };

    if (department && department !== 'All') filter.department = department;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
        { isbn: { $regex: search, $options: 'i' } },
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

// ── GET /library/all-issues (Admin & Faculty) ──────────────────────
router.get('/all-issues', requireRole('college_admin', 'super_admin', 'faculty'), requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const { status, overdue } = req.query;
    const filter = { ...collegeFilter(req) };

    if (status) filter.status = status;

    const issues = await db.collection('book_issues')
      .find(filter)
      .sort({ issueDate: -1 })
      .toArray();

    const bookIds = [...new Set(issues.map(i => i.bookId).filter(Boolean))];
    const userIds = [...new Set(issues.map(i => i.userId).filter(Boolean))];

    const [books, users] = await Promise.all([
      bookIds.length ? db.collection('books').find({ _id: { $in: bookIds }, ...collegeFilter(req) }).toArray() : [],
      userIds.length ? db.collection('users').find({ _id: { $in: userIds }, ...collegeFilter(req) }).toArray() : [],
    ]);

    const bookMap = {};
    books.forEach(b => { bookMap[b._id.toString()] = b; });
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });

    const now = new Date();
    let result = issues.map(i => {
      const book = bookMap[i.bookId?.toString()] || null;
      const user = userMap[i.userId?.toString()] || null;
      const isOverdue = i.status === 'issued' && i.dueDate && new Date(i.dueDate) < now;
      return {
        ...i,
        book,
        user: user ? { id: String(user._id), name: user.name, email: user.email, student_id: user.student_id } : null,
        isOverdue,
      };
    });

    if (overdue === 'true') {
      result = result.filter(i => i.isOverdue);
    }

    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
});

// ── GET /library/my-issues (Student, Faculty & Parent) ─────────────
router.get('/my-issues', requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    let targetUserId = req.user._id;

    // If role is parent, find linked ward student ID
    if (req.user.role === 'parent') {
      const student = await db.collection('users').findOne({
        $or: [
          { parent_id: oid(req.user._id) },
          { parentId: oid(req.user._id) },
          { parent_email: req.user.email },
          { student_id: req.user.student_id || '' },
        ],
        ...collegeFilter(req),
      });
      if (student) {
        targetUserId = student._id;
      }
    }

    const { active } = req.query;
    const filter = { ...collegeFilter(req), userId: oid(targetUserId) };
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

// ── POST /library/books (Admin create book) ─────────────────────────
router.post('/books', requireRole('college_admin', 'super_admin'), requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const { title, author, department, isbn, shelf, available, total, cover } = req.body;

    if (!title || !title.trim()) return sendError(res, 'Book title is required', 400);
    if (!author || !author.trim()) return sendError(res, 'Author is required', 400);

    const bookCopies = Number(total) || Number(available) || 1;
    const bookDoc = {
      collegeId: oid(req.userCollegeId),
      title: title.trim(),
      author: author.trim(),
      department: department || 'General',
      isbn: (isbn || '').trim(),
      shelf: (shelf || 'Main Stacks').trim(),
      available: Number(available) >= 0 ? Number(available) : bookCopies,
      total: bookCopies,
      cover: cover || '',
      createdAt: nowIso(),
    };

    const { insertedId } = await db.collection('books').insertOne(bookDoc);
    res.status(201).json({ ...bookDoc, _id: insertedId });
  } catch (err) {
    sendError(res, err);
  }
});

// ── PUT /library/books/:id (Admin update book) ──────────────────────
router.put('/books/:id', requireRole('college_admin', 'super_admin'), requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const { title, author, department, isbn, shelf, available, total, cover } = req.body;

    const update = {};
    if (title !== undefined) update.title = title.trim();
    if (author !== undefined) update.author = author.trim();
    if (department !== undefined) update.department = department;
    if (isbn !== undefined) update.isbn = isbn.trim();
    if (shelf !== undefined) update.shelf = shelf.trim();
    if (available !== undefined) update.available = Number(available);
    if (total !== undefined) update.total = Number(total);
    if (cover !== undefined) update.cover = cover;
    update.updatedAt = nowIso();

    const result = await db.collection('books').updateOne(
      { _id: oid(req.params.id), ...collegeFilter(req) },
      { $set: update }
    );

    if (result.matchedCount === 0) return sendError(res, 'Book not found', 404);

    const updated = await db.collection('books').findOne({ _id: oid(req.params.id) });
    res.json(updated);
  } catch (err) {
    sendError(res, err);
  }
});

// ── DELETE /library/books/:id (Admin delete book) ───────────────────
router.delete('/books/:id', requireRole('college_admin', 'super_admin'), requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const activeCount = await db.collection('book_issues').countDocuments({
      bookId: oid(req.params.id),
      status: 'issued',
      ...collegeFilter(req),
    });

    if (activeCount > 0) {
      return sendError(res, 'Cannot delete book with active issued copies.', 400);
    }

    const result = await db.collection('books').deleteOne({
      _id: oid(req.params.id),
      ...collegeFilter(req),
    });

    if (result.deletedCount === 0) return sendError(res, 'Book not found', 404);

    res.json({ message: 'Book deleted successfully' });
  } catch (err) {
    sendError(res, err);
  }
});

// ── POST /library/issue (Student self-reserve) ──────────────────────
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

    // Default 14 days due date if none provided
    const due = dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const issue = {
      collegeId: oid(req.userCollegeId),
      bookId: oid(bookId),
      userId: targetUserId,
      issueDate: nowIso(),
      dueDate: due,
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

// ── POST /library/admin-issue (Admin / Staff Issue Desk) ───────────
router.post('/admin-issue', requireRole('college_admin', 'super_admin', 'faculty'), requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const { bookId, student_id, studentId, userId, dueDate } = req.body;

    const identifier = student_id || studentId || userId;
    if (!bookId || !identifier) {
      return sendError(res, 'Book ID and Student identifier are required', 400);
    }

    let targetUser = await db.collection('users').findOne({
      $or: [
        { _id: oid(identifier) },
        { student_id: identifier },
        { email: identifier },
      ],
      ...collegeFilter(req),
    });

    if (!targetUser) return sendError(res, 'Student not found', 404);

    const book = await db.collection('books').findOne({ _id: oid(bookId), ...collegeFilter(req) });
    if (!book) return sendError(res, 'Book not found', 404);
    if (book.available <= 0) return sendError(res, 'No copies currently available', 400);

    const existingIssue = await db.collection('book_issues').findOne({
      bookId: oid(bookId),
      userId: targetUser._id,
      status: 'issued',
      ...collegeFilter(req),
    });
    if (existingIssue) return sendError(res, 'Student already has this book issued', 409);

    await db.collection('books').updateOne(
      { _id: oid(bookId), ...collegeFilter(req) },
      { $inc: { available: -1 } }
    );

    const due = dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const issue = {
      collegeId: oid(req.userCollegeId),
      bookId: oid(bookId),
      userId: targetUser._id,
      issueDate: nowIso(),
      dueDate: due,
      returnDate: null,
      fine: 0,
      status: 'issued',
    };

    const { insertedId } = await db.collection('book_issues').insertOne(issue);

    res.status(201).json({ ...issue, _id: insertedId, student_name: targetUser.name });
  } catch (err) {
    sendError(res, err);
  }
});

// ── POST /library/return/:issueId (Return Processing) ───────────────
router.post('/return/:issueId', requireCollegeAccess, async (req, res) => {
  try {
    const db = getDB();
    const { issueId } = req.params;

    const issue = await db.collection('book_issues').findOne({ _id: oid(issueId), ...collegeFilter(req) });
    if (!issue) return sendError(res, 'Issue record not found', 404);

    const isStaff = ['college_admin', 'super_admin', 'faculty', 'collegeAdmin', 'superadmin'].includes(req.user.role);
    if (!isStaff && String(issue.userId) !== String(req.user._id)) {
      return sendError(res, 'Unauthorized to return this book', 403);
    }
    if (issue.status === 'returned') return sendError(res, 'Book has already been returned', 400);

    const returnDate = nowIso();
    let fine = 0;

    if (issue.dueDate) {
      const due = new Date(issue.dueDate);
      const ret = new Date(returnDate);
      const diffDays = Math.floor((ret - due) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) fine = diffDays * 10; // ₹10 per day overdue
    }

    // Optional fine waiver for staff
    if (req.body.waiveFine && isStaff) {
      fine = 0;
    }

    await db.collection('book_issues').updateOne(
      { _id: oid(issueId), ...collegeFilter(req) },
      { $set: { returnDate, fine, status: 'returned' } }
    );

    await db.collection('books').updateOne(
      { _id: issue.bookId, ...collegeFilter(req) },
      { $inc: { available: 1 } }
    );

    res.json({ message: 'Book returned successfully', fine, returnDate });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
