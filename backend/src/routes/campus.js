const express = require('express');
const { prisma } = require('../db');
const { authUser } = require('../auth');
const { sendError } = require('../utils');

function createCampusRouter(io) {
  const router = express.Router();

  async function pushNotification({ audience = 'all', title, body, recipientIds = [] }) {
    await prisma.notification.create({ data: { audience, title, body, recipientIds, readBy: [] } });
    io.emit('notifications:update', { audience, recipientIds });
  }

  router.get('/hostels', async (_req, res) => {
    const hostels = await prisma.hostel.findMany();
    res.json(hostels.map(hostel => ({
      id: hostel.id,
      name: hostel.name,
      type: hostel.type,
      total_rooms: hostel.totalRooms,
      warden_name: hostel.wardenName,
      contact: hostel.contact,
    })));
  });

  router.get('/hostel/my-allocation', async (_req, res) => {
    const allocation = await prisma.hostelAllocation.findFirst({ include: { hostel: true, student: true } });
    if (!allocation) return res.json(null);
    res.json({
      id: allocation.id,
      hostel_id: allocation.hostelId,
      hostel_name: allocation.hostel.name,
      room_number: allocation.roomNumber,
      student_id: allocation.studentId,
      student_name: allocation.student.name,
      allocated_at: allocation.allocatedAt.toISOString(),
      active: allocation.active,
    });
  });

  router.get('/transport/routes', async (_req, res) => {
    const routes = await prisma.transportRoute.findMany({ include: { stops: { orderBy: { order: 'asc' } } } });
    res.json(routes.map(route => ({
      id: route.id,
      route_name: route.routeName,
      vehicle_number: route.vehicleNumber,
      driver_name: route.driverName,
      driver_phone: route.driverPhone,
      active: route.active,
      stops: route.stops.map(stop => ({ name: stop.name, time: stop.time })),
    })));
  });

  router.get('/transport/my-route', async (req, res) => {
    const user = await authUser(req);
    const enrollment = await prisma.transportEnrollment.findFirst({
      where: { studentId: user.id, active: true },
      include: { route: true },
    });
    if (!enrollment) return res.json(null);
    res.json({
      id: enrollment.id,
      route_id: enrollment.routeId,
      route_name: enrollment.route.routeName,
      student_id: enrollment.studentId,
      student_name: user.name,
      active: enrollment.active,
    });
  });

  router.post('/transport/enroll/:routeId', async (req, res) => {
    const user = await authUser(req);
    const route = await prisma.transportRoute.findUnique({ where: { id: req.params.routeId } });
    if (!route) return sendError(res, 'Route not found.', 404);
    await prisma.transportEnrollment.deleteMany({ where: { studentId: user.id } });
    const enrollment = await prisma.transportEnrollment.create({
      data: { routeId: route.id, studentId: user.id, active: true },
    });
    res.json({
      id: enrollment.id,
      route_id: enrollment.routeId,
      route_name: route.routeName,
      student_id: enrollment.studentId,
      student_name: user.name,
      active: enrollment.active,
    });
  });

  router.post('/transport/de-enroll', async (req, res) => {
    const user = await authUser(req);
    await prisma.transportEnrollment.deleteMany({ where: { studentId: user.id } });
    res.json({ ok: true });
  });

  router.get('/grievances', async (req, res) => {
    const user = await authUser(req);
    const isAdmin = ['college_admin', 'super_admin'].includes(user.role);
    const grievances = await prisma.grievance.findMany({
      where: isAdmin ? {} : { studentId: user.id },
      include: { student: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(grievances.map(grievance => ({
      id: grievance.id,
      student_id: grievance.studentId,
      student_name: grievance.student.name,
      student_email: grievance.student.email,
      category: grievance.category,
      subject: grievance.subject,
      description: grievance.description,
      is_anonymous: grievance.isAnonymous,
      status: grievance.status,
      created_at: grievance.createdAt.toISOString(),
    })));
  });

  router.post('/grievances', async (req, res) => {
    const user = await authUser(req);
    const grievance = await prisma.grievance.create({
      data: {
        studentId: user.id,
        category: req.body.category || 'General',
        subject: req.body.subject || 'Untitled',
        description: req.body.description || '',
        isAnonymous: !!req.body.is_anonymous,
        status: 'open',
      },
      include: { student: true },
    });
    await pushNotification({ audience: 'admins', title: 'New grievance submitted', body: grievance.subject });
    res.json({
      id: grievance.id,
      student_id: grievance.studentId,
      student_name: grievance.student.name,
      student_email: grievance.student.email,
      category: grievance.category,
      subject: grievance.subject,
      description: grievance.description,
      is_anonymous: grievance.isAnonymous,
      status: grievance.status,
      created_at: grievance.createdAt.toISOString(),
    });
  });

  return router;
}

module.exports = { createCampusRouter };
