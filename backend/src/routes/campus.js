const { getDB, oid } = require('../db');
const { serializeUser, sendError, makeCode, nowIso, isoDate, paginationParams, sendPaginated } = require('../utils');

function createCampusRouter(io) {
  const { Router } = require('express');
  const router = Router();

  router.get('/hostels', async (req, res) => {
    try {
      const db = getDB();
      const hostels = await db.collection('hostels').find({}).toArray();
      res.json(hostels);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/hostels/:id/allocate', async (req, res) => {
    try {
      const db = getDB();
      const { room, bed } = req.body;
      const hostel = await db.collection('hostels').findOne({ _id: oid(req.params.id) });
      if (!hostel) return sendError(res, 'Hostel not found', 404);

      const existing = await db.collection('hostel_allocations').findOne({
        hostelId: oid(req.params.id),
        studentId: oid(req.user._id),
        status: 'active',
      });
      if (existing) return sendError(res, 'Already allocated', 400);

      const allocation = {
        hostelId: oid(req.params.id),
        studentId: oid(req.user._id),
        room,
        bed,
        startDate: isoDate(new Date()),
        status: 'active',
      };
      const result = await db.collection('hostel_allocations').insertOne(allocation);
      allocation._id = result.insertedId;

      await db.collection('hostels').updateOne(
        { _id: oid(req.params.id) },
        { $inc: { occupied: 1 } }
      );

      res.json(allocation);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.get('/transport/routes', async (req, res) => {
    try {
      const db = getDB();
      const routes = await db.collection('transport_routes').find({}).toArray();
      res.json(routes);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/transport/enroll', async (req, res) => {
    try {
      const db = getDB();
      const { routeId } = req.body;

      const route = await db.collection('transport_routes').findOne({ _id: oid(routeId) });
      if (!route) return sendError(res, 'Route not found', 404);

      const existing = await db.collection('transport_enrollments').findOne({
        routeId: oid(routeId),
        studentId: oid(req.user._id),
        status: 'active',
      });
      if (existing) return sendError(res, 'Already enrolled', 400);

      const enrollment = {
        routeId: oid(routeId),
        studentId: oid(req.user._id),
        startDate: isoDate(new Date()),
        status: 'active',
      };
      const result = await db.collection('transport_enrollments').insertOne(enrollment);
      enrollment._id = result.insertedId;

      res.json(enrollment);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/transport/deenroll/:routeId', async (req, res) => {
    try {
      const db = getDB();
      const result = await db.collection('transport_enrollments').updateOne(
        {
          routeId: oid(req.params.routeId),
          studentId: oid(req.user._id),
          status: 'active',
        },
        { $set: { status: 'inactive' } }
      );
      if (result.matchedCount === 0) return sendError(res, 'Enrollment not found', 404);
      res.json({ success: true });
    } catch (e) {
      sendError(res, e);
    }
  });

  router.get('/grievances', async (req, res) => {
    try {
      const db = getDB();
      let filter = {};
      if (req.user.role === 'student') {
        filter.userId = oid(req.user._id);
      }
      const grievances = await db.collection('grievances')
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray();
      res.json(grievances);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/grievances', async (req, res) => {
    try {
      const db = getDB();
      const { category, subject, description, priority, anonymous } = req.body;

      const grievance = {
        userId: oid(req.user._id),
        category,
        subject,
        description,
        status: 'open',
        priority: priority || 'medium',
        responses: [],
        createdAt: nowIso(),
      };

      if (anonymous) {
        delete grievance.userId;
      }

      const result = await db.collection('grievances').insertOne(grievance);
      grievance._id = result.insertedId;

      res.json(grievance);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/grievances/:id/respond', async (req, res) => {
    try {
      const db = getDB();
      const { text } = req.body;

      const response = {
        userId: oid(req.user._id),
        text,
        createdAt: nowIso(),
      };

      const result = await db.collection('grievances').updateOne(
        { _id: oid(req.params.id) },
        {
          $push: { responses: response },
          $set: { status: 'in_progress' },
        }
      );

      if (result.matchedCount === 0) return sendError(res, 'Grievance not found', 404);

      const updated = await db.collection('grievances').findOne({ _id: oid(req.params.id) });
      res.json(updated);
    } catch (e) {
      sendError(res, e);
    }
  });

  return router;
}

module.exports = { createCampusRouter };
