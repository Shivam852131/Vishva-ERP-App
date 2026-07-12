const express = require('express');
const { prisma } = require('../db');
const { sendError } = require('../utils');

const router = express.Router();

function serializeCollege(college) {
  return {
    id: college.id,
    name: college.name,
    code: college.code,
    students: college.students,
    faculty: college.faculty,
    admins: college.admins,
    address: college.address,
    contact_email: college.contactEmail,
  };
}

router.get('/colleges', async (_req, res) => {
  const colleges = await prisma.college.findMany();
  res.json(colleges.map(serializeCollege));
});

router.post('/colleges', async (req, res) => {
  const college = await prisma.college.create({
    data: {
      name: req.body.name,
      code: req.body.code,
      students: 0,
      faculty: 0,
      admins: 0,
      address: req.body.address || '',
      contactEmail: req.body.contact_email || '',
    },
  });
  res.json(serializeCollege(college));
});

router.put('/colleges/:id', async (req, res) => {
  const college = await prisma.college.findUnique({ where: { id: req.params.id } });
  if (!college) return sendError(res, 'College not found.', 404);
  const updated = await prisma.college.update({
    where: { id: college.id },
    data: {
      name: req.body.name || college.name,
      code: req.body.code || college.code,
      address: req.body.address || college.address,
      contactEmail: req.body.contact_email || college.contactEmail,
    },
  });
  res.json(serializeCollege(updated));
});

router.delete('/colleges/:id', async (req, res) => {
  const college = await prisma.college.findUnique({ where: { id: req.params.id } });
  if (!college) return sendError(res, 'College not found.', 404);
  await prisma.college.delete({ where: { id: college.id } });
  res.json({ ok: true });
});

module.exports = router;
