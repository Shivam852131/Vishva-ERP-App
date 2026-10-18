const express = require('express');
const { getDB, oid } = require('../db');
const { sendError } = require('../utils');
const { collegeFilter } = require('../auth');

function createReportsRouter() {
  const router = express.Router();

  // Generate Official PDF Marksheet / Transcript Data
  router.get('/reports/transcript', async (req, res) => {
    try {
      const db = getDB();
      const studentId = oid(req.user._id);
      const cf = collegeFilter(req);

      const user = await db.collection('users').findOne({ _id: studentId, ...cf });
      if (!user) return sendError(res, 'Student record not found.', 404);

      const college = await db.collection('colleges').findOne({ _id: oid(req.userCollegeId) });
      const results = await db.collection('exam_results').find({ studentId, ...cf }).toArray();

      const totalMarks = results.reduce((sum, r) => sum + Number(r.marks || r.score || 0), 0);
      const maxMarks = results.length * 100;
      const percentage = results.length ? ((totalMarks / maxMarks) * 100).toFixed(1) : 'N/A';
      const cgpa = results.length ? (Number(percentage) / 9.5).toFixed(2) : '0.00';

      const transcript = {
        institution: college ? college.name : 'Vishva ERP University',
        institutionCode: college ? college.code : 'VERP-01',
        student: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          rollNumber: user.rollNumber || user.studentId || 'N/A',
          department: user.department || 'Computer Science & Engineering',
          semester: user.semester || '5th Semester',
          academicYear: '2025-2026',
        },
        summary: {
          totalSubjects: results.length,
          totalMarksObtained: totalMarks,
          maximumPossibleMarks: maxMarks,
          percentage: `${percentage}%`,
          cgpa,
          grade: Number(cgpa) >= 8.0 ? 'A+' : Number(cgpa) >= 6.5 ? 'A' : 'B',
          status: Number(percentage) >= 40 ? 'PASSED' : 'REQUIRES RE-EVALUATION',
          issueDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        },
        results: results.map((r, i) => ({
          sno: i + 1,
          subjectCode: r.courseCode || `CS${101 + i}`,
          subjectName: r.courseName || r.subject || `Academic Module ${i + 1}`,
          credits: r.credits || 4,
          maxMarks: 100,
          marksObtained: Number(r.marks || r.score || 0),
          grade: Number(r.marks || 0) >= 90 ? 'O' : Number(r.marks || 0) >= 80 ? 'A+' : Number(r.marks || 0) >= 70 ? 'A' : 'B',
        })),
      };

      res.json(transcript);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  return router;
}

module.exports = { createReportsRouter };
