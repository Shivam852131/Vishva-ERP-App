const { getDB, oid } = require('../db');
const { serializeUser, sendError, makeCode, nowIso, isoDate, paginationParams, sendPaginated } = require('../utils');
const { requireRole, collegeFilter, requireCollegeAccess } = require('../auth');

function serializeAsset(asset) {
  return {
    id: String(asset._id),
    name: asset.name || '',
    category: asset.category || 'Other',
    location: asset.location || '',
    status: asset.status || 'active',
    assignee: asset.assignee || asset.assignedTo || '',
    condition: asset.condition || 'good',
    lastMaint: asset.lastMaint || asset.lastMaintenance || asset.updatedAt || '',
  };
}

function serializeMaintenance(item, assetMap = new Map()) {
  const asset = item.assetId ? assetMap.get(String(item.assetId)) : null;
  return {
    id: String(item._id),
    asset: item.asset || asset?.name || '',
    issue: item.issue || item.description || '',
    status: item.status || 'pending',
    date: item.date || item.createdAt || '',
    technician: item.technician || item.assignedTo || '',
  };
}

function serializeGrievance(item) {
  return {
    id: String(item._id),
    ticketId: item.ticketId || `GR-${String(item._id).slice(-6).toUpperCase()}`,
    title: item.title || item.subject || '',
    subject: item.subject || item.title || '',
    category: item.category || 'other',
    priority: item.priority || 'medium',
    description: item.description || '',
    status: item.status === 'open' ? 'pending' : (item.status || 'pending'),
    date: item.createdAt || '',
    updates: item.responses || [],
  };
}

function serializeVisitor(visitor) {
  return {
    id: String(visitor._id),
    name: visitor.name || '',
    purpose: visitor.purpose || '',
    type: visitor.type || 'guest',
    who: visitor.who || visitor.meetingWith || '',
    phone: visitor.phone || '',
    status: visitor.status || 'pending_approval',
    inTime: visitor.inTime || visitor.checkedInAt || '',
    outTime: visitor.outTime || visitor.checkedOutAt || '',
    expectedTime: visitor.expectedTime || visitor.expectedAt || '',
  };
}

