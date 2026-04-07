'use strict';

const mongoose = require('mongoose');

// ── Analyst note sub-document ─────────────────────────────────────────────────
const noteSchema = new mongoose.Schema(
  {
    author:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content:   { type: String, required: true, maxlength: 5000 },
    created_at: { type: Date, default: Date.now },
  },
  { _id: true, versionKey: false }
);

// ── Status history sub-document ───────────────────────────────────────────────
const statusHistorySchema = new mongoose.Schema(
  {
    from:      { type: String },
    to:        { type: String, required: true },
    changed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changed_at: { type: Date, default: Date.now },
    reason:    { type: String },
  },
  { _id: false, versionKey: false }
);

// ── Incident schema ───────────────────────────────────────────────────────────
const incidentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      default: function () {
        return `Incident-${Date.now()}`;
      },
    },
    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'investigating', 'resolved'],
      default: 'open',
      index: true,
    },
    attack_type: {
      type: String,
      enum: ['DoS', 'Probe', 'R2L', 'U2R', 'unknown'],
      required: true,
    },

    // Related log events
    log_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Log' }],

    // Primary triggering log snapshot (for display without population)
    trigger_log: {
      src_ip:        String,
      dst_ip:        String,
      anomaly_score: Number,
      confidence:    Number,
      timestamp:     Date,
    },

    // Analyst collaboration
    assigned_to:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    analyst_notes: [noteSchema],
    status_history: [statusHistorySchema],

    // LLM-generated report reference
    generated_report: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', default: null },
    report_status: {
      type: String,
      enum: ['none', 'generating', 'ready', 'llm_failed'],
      default: 'none',
    },

    resolved_at: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

incidentSchema.index({ severity: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Incident', incidentSchema);
