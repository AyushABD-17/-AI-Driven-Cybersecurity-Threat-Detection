'use strict';

const { createClient } = require('redis');
const Log = require('../models/Log');
const Incident = require('../models/Incident');

let subscriber = null;

/**
 * Map anomaly_score + confidence → severity level
 */
function computeSeverity(anomalyScore, confidence) {
  if (anomalyScore < -0.3 && confidence > 0.9) return 'critical';
  if (anomalyScore < -0.2 && confidence > 0.75) return 'high';
  if (anomalyScore < -0.15) return 'medium';
  return 'low';
}

/**
 * Decide if this scored event should create a new Incident document.
 * Only Critical and High severity anomalies become incidents.
 */
async function maybeCreateIncident(log, io) {
  if (!log.is_anomaly) return;
  if (!['critical', 'high'].includes(log.severity)) return;

  // Deduplicate: don't create incident if open one exists for same src_ip + attack_type in last 5 min
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const existing = await Incident.findOne({
    'trigger_log.src_ip': log.src_ip,
    attack_type: log.attack_type,
    status: { $in: ['open', 'investigating'] },
    createdAt: { $gte: fiveMinAgo },
  });

  if (existing) return; // already tracking this attack cluster

  const incident = await Incident.create({
    title: `${log.attack_type} attack detected from ${log.src_ip}`,
    severity: log.severity,
    attack_type: log.attack_type,
    log_ids: [log._id],
    trigger_log: {
      src_ip:        log.src_ip,
      dst_ip:        log.dst_ip,
      anomaly_score: log.anomaly_score,
      confidence:    log.confidence,
      timestamp:     log.event_timestamp,
    },
  });

  // Notify all connected clients about the new incident
  if (io) {
    io.emit('incident:new', {
      id:          incident._id,
      title:       incident.title,
      severity:    incident.severity,
      attack_type: incident.attack_type,
      src_ip:      log.src_ip,
      createdAt:   incident.createdAt,
    });
  }
}

/**
 * Process a single scored log event from Redis.
 */
async function processScoredEvent(payload, io) {
  let data;
  try {
    data = JSON.parse(payload);
  } catch {
    console.warn('[Redis] Failed to parse scored log payload');
    return;
  }

  const severity = data.is_anomaly
    ? computeSeverity(data.anomaly_score, data.confidence ?? 0)
    : 'none';

  // Persist to MongoDB
  const log = await Log.create({ ...data, severity });

  // Emit log:stream to all clients (normal + anomalous for live feed)
  if (io) {
    io.emit('log:stream', {
      _id:           log._id,
      src_ip:        log.src_ip,
      dst_ip:        log.dst_ip,
      protocol:      log.protocol,
      attack_type:   log.attack_type,
      anomaly_score: log.anomaly_score,
      is_anomaly:    log.is_anomaly,
      severity:      log.severity,
      confidence:    log.confidence,
      timestamp:     log.event_timestamp,
    });

    // Emit threat:alert only for anomalies
    if (log.is_anomaly) {
      io.emit('threat:alert', {
        _id:           log._id,
        src_ip:        log.src_ip,
        dst_ip:        log.dst_ip,
        attack_type:   log.attack_type,
        anomaly_score: log.anomaly_score,
        severity:      log.severity,
        confidence:    log.confidence,
        timestamp:     log.event_timestamp,
      });
    }
  }

  // Possibly create an Incident for high-severity events
  await maybeCreateIncident(log, io);
}

/**
 * Emit aggregate stats every 5 seconds.
 */
function startStatsEmitter(io) {
  setInterval(async () => {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [alertsToday, criticalOpen, resolved] = await Promise.all([
        Log.countDocuments({ is_anomaly: true, createdAt: { $gte: startOfDay } }),
        Incident.countDocuments({ severity: 'critical', status: { $ne: 'resolved' } }),
        Incident.countDocuments({ status: 'resolved' }),
      ]);

      io.emit('stats:update', { alertsToday, criticalOpen, resolved, timestamp: new Date() });
    } catch (err) {
      console.error('[Stats] Emitter error:', err.message);
    }
  }, 5000);
}

/**
 * Initialize Redis subscriber — connects, subscribes to logs:scored, processes events.
 */
async function initRedisSubscriber(io) {
  subscriber = createClient({ url: process.env.REDIS_URL });

  subscriber.on('error', (err) => console.error('[Redis Subscriber] Error:', err.message));

  await subscriber.connect();
  console.log('[Redis Subscriber] Connected');

  await subscriber.subscribe('logs:scored', (message) => {
    processScoredEvent(message, io).catch((err) =>
      console.error('[Redis Subscriber] Processing error:', err.message)
    );
  });

  console.log('[Redis Subscriber] Subscribed to logs:scored');

  startStatsEmitter(io);
}

module.exports = { initRedisSubscriber };
