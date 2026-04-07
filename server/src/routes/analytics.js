'use strict';

const express = require('express');
const Log = require('../models/Log');
const Incident = require('../models/Incident');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── GET /api/analytics/summary ────────────────────────────────────────────────
router.get('/summary', async (req, res, next) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const yesterday  = new Date(startOfDay);
    yesterday.setDate(yesterday.getDate() - 1);

    const [
      totalAlertsToday,
      totalAlertsYesterday,
      criticalCount,
      resolvedCount,
      attackTypeBreakdown,
      severityBreakdown,
      topSourceIPs,
      recentTrend,
    ] = await Promise.all([
      Log.countDocuments({ is_anomaly: true, createdAt: { $gte: startOfDay } }),
      Log.countDocuments({ is_anomaly: true, createdAt: { $gte: yesterday, $lt: startOfDay } }),
      Incident.countDocuments({ severity: 'critical', status: { $ne: 'resolved' } }),
      Incident.countDocuments({ status: 'resolved' }),

      // Attack type breakdown
      Log.aggregate([
        { $match: { is_anomaly: true } },
        { $group: { _id: '$attack_type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Severity breakdown
      Incident.aggregate([
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),

      // Top 10 source IPs by anomaly count
      Log.aggregate([
        { $match: { is_anomaly: true } },
        { $group: { _id: '$src_ip', count: { $sum: 1 }, attack_types: { $addToSet: '$attack_type' } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // Hourly trend — last 24 hours
      Log.aggregate([
        { $match: { is_anomaly: true, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%dT%H:00:00Z', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        alerts: {
          today:     totalAlertsToday,
          yesterday: totalAlertsYesterday,
          trend:     totalAlertsYesterday > 0
            ? (((totalAlertsToday - totalAlertsYesterday) / totalAlertsYesterday) * 100).toFixed(1)
            : 0,
        },
        criticalActive:  criticalCount,
        resolvedTotal:   resolvedCount,
        attackBreakdown: attackTypeBreakdown,
        severityBreakdown,
        topSourceIPs,
        hourlyTrend: recentTrend,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analytics/graph ──────────────────────────────────────────────────
// Returns nodes (unique IPs) and links (connections) for D3 force graph
router.get('/graph', async (req, res, next) => {
  try {
    const recentLogs = await Log.find(
      { createdAt: { $gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } }, // last 6h
      'src_ip dst_ip is_anomaly attack_type severity bytes_sent'
    )
      .sort({ createdAt: -1 })
      .limit(2000)
      .lean();

    const nodeMap = new Map();
    const linkMap = new Map();

    for (const log of recentLogs) {
      // Upsert nodes
      for (const ip of [log.src_ip, log.dst_ip]) {
        if (!nodeMap.has(ip)) {
          nodeMap.set(ip, { id: ip, is_attacker: false, attack_types: new Set(), connection_count: 0 });
        }
        nodeMap.get(ip).connection_count++;
      }

      if (log.is_anomaly) {
        const srcNode = nodeMap.get(log.src_ip);
        srcNode.is_attacker = true;
        srcNode.attack_types.add(log.attack_type);
      }

      // Upsert links
      const linkKey = `${log.src_ip}→${log.dst_ip}`;
      if (!linkMap.has(linkKey)) {
        linkMap.set(linkKey, { source: log.src_ip, target: log.dst_ip, packet_count: 0, has_attack: false });
      }
      const link = linkMap.get(linkKey);
      link.packet_count++;
      if (log.is_anomaly) link.has_attack = true;
    }

    // Serialize sets to arrays
    const nodes = Array.from(nodeMap.values()).map((n) => ({
      ...n,
      attack_types: Array.from(n.attack_types),
    }));

    // Limit to top 100 nodes by connection count for render performance
    nodes.sort((a, b) => b.connection_count - a.connection_count);
    const top100Ids = new Set(nodes.slice(0, 100).map((n) => n.id));
    const filteredLinks = Array.from(linkMap.values()).filter(
      (l) => top100Ids.has(l.source) && top100Ids.has(l.target)
    );

    res.json({
      success: true,
      data: { nodes: nodes.slice(0, 100), links: filteredLinks },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
