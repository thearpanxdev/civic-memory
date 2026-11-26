import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import { config } from '../config/env.js';
import {
  getTimePeriodWindow,
  getCivicIntelligenceOverview,
  getRecurringIssuesAnalysis,
  getGeographicHotspotAnalysis,
  getHistoricalTrends,
} from '../services/historicalIntelligenceService.js';
import { generateCivicIntelligenceReport } from '../services/geminiService.js';
import {
  generateReportRequestSchema,
  VALID_PERIODS,
} from '../validators/intelligenceValidators.js';
import { logAuditEvent } from '../utils/auditLogger.js';

/**
 * Historical Civic Intelligence Controller
 *
 * Exposes municipal intelligence endpoints:
 * - Aggregated overview with comparative trends and KPIs
 * - Category-specific recurring defect analysis
 * - Geographic hotspot density analysis & unmapped exclusions
 * - Time-series velocity analysis
 * - AI executive report generation with Google Gemini
 * - Report listing, details, and printable PDF / Markdown export
 */

/**
 * GET /api/intelligence/overview
 * Returns unified civic intelligence payload across all analytical dimensions
 */
export function getIntelligenceOverview(req, res) {
  try {
    const period = req.query.period || '30d';
    if (!VALID_PERIODS.includes(period)) {
      return res.status(400).json({
        error: `Invalid time period. Must be one of: ${VALID_PERIODS.join(', ')}`,
      });
    }

    const wardId = req.query.ward_id || 'all';
    const category = req.query.category || 'all';
    const bypassCache = req.query.refresh === 'true' || req.query.bypass_cache === 'true';

    const data = getCivicIntelligenceOverview(period, { wardId, category, bypassCache });
    return res.status(200).json(data);
  } catch (err) {
    console.error('[Intelligence Controller Overview Error]:', err);
    return res.status(500).json({ error: 'Internal server error computing civic intelligence overview.' });
  }
}

/**
 * GET /api/intelligence/recurring
 * Detailed recurring civic problem detection across core categories
 */
export function getRecurringIssues(req, res) {
  try {
    const period = req.query.period || '90d';
    if (!VALID_PERIODS.includes(period)) {
      return res.status(400).json({
        error: `Invalid time period. Must be one of: ${VALID_PERIODS.join(', ')}`,
      });
    }

    const wardId = req.query.ward_id || 'all';
    const category = req.query.category || 'all';

    const periodWindow = getTimePeriodWindow(period);
    const data = getRecurringIssuesAnalysis(periodWindow, { wardId, category });

    return res.status(200).json({
      period,
      time_period: period,
      window: periodWindow,
      recurring_analysis: data,
      ...data,
    });
  } catch (err) {
    console.error('[Intelligence Controller Recurring Error]:', err);
    return res.status(500).json({ error: 'Internal server error analyzing recurring civic issues.' });
  }
}

/**
 * GET /api/intelligence/hotspots
 * Geographic hotspot clusters and neighbourhood density
 */
export function getGeographicHotspots(req, res) {
  try {
    const period = req.query.period || '90d';
    if (!VALID_PERIODS.includes(period)) {
      return res.status(400).json({
        error: `Invalid time period. Must be one of: ${VALID_PERIODS.join(', ')}`,
      });
    }

    const wardId = req.query.ward_id || 'all';
    const category = req.query.category || 'all';

    const periodWindow = getTimePeriodWindow(period);
    const data = getGeographicHotspotAnalysis(periodWindow, { wardId, category });

    return res.status(200).json({
      period,
      time_period: period,
      window: periodWindow,
      hotspot_analysis: data,
      ...data,
    });
  } catch (err) {
    console.error('[Intelligence Controller Hotspots Error]:', err);
    return res.status(500).json({ error: 'Internal server error analyzing geographic hotspots.' });
  }
}

/**
 * GET /api/intelligence/trends
 * Time series bucketing and period-over-period category velocity
 */
export function getHistoricalTrendsData(req, res) {
  try {
    const period = req.query.period || '90d';
    if (!VALID_PERIODS.includes(period)) {
      return res.status(400).json({
        error: `Invalid time period. Must be one of: ${VALID_PERIODS.join(', ')}`,
      });
    }

    const wardId = req.query.ward_id || 'all';
    const category = req.query.category || 'all';

    const periodWindow = getTimePeriodWindow(period);
    const data = getHistoricalTrends(periodWindow, { wardId, category });

    return res.status(200).json({
      period,
      time_period: period,
      window: periodWindow,
      historical_trends: data,
      ...data,
    });
  } catch (err) {
    console.error('[Intelligence Controller Trends Error]:', err);
    return res.status(500).json({ error: 'Internal server error analyzing historical trends.' });
  }
}

/**
 * POST /api/intelligence/reports/generate
 * Generates an AI-assisted municipal intelligence executive report with Gemini
 */
