'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const Incident = require('../models/Incident');
const Report = require('../models/Report');
const { authenticate, authorize } = require('../middleware/auth');
const { generateReport } = require('../services/reportGenerator');

const router = express.Router();
router.use(authenticate);

// Rate limit: max 10 LLM calls per minute per user
const reportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user.id,
  message: { success: false, message: 'Too many report generation requests. Max 10 per minute.' },
});

// ── POST /api/reports/generate ────────────────────────────────────────────────
// Trigger async LLM report generation for an incident
router.post('/generate', authorize('analyst', 'admin'), reportLimiter, async (req, res, next) => {
  try {
    const { incident_id } = req.body;
    if (!incident_id) {
      return res.status(400).json({ success: false, message: 'incident_id is required' });
    }

    const incident = await Incident.findById(incident_id);
    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    if (incident.report_status === 'generating') {
      return res.status(202).json({ success: true, message: 'Report generation already in progress' });
    }

    // Mark as generating immediately — async generate in background
    incident.report_status = 'generating';
    await incident.save({ validateModifiedOnly: true });

    // Fire and forget — notify via WebSocket when done
    const io = req.app.get('io');
    generateReport(incident, req.user.id, io).catch(console.error);

    res.status(202).json({ success: true, message: 'Report generation started' });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/reports/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('incident_id', 'title severity attack_type status')
      .populate('created_by', 'name avatar_initials')
      .lean();

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
