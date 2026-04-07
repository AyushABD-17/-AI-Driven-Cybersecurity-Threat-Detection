'use strict';

const express = require('express');
const Log = require('../models/Log');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── GET /api/logs ─────────────────────────────────────────────────────────────
// Paginated log feed with search and filtering
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      is_anomaly,
      attack_type,
      src_ip,
      severity,
      from,
      to,
    } = req.query;

    const filter = {};
    if (is_anomaly !== undefined) filter.is_anomaly = is_anomaly === 'true';
    if (attack_type) filter.attack_type = attack_type;
    if (src_ip)      filter.src_ip = { $regex: src_ip, $options: 'i' };
    if (severity)    filter.severity = severity;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
      Log.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Log.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