export async function generateReport(req, res) {
  try {
    const parseResult = generateReportRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { period, ward_id, category, custom_focus } = parseResult.data;

    // 1. Retrieve aggregated database overview without cache
    const overviewData = getCivicIntelligenceOverview(period, {
      wardId: ward_id || 'all',
      category: category || 'all',
      bypassCache: true,
    });

    if (custom_focus) {
      overviewData.custom_focus = custom_focus;
    }

    // 2. Dispatch to Gemini with strict factual grounding
    const testClient = req.app?.locals?.geminiClient;
    const aiReport = await generateCivicIntelligenceReport(overviewData, {
      client: testClient,
    });

    // 3. Persist generated report in database
    const reportId = `report-${uuidv4()}`;
    const wardParam = ward_id && ward_id !== 'all' ? ward_id : null;
    const catParam = category && category !== 'all' ? category : null;

    db.prepare(`
      INSERT INTO civic_intelligence_reports (
        id, generated_by_user_id, title, time_period, ward_id, category,
        summary, content_json, model_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reportId,
      req.user.id,
      aiReport.title,
      period,
      wardParam,
      catParam,
      aiReport.executive_summary,
      JSON.stringify(aiReport),
      config.geminiModel
    );

    // 4. Log immutable system audit event
    logAuditEvent({
      userId: req.user.id,
      action: 'INTELLIGENCE_REPORT_GENERATED',
      targetEntity: 'civic_intelligence_report',
      targetId: reportId,
      ipAddress: req.ip,
      details: {
        period,
        ward_id: wardParam,
        category: catParam,
        title: aiReport.title,
      },
    });

    return res.status(201).json({
      message: 'Civic intelligence executive report generated successfully.',
      report_id: reportId,
      report: {
        id: reportId,
        title: aiReport.title,
        time_period: period,
        ward_id: wardParam,
        category: catParam,
        summary: aiReport.executive_summary,
        content: aiReport,
        content_json: aiReport,
        created_at: new Date().toISOString(),
        author_name: req.user.full_name,
      },
      metadata: {
        id: reportId,
        generated_by: req.user.full_name,
        role: req.user.role,
        time_period: period,
        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    if (err.status && err.status !== 500) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[Generate Intelligence Report Error]:', err);
    return res.status(500).json({ error: 'Internal server error generating civic intelligence report.' });
  }
}

/**
 * GET /api/intelligence/reports
 * Returns list of historical generated reports
 */
export function listReports(req, res) {
  try {
    const reports = db.prepare(`
      SELECT 
        r.id, r.title, r.time_period, r.ward_id, r.category,
        r.summary, r.model_version, r.created_at,
        u.full_name as generated_by_name,
        u.role as generated_by_role,
        w.name as ward_name
      FROM civic_intelligence_reports r
      LEFT JOIN users u ON r.generated_by_user_id = u.id
      LEFT JOIN wards w ON r.ward_id = w.id
      ORDER BY r.created_at DESC
      LIMIT 25
    `).all();

    return res.status(200).json({ reports });
  } catch (err) {
    console.error('[List Intelligence Reports Error]:', err);
    return res.status(500).json({ error: 'Internal server error retrieving intelligence reports.' });
  }
}

/**
 * GET /api/intelligence/reports/:id
 * Retrieves full structured report by ID
 */
export function getReportById(req, res) {
  try {
    const { id } = req.params;
    const reportRow = db.prepare(`
      SELECT 
        r.*,
        u.full_name as generated_by_name,
        u.role as generated_by_role,
        w.name as ward_name
      FROM civic_intelligence_reports r
      LEFT JOIN users u ON r.generated_by_user_id = u.id
      LEFT JOIN wards w ON r.ward_id = w.id
      WHERE r.id = ?
    `).get(id);

    if (!reportRow) {
      return res.status(404).json({ error: 'Intelligence report not found.' });
    }

    let parsedContent = {};
    try {
      parsedContent = JSON.parse(reportRow.content_json);
    } catch {
      parsedContent = { raw: reportRow.content_json };
    }

    return res.status(200).json({
      report: {
        id: reportRow.id,
        title: reportRow.title,
        time_period: reportRow.time_period,
        ward_id: reportRow.ward_id,
        ward_name: reportRow.ward_name,
        category: reportRow.category,
        summary: reportRow.summary,
        model_version: reportRow.model_version,
        created_at: reportRow.created_at,
        generated_by_name: reportRow.generated_by_name,
        generated_by_role: reportRow.generated_by_role,
        content: parsedContent,
      },
    });
  } catch (err) {
    console.error('[Get Intelligence Report Detail Error]:', err);
    return res.status(500).json({ error: 'Internal server error fetching intelligence report.' });
  }
}

/**
 * GET /api/intelligence/reports/:id/export
 * Formatted printable HTML or Markdown export for PDF printing
 */
export function exportReport(req, res) {
  try {
    const { id } = req.params;
    const format = req.query.format || 'html'; // 'html', 'json', 'md'

    const reportRow = db.prepare(`
      SELECT 
        r.*,
        u.full_name as generated_by_name,
        u.role as generated_by_role,
        w.name as ward_name
      FROM civic_intelligence_reports r
      LEFT JOIN users u ON r.generated_by_user_id = u.id
      LEFT JOIN wards w ON r.ward_id = w.id
      WHERE r.id = ?
    `).get(id);

    if (!reportRow) {
      return res.status(404).json({ error: 'Intelligence report not found.' });
    }

    let parsedContent;
    try {
      parsedContent = JSON.parse(reportRow.content_json);
    } catch {
      parsedContent = {};
    }

    if (format === 'json') {
      const fullJson = {
        id: reportRow.id,
        title: reportRow.title,
        time_period: reportRow.time_period,
        ward_id: reportRow.ward_id,
        ward_name: reportRow.ward_name,
        category: reportRow.category,
        summary: reportRow.summary,
        created_at: reportRow.created_at,
        generated_by_name: reportRow.generated_by_name,
        generated_by_role: reportRow.generated_by_role,
        content: parsedContent,
        ...parsedContent,
      };
      res.setHeader('Content-Disposition', `attachment; filename="${id}.json"`);
      res.setHeader('Content-Type', 'application/json');
      return res.json(fullJson);
    }

    if (format === 'md') {
      const mdContent = `# CivicMemory — Municipal Intelligence Dossier: ${reportRow.title}
*CivicMemory Municipal Intelligence Report*
**Period:** ${reportRow.time_period.toUpperCase()} | **Generated on:** ${new Date(reportRow.created_at).toLocaleString()} | **Author:** ${reportRow.generated_by_name} (${reportRow.generated_by_role})

---

## 1. Executive Summary
${parsedContent.executive_summary || reportRow.summary}

## 2. Major Civic Concerns
${(parsedContent.major_civic_concerns || []).map((c) => `- **[${c.severity?.toUpperCase()}] ${c.category}: ${c.concern}**\n  ${c.evidence}\n  *Supporting Tickets:* ${(c.supporting_tickets || []).join(', ')}`).join('\n\n')}

## 3. Recurring Infrastructure Problems & Chronic Hotspots
${parsedContent.recurring_problems_summary || 'No recurring issues detected.'}

${(parsedContent.chronic_failure_clusters || []).map((cl) => `- **${cl.location}** (${cl.category}) — ${cl.recurrence_count} repeat incidents\n  ${cl.description}\n  *Root Ticket:* ${cl.root_ticket} | *Related:* ${(cl.supporting_tickets || []).join(', ')}`).join('\n\n')}

## 4. Geographic Hotspot Analysis
${parsedContent.geographic_hotspots_summary || ''}

${(parsedContent.top_hotspots || []).map((h) => `- **${h.location}** — ${h.total_complaints} complaints (${h.unresolved_count} open, Dominant: ${h.dominant_category})\n  *Insight:* ${h.insight}`).join('\n\n')}

## 5. Historical Comparison & Trends
${parsedContent.historical_comparison || ''}

## 6. Recommended Municipal Inspection Priorities
${(parsedContent.recommended_inspection_priorities || []).map((p) => `### Priority ${p.priority}: ${p.target_location} [${p.urgency?.toUpperCase()}]\n**Responsible Department:** ${p.department}\n**Action:** ${p.recommended_action}\n**Supporting Evidence:** ${(p.supporting_tickets || []).join(', ')}`).join('\n\n')}

---
*Grounded Civic Intelligence generated by CivicMemory Historical Engine.*
`;
      res.setHeader('Content-Disposition', `attachment; filename="${id}.md"`);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      return res.send(mdContent);
    }

    // Default: Printable HTML formatted for native browser PDF export (window.print() friendly)
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${reportRow.title} — CivicMemory</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; margin: 0; padding: 24px; }
    .header { border-bottom: 3px solid #7c3aed; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 20px; font-weight: 900; color: #581c87; letter-spacing: -0.5px; }
    .brand span { color: #9333ea; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; background: #f3e8ff; color: #7e22ce; margin-left: 8px; }
    h1 { font-size: 22px; font-weight: 800; color: #0f172a; margin: 12px 0 6px 0; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 16px; }
    h2 { font-size: 15px; font-weight: 700; color: #581c87; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 24px; text-transform: uppercase; letter-spacing: 0.5px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 12px; page-break-inside: avoid; }
    .card-title { font-weight: 700; font-size: 13px; color: #0f172a; display: flex; justify-content: space-between; }
    .tag { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 6px; text-transform: uppercase; }
    .tag-critical { background: #fee2e2; color: #b91c1c; }
    .tag-high { background: #ffedd5; color: #c2410c; }
    .tag-medium { background: #fef3c7; color: #b45309; }
    .tag-low { background: #ecfdf5; color: #047857; }
    .tickets { font-family: monospace; font-size: 11px; color: #6366f1; margin-top: 6px; }
    .btn-print { background: #7c3aed; color: #fff; border: none; padding: 10px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; float: right; }
    @media print {
      .btn-print { display: none; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
  <div class="header">
    <div class="brand">Civic<span>Memory</span> <span class="badge">Official Municipal Intelligence</span></div>
    <h1>${reportRow.title}</h1>
    <div class="meta">
      <strong>Time Window:</strong> ${reportRow.time_period.toUpperCase()} |
      <strong>Generated By:</strong> ${reportRow.generated_by_name} (${reportRow.generated_by_role}) |
      <strong>Date:</strong> ${new Date(reportRow.created_at).toLocaleString()}
    </div>
  </div>

  <h2>1. Executive Summary</h2>
  <div class="card" style="background: #faf5ff; border-color: #e9d5ff;">
    <p style="margin: 0; font-size: 13px; line-height: 1.7;">${parsedContent.executive_summary || reportRow.summary}</p>
  </div>

  <h2>2. Major Civic Concerns</h2>
  ${(parsedContent.major_civic_concerns || []).map((c) => `
    <div class="card">
      <div class="card-title">
        <span>${c.category}: ${c.concern}</span>
        <span class="tag tag-${(c.severity || 'medium').toLowerCase()}">${c.severity || 'Medium'}</span>
      </div>
      <p style="margin: 6px 0 0 0; font-size: 12px; color: #334155;">${c.evidence}</p>
      ${c.supporting_tickets?.length ? `<div class="tickets">Supporting Tickets: ${c.supporting_tickets.join(', ')}</div>` : ''}
    </div>
  `).join('')}

  <h2>3. Recurring Infrastructure Failures & Chronic Hotspots</h2>
  <p style="font-size: 13px; color: #475569;">${parsedContent.recurring_problems_summary || 'No recurring cluster patterns identified.'}</p>
  ${(parsedContent.chronic_failure_clusters || []).map((cl) => `
    <div class="card" style="border-left: 4px solid #e11d48;">
      <div class="card-title">
        <span>${cl.location}</span>
        <span class="tag tag-high">${cl.recurrence_count} Repeat Failures</span>
      </div>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #475569;">${cl.description}</p>
      <div class="tickets">Root Ticket: ${cl.root_ticket || 'Incident'} ${cl.supporting_tickets?.length ? `| Related: ${cl.supporting_tickets.join(', ')}` : ''}</div>
    </div>
  `).join('')}

  <h2>4. Geographic Hotspots</h2>
  <p style="font-size: 13px; color: #475569;">${parsedContent.geographic_hotspots_summary || ''}</p>
  ${(parsedContent.top_hotspots || []).map((h) => `
    <div class="card">
      <div class="card-title">
        <span>${h.location}</span>
        <span style="font-size: 11px; font-weight: 700; color: #4338ca;">${h.total_complaints} Complaints (${h.unresolved_count} Open)</span>
      </div>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #475569;">${h.insight}</p>
    </div>
  `).join('')}

  <h2>5. Historical Period Comparison</h2>
  <div class="card">
    <p style="margin: 0; font-size: 12px; line-height: 1.7; color: #334155;">${parsedContent.historical_comparison || ''}</p>
  </div>

  <h2>6. Recommended Municipal Inspection Priorities</h2>
  ${(parsedContent.recommended_inspection_priorities || []).map((p) => `
    <div class="card" style="border-left: 4px solid #7c3aed;">
      <div class="card-title">
        <span>Priority ${p.priority}: ${p.target_location}</span>
        <span class="tag tag-${(p.urgency || 'medium').toLowerCase()}">${p.urgency || 'Medium'} Urgency</span>
      </div>
      <div style="font-size: 11px; font-weight: 700; color: #6b21a8; margin-top: 2px;">Assigned Dept: ${p.department}</div>
      <p style="margin: 6px 0 0 0; font-size: 12px; color: #1e293b;">${p.recommended_action}</p>
      ${p.supporting_tickets?.length ? `<div class="tickets">Evidence Tickets: ${p.supporting_tickets.join(', ')}</div>` : ''}
    </div>
  `).join('')}

  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
    CivicMemory Municipal Intelligence Engine • Report Reference: ${reportRow.id} • Strictly Grounded on Database Records
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (err) {
    console.error('[Export Intelligence Report Error]:', err);
    return res.status(500).json({ error: 'Internal server error exporting intelligence report.' });
  }
}
