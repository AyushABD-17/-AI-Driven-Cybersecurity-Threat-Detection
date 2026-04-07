'use strict';

const express = require('express');
const Incident = require('../models/Incident');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require a valid JWT
router.use(authenticate);

// ── GET /api/incidents ────────────────────────────────────────────────────────
// Paginated list with filtering by severity, status, attack_type, date range
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      severity,
      status,
      attack_type,
      from,
      to,
    } = req.query;

    const filter = {};
    if (severity)    filter.severity    = severity;
    if (status)      filter.status      = status;
    if (attack_type) filter.attack_type = attack_type;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [incidents, total] = await Promise.all([
      Incident.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('assigned_to', 'name email avatar_initials')
        .lean(),
      Incident.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: incidents,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/incidents/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const incident = await Incident.findById(req.params.id)
      .populate('assigned_to', 'name email avatar_initials')
      .populate('generated_report')
      .populate({ path: 'analyst_notes.author', select: 'name avatar_initials role' })
      .lean();

    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }
    res.json({ success: true, data: incident });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/incidents/:id ──────────────────────────────────────────────────
// Update status or add analyst notes — analysts + admins only
router.patch('/:id', authorize('analyst', 'admin'), async (req, res, next) => {
  try {
    const { status, note, assigned_to } = req.body;
    const incident = await Incident.findById(req.params.id);

    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    // Status transition
    if (status && status !== incident.status) {
      incident.status_history.push({
        from: incident.status,
        to: status,
        changed_by: req.user.id,
        reason: req.body.reason || '',
      });
      incident.status = status;
      if (status === 'resolved') incident.resolved_at = new Date();
    }

    // Analyst note
    if (note) {
      incident.analyst_notes.push({ author: req.user.id, content: note });
    }

    if (assigned_to) incident.assigned_to = assigned_to;

    await incident.save();

    // Broadcast update via Socket.io
    const io = req.app.get('io');
    if (io) io.emit('incident:updated', { id: incident._id, status: incident.status });

    res.json({ success: true, data: incident });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
