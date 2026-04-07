'use strict';

const https = require('https');
const Incident = require('../models/Incident');
const Report = require('../models/Report');

// ── Template fallback ─────────────────────────────────────────────────────────
function buildTemplateFallback(incident) {
  return {
    executive_summary: `A ${incident.severity.toUpperCase()} severity ${incident.attack_type} attack was detected originating from ${incident.trigger_log?.src_ip || 'unknown'} targeting ${incident.trigger_log?.dst_ip || 'unknown'}. The anomaly detection model flagged this event with an anomaly score of ${incident.trigger_log?.anomaly_score?.toFixed(3) || 'N/A'}.`,
    technical_details: `Attack Type: ${incident.attack_type}\nSeverity: ${incident.severity}\nSource IP: ${incident.trigger_log?.src_ip}\nDestination IP: ${incident.trigger_log?.dst_ip}\nDetection Confidence: ${((incident.trigger_log?.confidence || 0) * 100).toFixed(1)}%\nAnomaly Score: ${incident.trigger_log?.anomaly_score?.toFixed(4)}`,
    affected_systems: `Destination host ${incident.trigger_log?.dst_ip || 'unknown'} may be affected. Further investigation required to determine the full scope of affected systems.`,
    recommended_immediate_actions: `1. Immediately block traffic from source IP ${incident.trigger_log?.src_ip}.\n2. Isolate destination host for forensic analysis.\n3. Review firewall and IDS logs for related activity.\n4. Alert the security team and escalate to Tier 2.`,
    recommended_long_term_actions: `1. Update firewall rules to block the identified attack vector.\n2. Review and patch affected services.\n3. Conduct a post-incident review within 48 hours.\n4. Update detection thresholds based on findings.`,
    severity_justification: `Classified as ${incident.severity} based on anomaly score (${incident.trigger_log?.anomaly_score?.toFixed(3)}) and classifier confidence (${((incident.trigger_log?.confidence || 0) * 100).toFixed(1)}%). The ${incident.attack_type} attack category represents a significant threat to system integrity.`,
  };
}

// ── Build LLM prompt ──────────────────────────────────────────────────────────
function buildPrompt(incident) {
  return `You are a senior cybersecurity analyst. Analyze the following security incident and produce a structured JSON incident report.

INCIDENT DATA:
- Incident ID: ${incident._id}
- Title: ${incident.title}
- Severity: ${incident.severity.toUpperCase()}
- Attack Type: ${incident.attack_type}
- Source IP: ${incident.trigger_log?.src_ip || 'unknown'}
- Destination IP: ${incident.trigger_log?.dst_ip || 'unknown'}
- Anomaly Score: ${incident.trigger_log?.anomaly_score?.toFixed(4) || 'N/A'}
- Detection Confidence: ${((incident.trigger_log?.confidence || 0) * 100).toFixed(1)}%
- Timestamp: ${incident.trigger_log?.timestamp || incident.createdAt}
- Related Log Count: ${incident.log_ids?.length || 1}
- Analyst Notes: ${incident.analyst_notes?.map((n) => n.content).join('; ') || 'None'}

Return ONLY a valid JSON object with exactly these fields:
{
  "executive_summary": "2-3 sentence non-technical summary for management",
  "technical_details": "Detailed technical analysis of the attack vector, indicators of compromise, and detection methodology",
  "affected_systems": "Description of systems, services, and data potentially affected",
  "recommended_immediate_actions": "Numbered list of immediate containment and mitigation steps",
  "recommended_long_term_actions": "Numbered list of strategic remediation and hardening steps",
  "severity_justification": "Explanation of why this severity level was assigned based on impact and likelihood"
}`;
}

// ── Groq API call ─────────────────────────────────────────────────────────────
async function callGroqAPI(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your-groq-api-key-here') {
    throw new Error('GROQ_API_KEY not configured');
  }

  const body = JSON.stringify({
    model: process.env.LLM_MODEL || 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve(parsed);
        } catch (e) {
          reject(new Error('Failed to parse Groq API response'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Groq API timeout')); });
    req.write(body);
    req.end();
  });
}

// ── Render HTML from content ──────────────────────────────────────────────────
function renderHTML(content, incident) {
  return `
<div class="incident-report">
  <h1>Incident Report: ${incident.title}</h1>
  <div class="meta">
    <span class="badge severity-${incident.severity}">${incident.severity.toUpperCase()}</span>
    <span class="attack-type">${incident.attack_type}</span>
    <span class="timestamp">${new Date().toISOString()}</span>
  </div>
  <section><h2>Executive Summary</h2><p>${content.executive_summary}</p></section>
  <section><h2>Technical Details</h2><pre>${content.technical_details}</pre></section>
  <section><h2>Affected Systems</h2><p>${content.affected_systems}</p></section>
  <section><h2>Immediate Actions Required</h2><p>${content.recommended_immediate_actions}</p></section>
  <section><h2>Long-Term Recommendations</h2><p>${content.recommended_long_term_actions}</p></section>
  <section><h2>Severity Justification</h2><p>${content.severity_justification}</p></section>
</div>`;
}

// ── Main export ───────────────────────────────────────────────────────────────
async function generateReport(incident, userId, io) {
  let content;
  let isTemplateFallback = false;
  let modelUsed = '';
  let promptTokens = 0;
  let completionTokens = 0;

  try {
    const prompt = buildPrompt(incident);
    const response = await callGroqAPI(prompt);
    const rawContent = response.choices[0].message.content;
    content = JSON.parse(rawContent);
    modelUsed = response.model || '';
    promptTokens = response.usage?.prompt_tokens || 0;
    completionTokens = response.usage?.completion_tokens || 0;
  } catch (err) {
    console.warn('[ReportGenerator] LLM call failed, using template fallback:', err.message);
    content = buildTemplateFallback(incident);
    isTemplateFallback = true;
    modelUsed = 'template-fallback';
  }

  const html = renderHTML(content, incident);

  // Save report
  const report = await Report.create({
    incident_id:          incident._id,
    created_by:           userId,
    content,
    html,
    model_used:           modelUsed,
    prompt_tokens:        promptTokens,
    completion_tokens:    completionTokens,
    is_template_fallback: isTemplateFallback,
  });

  // Update incident
  incident.generated_report = report._id;
  incident.report_status = isTemplateFallback ? 'llm_failed' : 'ready';
  await incident.save({ validateModifiedOnly: true });

  // Notify via WebSocket
  if (io) {
    io.emit('report:ready', {
      incident_id: incident._id,
      report_id:   report._id,
      is_fallback: isTemplateFallback,
    });
  }

  console.log(`[ReportGenerator] Report ${report._id} generated for incident ${incident._id} (fallback: ${isTemplateFallback})`);
  return report;
}

module.exports = { generateReport };
