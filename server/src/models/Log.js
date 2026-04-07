'use strict';

const mongoose = require('mongoose');

const logSchema = new mongoose.Schema(
  {
    // ── Network addressing ──────────────────────────────────────────────────
    src_ip:       { type: String, required: true, index: true },
    dst_ip:       { type: String, required: true },
    src_port:     { type: Number },
    dst_port:     { type: Number },

    // ── Connection metadata ─────────────────────────────────────────────────
    protocol:     { type: String, enum: ['TCP', 'UDP', 'ICMP'], default: 'TCP' },
    flag:         { type: String },
    duration:     { type: Number, default: 0 },

    // ── Payload sizes ───────────────────────────────────────────────────────
    bytes_sent:     { type: Number, default: 0 },
    bytes_received: { type: Number, default: 0 },

    // ── Auth context ────────────────────────────────────────────────────────
    num_failed_logins: { type: Number, default: 0 },
    is_host_login:     { type: Boolean, default: false },
    is_guest_login:    { type: Boolean, default: false },

    // ── Connection frequency ────────────────────────────────────────────────
    count:     { type: Number, default: 0 },
    srv_count: { type: Number, default: 0 },

    // ── ML-scored fields ────────────────────────────────────────────────────
    anomaly_score: { type: Number, default: null },
    is_anomaly:    { type: Boolean, default: false, index: true },
    attack_type:   {
      type: String,
      enum: ['normal', 'DoS', 'Probe', 'R2L', 'U2R', 'unknown'],
      default: 'normal',
      index: true,
    },
    confidence:    { type: Number, default: null },
    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low', 'none'],
      default: 'none',
    },

    // ── Original event timestamp ────────────────────────────────────────────
    event_timestamp: { type: Date, default: Date.now },
  },
  {
    timestamps: true, // adds createdAt / updatedAt
    versionKey: false,
  }
);

// TTL index — auto-delete raw logs after 30 days
logSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

// Compound indexes for common query patterns
logSchema.index({ is_anomaly: 1, createdAt: -1 });
logSchema.index({ attack_type: 1, createdAt: -1 });
logSchema.index({ src_ip: 1, createdAt: -1 });

module.exports = mongoose.model('Log', logSchema);
