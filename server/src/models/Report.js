'use strict';

const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    incident_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Incident',
      required: true,
      unique: true,
      index: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Structured JSON output from LLM
    content: {
      executive_summary:             { type: String, default: '' },
      technical_details:             { type: String, default: '' },
      affected_systems:              { type: String, default: '' },
      recommended_immediate_actions: { type: String, default: '' },
      recommended_long_term_actions: { type: String, default: '' },
      severity_justification:        { type: String, default: '' },
    },

    // Raw LLM HTML or markdown (for PDF rendering)
    html: { type: String, default: '' },

    // Model metadata
    model_used:  { type: String, default: '' },
    prompt_tokens: { type: Number, default: 0 },
    completion_tokens: { type: Number, default: 0 },

    is_template_fallback: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('Report', reportSchema);