function createCampusRouter(io) {
  const { Router } = require('express');
  const router = Router();

  // ── Hostel CRUD (admin) ──────────────────────────────

  router.get('/hostels', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const hostels = await db.collection('hostels').find({ ...collegeFilter(req) }).toArray();
      const mapped = hostels.map(h => ({
        id: String(h._id),
        name: h.name || '',
        type: h.type || '',
        total_rooms: h.total_rooms || 0,
        occupied: h.occupied || 0,
        warden_name: h.warden_name || '',
        contact: h.contact || '',
        amenities: h.amenities || [],
        description: h.description || '',
        created_at: h.createdAt || '',
      }));
      res.json(mapped);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.get('/hostels/:id', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const hostel = await db.collection('hostels').findOne({ _id: oid(req.params.id), ...collegeFilter(req) });
      if (!hostel) return sendError(res, 'Hostel not found', 404);
      res.json({
        id: String(hostel._id),
        name: hostel.name || '',
        type: hostel.type || '',
        total_rooms: hostel.total_rooms || 0,
        occupied: hostel.occupied || 0,
        warden_name: hostel.warden_name || '',
        contact: hostel.contact || '',
        amenities: hostel.amenities || [],
        description: hostel.description || '',
        created_at: hostel.createdAt || '',
      });
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/hostels', requireRole('college_admin', 'super_admin'), requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const { name, type, total_rooms, warden_name, contact, amenities, description } = req.body;
      if (!name) return sendError(res, 'Hostel name is required.');

      const doc = {
        collegeId: oid(req.userCollegeId),
        name,
        type: type || 'Boys',
        total_rooms: Number(total_rooms || 0),
        occupied: 0,
        warden_name: warden_name || '',
        contact: contact || '',
        amenities: Array.isArray(amenities) ? amenities : [],
        description: description || '',
        createdAt: nowIso(),
      };

      const result = await db.collection('hostels').insertOne(doc);
      doc._id = result.insertedId;
      res.json({
        id: String(doc._id),
        name: doc.name,
        type: doc.type,
        total_rooms: doc.total_rooms,
        occupied: doc.occupied,
        warden_name: doc.warden_name,
        contact: doc.contact,
        amenities: doc.amenities,
        description: doc.description,
        created_at: doc.createdAt,
      });
    } catch (e) {
      sendError(res, e);
    }
  });

  router.put('/hostels/:id', requireRole('college_admin', 'super_admin'), requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const _id = oid(req.params.id);
      if (!_id) return sendError(res, 'Invalid hostel id.', 404);

      const existing = await db.collection('hostels').findOne({ _id, ...collegeFilter(req) });
      if (!existing) return sendError(res, 'Hostel not found.', 404);

      const update = {};
      if (req.body.name) update.name = req.body.name;
      if (req.body.type) update.type = req.body.type;
      if (req.body.total_rooms !== undefined) update.total_rooms = Number(req.body.total_rooms);
      if (req.body.warden_name !== undefined) update.warden_name = req.body.warden_name;
      if (req.body.contact !== undefined) update.contact = req.body.contact;
      if (req.body.amenities) update.amenities = req.body.amenities;
      if (req.body.description !== undefined) update.description = req.body.description;

      await db.collection('hostels').updateOne({ _id }, { $set: update });
      const updated = await db.collection('hostels').findOne({ _id });
      res.json({
        id: String(updated._id),
        name: updated.name || '',
        type: updated.type || '',
        total_rooms: updated.total_rooms || 0,
        occupied: updated.occupied || 0,
        warden_name: updated.warden_name || '',
        contact: updated.contact || '',
        amenities: updated.amenities || [],
        description: updated.description || '',
        created_at: updated.createdAt || '',
      });
    } catch (e) {
      sendError(res, e);
    }
  });

  router.delete('/hostels/:id', requireRole('college_admin', 'super_admin'), requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const _id = oid(req.params.id);
      if (!_id) return sendError(res, 'Invalid hostel id.', 404);

      const activeAllocations = await db.collection('hostel_allocations').countDocuments({
        hostelId: _id,
        status: 'active',
        ...collegeFilter(req),
      });
      if (activeAllocations > 0) return sendError(res, 'Cannot delete hostel with active allocations.');

      const result = await db.collection('hostels').deleteOne({ _id, ...collegeFilter(req) });
      if (!result.deletedCount) return sendError(res, 'Hostel not found.', 404);
      res.json({ ok: true });
    } catch (e) {
      sendError(res, e);
    }
  });

  // ── Allocations (admin) ──────────────────────────────

  router.get('/hostel/allocations', requireRole('college_admin', 'super_admin', 'student'), requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      let filter = { ...collegeFilter(req) };
      if (req.user.role === 'student') {
        filter = { ...filter, studentId: oid(req.user._id), status: 'active' };
      } else if (req.query.hostel_id) {
        filter = { ...filter, hostelId: oid(req.query.hostel_id) };
      }

      const allocations = await db.collection('hostel_allocations').find(filter).sort({ startDate: -1 }).toArray();

      const hostelIds = [...new Set(allocations.map(a => String(a.hostelId)))];
      const studentIds = [...new Set(allocations.map(a => String(a.studentId)))];

      const hostels = hostelIds.length ? await db.collection('hostels').find({ _id: { $in: hostelIds.map(id => oid(id)) } }).toArray() : [];
      const students = studentIds.length ? await db.collection('users').find({ _id: { $in: studentIds.map(id => oid(id)) } }).toArray() : [];

      const hostelMap = new Map();
      for (const h of hostels) hostelMap.set(String(h._id), h);
      const studentMap = new Map();
      for (const s of students) studentMap.set(String(s._id), s);

      res.json(allocations.map(a => ({
        id: String(a._id),
        hostel_id: String(a.hostelId),
        hostel_name: hostelMap.get(String(a.hostelId))?.name || '',
        room_number: a.room || '',
        student_id: String(a.studentId),
        student_name: studentMap.get(String(a.studentId))?.name || '',
        student_email: studentMap.get(String(a.studentId))?.email || '',
        allocated_at: a.startDate || '',
        active: a.status === 'active',
      })));
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/hostels/:id/allocate', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const { room, bed } = req.body;
      const hostel = await db.collection('hostels').findOne({ _id: oid(req.params.id), ...collegeFilter(req) });
      if (!hostel) return sendError(res, 'Hostel not found', 404);

      const existing = await db.collection('hostel_allocations').findOne({
        hostelId: oid(req.params.id),
        studentId: oid(req.user._id),
        status: 'active',
        ...collegeFilter(req),
      });
      if (existing) return sendError(res, 'Already allocated', 400);

      const allocation = {
        collegeId: oid(req.userCollegeId),
        hostelId: oid(req.params.id),
        studentId: oid(req.user._id),
        room: room || 'Auto-assigned',
        bed: bed || 'Auto-assigned',
        startDate: isoDate(new Date()),
        status: 'active',
      };
      const result = await db.collection('hostel_allocations').insertOne(allocation);
      allocation._id = result.insertedId;

      await db.collection('hostels').updateOne(
        { _id: oid(req.params.id) },
        { $inc: { occupied: 1 } }
      );

      if (io) io.emit('hostel:allocated', { hostel_id: req.params.id, student_id: String(req.user._id) });

      res.json(allocation);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/hostel/allocations/:id/deallocate', requireRole('college_admin', 'super_admin'), requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const _id = oid(req.params.id);
      if (!_id) return sendError(res, 'Invalid allocation id.', 404);

      const allocation = await db.collection('hostel_allocations').findOne({ _id, ...collegeFilter(req) });
      if (!allocation) return sendError(res, 'Allocation not found.', 404);
      if (allocation.status !== 'active') return sendError(res, 'Allocation is not active.');

      await db.collection('hostel_allocations').updateOne(
        { _id },
        { $set: { status: 'inactive', endDate: isoDate(new Date()) } }
      );

      await db.collection('hostels').updateOne(
        { _id: allocation.hostelId },
        { $inc: { occupied: -1 } }
      );

      if (io) io.emit('hostel:deallocated', { hostel_id: String(allocation.hostelId), student_id: String(allocation.studentId) });

      res.json({ ok: true });
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/hostel/allocations/admin-assign', requireRole('college_admin', 'super_admin'), requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const { hostel_id, student_id, room, bed } = req.body;
      if (!hostel_id || !student_id) return sendError(res, 'hostel_id and student_id are required.');

      const hostel = await db.collection('hostels').findOne({ _id: oid(hostel_id), ...collegeFilter(req) });
      if (!hostel) return sendError(res, 'Hostel not found.', 404);

      const existing = await db.collection('hostel_allocations').findOne({
        hostelId: oid(hostel_id),
        studentId: oid(student_id),
        status: 'active',
        ...collegeFilter(req),
      });
      if (existing) return sendError(res, 'Student already allocated to a hostel.', 400);

      const allocation = {
        collegeId: oid(req.userCollegeId),
        hostelId: oid(hostel_id),
        studentId: oid(student_id),
        room: room || 'Auto-assigned',
        bed: bed || 'Auto-assigned',
        startDate: isoDate(new Date()),
        status: 'active',
      };
      const result = await db.collection('hostel_allocations').insertOne(allocation);
      allocation._id = result.insertedId;

      await db.collection('hostels').updateOne(
        { _id: oid(hostel_id) },
        { $inc: { occupied: 1 } }
      );

      if (io) io.emit('hostel:allocated', { hostel_id, student_id });

      res.json({ ok: true, allocation_id: String(result.insertedId) });
    } catch (e) {
      sendError(res, e);
    }
  });

  router.get('/hostel/stats', requireRole('college_admin', 'super_admin'), requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const collegeQ = collegeFilter(req);
      const hostels = await db.collection('hostels').find(collegeQ).toArray();
      const totalRooms = hostels.reduce((s, h) => s + (h.total_rooms || 0), 0);
      const totalOccupied = hostels.reduce((s, h) => s + (h.occupied || 0), 0);
      const activeAllocations = await db.collection('hostel_allocations').countDocuments({ status: 'active', ...collegeQ });

      const boys = hostels.filter(h => h.type === 'Boys');
      const girls = hostels.filter(h => h.type === 'Girls');

      res.json({
        total_hostels: hostels.length,
        total_rooms: totalRooms,
        total_occupied: totalOccupied,
        occupancy_rate: totalRooms > 0 ? Math.round((totalOccupied / totalRooms) * 100) : 0,
        active_allocations: activeAllocations,
        boys_hostels: boys.length,
        girls_hostels: girls.length,
        boys_occupied: boys.reduce((s, h) => s + (h.occupied || 0), 0),
        girls_occupied: girls.reduce((s, h) => s + (h.occupied || 0), 0),
      });
    } catch (e) {
      sendError(res, e);
    }
  });

  router.get('/transport/routes', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const routes = await db.collection('transport_routes').find({ ...collegeFilter(req) }).toArray();
      const mapped = routes.map(r => ({
        id: String(r._id),
        route_name: r.route_name || '',
        vehicle_number: r.vehicle_number || '',
        driver_name: r.driver_name || '',
        driver_phone: r.driver_phone || '',
        stops: (r.stops || []).map(s => ({ name: s.name || '', time: s.time || '' })),
        active: r.active !== false,
      }));
      res.json(mapped);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.get('/transport/my-route', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const enrollment = await db.collection('transport_enrollments').findOne({
        studentId: oid(req.user._id),
        status: 'active',
        ...collegeFilter(req),
      });
      if (!enrollment) return res.json(null);

      const route = await db.collection('transport_routes').findOne({ _id: enrollment.routeId });
      res.json({
        id: String(enrollment._id),
        route_id: String(enrollment.routeId),
        route_name: route ? (route.route_name || route.name || '') : '',
        vehicle_number: route ? (route.vehicle_number || route.routeNumber || '') : '',
        driver_name: route ? (route.driver_name || '') : '',
        driver_phone: route ? (route.driver_phone || '') : '',
        stops: route ? (route.stops || []).map(s => ({ name: s.name || '', time: s.time || '' })) : [],
        student_id: String(enrollment.studentId),
        student_name: req.user.name || '',
        active: true,
        enrolled_at: enrollment.startDate,
      });
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/transport/enroll', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const { routeId } = req.body;

      const route = await db.collection('transport_routes').findOne({ _id: oid(routeId), ...collegeFilter(req) });
      if (!route) return sendError(res, 'Route not found', 404);

      const existing = await db.collection('transport_enrollments').findOne({
        routeId: oid(routeId),
        studentId: oid(req.user._id),
        status: 'active',
        ...collegeFilter(req),
      });
      if (existing) return sendError(res, 'Already enrolled', 400);

      const enrollment = {
        collegeId: oid(req.userCollegeId),
        routeId: oid(routeId),
        studentId: oid(req.user._id),
        startDate: isoDate(new Date()),
        status: 'active',
      };
      const result = await db.collection('transport_enrollments').insertOne(enrollment);
      enrollment._id = result.insertedId;

      if (io) io.emit('transport:enrolled', { route_id: String(routeId), student_id: String(req.user._id), student_name: req.user.name || '' });

      res.json(enrollment);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/transport/deenroll/:routeId', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const result = await db.collection('transport_enrollments').updateOne(
        {
          routeId: oid(req.params.routeId),
          studentId: oid(req.user._id),
          status: 'active',
          ...collegeFilter(req),
        },
        { $set: { status: 'inactive' } }
      );
      if (result.matchedCount === 0) return sendError(res, 'Enrollment not found', 404);

      if (io) io.emit('transport:deenrolled', { route_id: req.params.routeId, student_id: String(req.user._id) });

      res.json({ success: true });
    } catch (e) {
      sendError(res, e);
    }
  });

  router.get('/assets', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const assets = await db.collection('assets')
        .find({ ...collegeFilter(req) })
        .sort({ name: 1 })
        .toArray();
      res.json(assets.map(serializeAsset));
    } catch (e) {
      sendError(res, e.message, 500);
    }
  });

  router.get('/maintenance', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const maintenance = await db.collection('asset_maintenance')
        .find({ ...collegeFilter(req) })
        .sort({ createdAt: -1 })
        .toArray();
      const assetIds = [...new Set(maintenance.map(m => String(m.assetId)).filter(Boolean))];
      const assets = assetIds.length
        ? await db.collection('assets').find({ _id: { $in: assetIds.map(id => oid(id)).filter(Boolean) }, ...collegeFilter(req) }).toArray()
        : [];
      const assetMap = new Map(assets.map(a => [String(a._id), a]));
      res.json(maintenance.map(m => serializeMaintenance(m, assetMap)));
    } catch (e) {
      sendError(res, e.message, 500);
    }
  });

  router.get('/grievances', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      let filter = { ...collegeFilter(req) };
      if (req.user.role === 'student') {
        filter.userId = oid(req.user._id);
      }
      const grievances = await db.collection('grievances')
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray();
      res.json(grievances.map(serializeGrievance));
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/grievances', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const { category, subject, title, description, priority, anonymous } = req.body;

      const grievance = {
        collegeId: oid(req.userCollegeId),
        userId: oid(req.user._id),
        category,
        subject: subject || title || '',
        title: title || subject || '',
        description,
        status: 'open',
        priority: priority || 'medium',
        responses: [],
        ticketId: `GR-${makeCode()}`,
        createdAt: nowIso(),
      };

      if (anonymous) {
        delete grievance.userId;
      }

      const result = await db.collection('grievances').insertOne(grievance);
      grievance._id = result.insertedId;

      res.json(serializeGrievance(grievance));
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/grievances/:id/respond', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const { text } = req.body;

      const response = {
        userId: oid(req.user._id),
        text,
        createdAt: nowIso(),
      };

      const result = await db.collection('grievances').updateOne(
        { _id: oid(req.params.id), ...collegeFilter(req) },
        {
          $push: { responses: response },
          $set: { status: 'in_progress' },
        }
      );

      if (result.matchedCount === 0) return sendError(res, 'Grievance not found', 404);

      const updated = await db.collection('grievances').findOne({ _id: oid(req.params.id), ...collegeFilter(req) });
      res.json(serializeGrievance(updated));
    } catch (e) {
      sendError(res, e);
    }
  });

  router.get('/visitors', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const visitors = await db.collection('visitors')
        .find({ ...collegeFilter(req) })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(visitors.map(serializeVisitor));
    } catch (e) {
      sendError(res, e.message, 500);
    }
  });

  router.post('/visitors', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const { name, purpose, who, phone, type, expectedTime } = req.body || {};
      if (!name || !String(name).trim()) return sendError(res, 'Visitor name is required.');

      const visitor = {
        collegeId: oid(req.userCollegeId),
        name: String(name).trim(),
        purpose: purpose || '',
        who: who || '',
        phone: phone || '',
        type: type || 'guest',
        status: 'pending_approval',
        expectedTime: expectedTime || '',
        createdById: oid(req.user._id),
        createdAt: nowIso(),
      };
      const result = await db.collection('visitors').insertOne(visitor);
      visitor._id = result.insertedId;
      res.json(serializeVisitor(visitor));
    } catch (e) {
      sendError(res, e.message, 500);
    }
  });

  // ── Gate Pass ─────────────────────────────────────────

  router.get('/gate-passes', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      let filter = { ...collegeFilter(req) };
      if (req.user.role === 'student') {
        filter.userId = oid(req.user._id);
      }
      const passes = await db.collection('gate_passes')
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray();

      const userIds = [...new Set(passes.map(p => String(p.userId)).filter(Boolean))];
      const hostelIds = [...new Set(passes.map(p => String(p.hostelId)).filter(Boolean))];

      let userMap = {};
      let hostelMap = {};

      if (userIds.length) {
        const users = await db.collection('users').find({ _id: { $in: userIds.map(id => oid(id)) } }).toArray();
        for (const u of users) userMap[String(u._id)] = u;
      }
      if (hostelIds.length) {
        const hostels = await db.collection('hostels').find({ _id: { $in: hostelIds.map(id => oid(id)) } }).toArray();
        for (const h of hostels) hostelMap[String(h._id)] = h;
      }

      const mapped = passes.map(p => ({
        id: String(p._id),
        student_id: String(p.userId),
        student_name: userMap[String(p.userId)]?.name || p.student_name || '',
        hostel_id: String(p.hostelId || ''),
        hostel_name: hostelMap[String(p.hostelId)]?.name || p.hostel_name || '',
        reason: p.reason || '',
        destination: p.destination || '',
        out_time: p.out_time || '',
        expected_return: p.expected_return || '',
        status: p.status || 'pending',
        reviewed_by: p.reviewed_by || null,
        review_note: p.review_note || '',
        created_at: p.createdAt || '',
        reviewed_at: p.reviewed_at || '',
      }));

      res.json(mapped);
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/gate-passes', requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const { hostel_id, reason, destination, out_time, expected_return } = req.body;

      if (!reason || !reason.trim()) return sendError(res, 'Reason is required.');
      if (!out_time) return sendError(res, 'Out time is required.');

      let hostel_name = '';
      if (hostel_id) {
        const hostel = await db.collection('hostels').findOne({ _id: oid(hostel_id), ...collegeFilter(req) });
        if (hostel) hostel_name = hostel.name;
      }

      const pass = {
        collegeId: oid(req.userCollegeId),
        userId: oid(req.user._id),
        student_name: req.user.name || '',
        hostelId: hostel_id ? oid(hostel_id) : null,
        hostel_name,
        reason: reason.trim(),
        destination: (destination || '').trim(),
        out_time,
        expected_return: expected_return || '',
        status: 'pending',
        reviewed_by: null,
        review_note: '',
        createdAt: nowIso(),
      };

      const result = await db.collection('gate_passes').insertOne(pass);

      if (io) io.emit('gate_pass:created', { student_id: String(req.user._id), id: String(result.insertedId) });

      res.json({
        id: String(result.insertedId),
        ...pass,
        student_id: String(req.user._id),
        hostel_id: hostel_id || '',
      });
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/gate-passes/:id/approve', requireRole('college_admin', 'super_admin'), requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const { review_note } = req.body;
      const result = await db.collection('gate_passes').updateOne(
        { _id: oid(req.params.id), ...collegeFilter(req) },
        { $set: { status: 'approved', reviewed_by: oid(req.user._id), review_note: review_note || '', reviewed_at: nowIso() } }
      );
      if (result.matchedCount === 0) return sendError(res, 'Gate pass not found', 404);

      const updated = await db.collection('gate_passes').findOne({ _id: oid(req.params.id), ...collegeFilter(req) });
      if (io) io.emit('gate_pass:updated', { id: req.params.id, status: 'approved' });
      res.json({ id: String(updated._id), status: updated.status, reviewed_at: updated.reviewed_at });
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post('/gate-passes/:id/reject', requireRole('college_admin', 'super_admin'), requireCollegeAccess, async (req, res) => {
    try {
      const db = getDB();
      const { review_note } = req.body;
      const result = await db.collection('gate_passes').updateOne(
        { _id: oid(req.params.id), ...collegeFilter(req) },
        { $set: { status: 'rejected', reviewed_by: oid(req.user._id), review_note: review_note || '', reviewed_at: nowIso() } }
      );
      if (result.matchedCount === 0) return sendError(res, 'Gate pass not found', 404);

      const updated = await db.collection('gate_passes').findOne({ _id: oid(req.params.id), ...collegeFilter(req) });
      if (io) io.emit('gate_pass:updated', { id: req.params.id, status: 'rejected' });
      res.json({ id: String(updated._id), status: updated.status, reviewed_at: updated.reviewed_at });
    } catch (e) {
      sendError(res, e);
    }
  });

  return router;
}

module.exports = { createCampusRouter };
