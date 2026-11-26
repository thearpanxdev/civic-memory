/**
 * ====================================================================
 * CivicMemory — AI-Powered Historical Civic Intelligence Engine Test Suite
 *
 * Automated verification for historical intelligence, recurring issues,
 * geographic hotspots, historical trend analysis, and Gemini report export:
 * 1. Access Control: Citizen (403), Unauthenticated (401), Official/Admin (200).
 * 2. Multi-Period Analysis: 7d, 30d, 90d, 180d, 365d, all.
 * 3. Overall KPI Metrics: Total reported, unique, recurring, unresolved, avg resolution time, satisfaction.
 * 4. Comparative Period Deltas: Prior period comparison, % change, and trend direction.
 * 5. Recurring Defect Intelligence:
 *    - Road damage, waterlogging, drainage, garbage, streetlights.
 *    - Chronic bounce-back detection (reopened resolved issues).
 * 6. Geographic Hotspot Analysis:
 *    - Haversine <= 150m spatial clustering.
 *    - Strict exclusion: Unmapped complaints (null coordinates) isolated and excluded from spatial clusters.
 * 7. Gemini Report Generation & Grounding:
 *    - Schema compliance and strict database grounding.
 *    - Persistence in civic_intelligence_reports table.
 * 8. Report Export:
 *    - Printable HTML / PDF view.
 *    - Markdown format (.md).
 *    - JSON format (.json).
 * 9. In-Memory Caching: 5-minute TTL caching behavior.
 * ====================================================================
 */

import http from 'http';
import app from '../src/index.js';
import db from '../src/config/database.js';
import { setGeminiClient, resetGeminiClient } from '../src/services/geminiService.js';
import { clearIntelligenceCache } from '../src/services/historicalIntelligenceService.js';

let server;
let baseUrl;

function parseSetCookie(res) {
  const cookieHeader = res.headers.get('set-cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/civic_token=([^;]+)/);
  return match ? match[1] : null;
}

async function runHistoricalCivicIntelligenceTestSuite() {
  console.log('====================================================================');
  console.log('CivicMemory — Historical Civic Intelligence Engine Test Suite');
  console.log('====================================================================\n');

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}/api`;

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName} ${details}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Setup: Authentication
    // -------------------------------------------------------------
    // Citizen Arjun
    const citizenLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        email: 'citizen.arjun@civicmemory.local',
        password: 'Citizen@Civic2026!',
      }),
    });
    const citizenCookie = parseSetCookie(citizenLoginRes);
    assert(citizenCookie, 'Setup: Citizen Arjun authenticated');

    // Roads Official
    const officialLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        email: 'official.roads@civicmemory.local',
        password: 'Official@Civic2026!',
      }),
    });
    const officialCookie = parseSetCookie(officialLoginRes);
    assert(officialCookie, 'Setup: Municipal Official authenticated');

    // Municipal Admin
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        email: 'admin@civicmemory.local',
        password: 'Admin@Civic2026!',
      }),
    });
    const adminCookie = parseSetCookie(adminLoginRes);
    assert(adminCookie, 'Setup: Municipal Admin authenticated');

    // -------------------------------------------------------------
    // Test 1: Access Control (Authentication & Role Verification)
    // -------------------------------------------------------------
    const unauthRes = await fetch(`${baseUrl}/intelligence/overview`);
    assert(unauthRes.status === 401, '1a. Unauthenticated request to intelligence overview rejected with 401');

    const citizenForbiddenRes = await fetch(`${baseUrl}/intelligence/overview`, {
      headers: { 'Cookie': `civic_token=${citizenCookie}` },
    });
    assert(citizenForbiddenRes.status === 403, '1b. Citizen role to intelligence overview rejected with 403');

    const officialOverviewRes = await fetch(`${baseUrl}/intelligence/overview`, {
      headers: { 'Cookie': `civic_token=${officialCookie}` },
    });
    assert(officialOverviewRes.status === 200, '1c. Official role permitted to intelligence overview (200)');

    const adminOverviewRes = await fetch(`${baseUrl}/intelligence/overview`, {
      headers: { 'Cookie': `civic_token=${adminCookie}` },
    });
    assert(adminOverviewRes.status === 200, '1d. Admin role permitted to intelligence overview (200)');

    // -------------------------------------------------------------
    // Test 2: Multi-Period Historical Trend Analysis & Comparative Deltas
    // -------------------------------------------------------------
    clearIntelligenceCache();
    const periods = ['7d', '30d', '90d', '180d', '365d', 'all'];

    for (const period of periods) {
      const pRes = await fetch(`${baseUrl}/intelligence/overview?period=${period}`, {
        headers: { 'Cookie': `civic_token=${adminCookie}` },
      });
      assert(pRes.status === 200, `2a. Successfully fetched intelligence for period '${period}'`);
      const pData = await pRes.json();
      assert(pData.time_period === period, `2b. Correct period '${period}' reflected in response`);
      assert(pData.overall_metrics && typeof pData.overall_metrics.total_reported === 'number', `2c. Overall metrics present for '${period}'`);
    }

    // Check comparative window delta for 30d
    clearIntelligenceCache();
    const res30d = await fetch(`${baseUrl}/intelligence/overview?period=30d`, {
      headers: { 'Cookie': `civic_token=${adminCookie}` },
    });
    const data30d = await res30d.json();
    const metrics30d = data30d.overall_metrics;
    assert(typeof metrics30d.prior_period_total === 'number', '2d. Prior period comparison total computed');
    assert(metrics30d.percent_change_total !== undefined, '2e. Percentage change calculated vs prior period');
    assert(['increasing', 'decreasing', 'steady'].includes(metrics30d.trend_direction), '2f. Trend direction categorized (increasing/decreasing/steady)');

    // -------------------------------------------------------------
    // Test 3: Core KPI Calculation Integrity
    // -------------------------------------------------------------
    assert(metrics30d.total_reported >= metrics30d.total_unique_issues, '3a. Total reported >= total unique issues');
    assert(metrics30d.unresolved_complaints + metrics30d.resolved_complaints <= metrics30d.total_reported, '3b. Unresolved + resolved complaints <= total reported');
    assert(typeof metrics30d.recurrence_rate_percent === 'number', '3c. Recurrence rate percentage computed');
    assert(typeof metrics30d.citizen_satisfaction_rate_percent === 'number', '3d. Citizen satisfaction rate computed');

    // -------------------------------------------------------------
    // Test 4: Recurring Defect Intelligence & Chronic Bounce-Backs
    // -------------------------------------------------------------
    clearIntelligenceCache();
    const recurringRes = await fetch(`${baseUrl}/intelligence/recurring?period=all`, {
      headers: { 'Cookie': `civic_token=${officialCookie}` },
    });
    assert(recurringRes.status === 200, '4a. Fetched recurring defect intelligence');
    const recurringData = await recurringRes.json();

    assert(Array.isArray(recurringData.recurring_analysis.road_damage), '4b. Road damage recurring defect list returned');
    assert(Array.isArray(recurringData.recurring_analysis.waterlogging), '4c. Waterlogging recurring defect list returned');
    assert(Array.isArray(recurringData.recurring_analysis.drainage_sewage), '4d. Drainage & sewage recurring defect list returned');
    assert(Array.isArray(recurringData.recurring_analysis.garbage_accumulation), '4e. Garbage accumulation recurring defect list returned');
    assert(Array.isArray(recurringData.recurring_analysis.streetlight_failures), '4f. Streetlight failure recurring defect list returned');

    // Chronic Bounce-Backs (Issues repeatedly marked resolved and subsequently reported/reopened)
    const bounceBacks = recurringData.recurring_analysis.chronic_bounce_backs || [];
    assert(bounceBacks.length > 0, `4g. Chronic bounce-backs detected (found ${bounceBacks.length})`);
    const reopenedExample = bounceBacks.find((b) => b.to_status === 'Reopened' || b.reopen_count > 0 || b.recurrence_count > 0);
    assert(reopenedExample, '4h. Verified presence of reopened chronic bounce-back ticket');

    // -------------------------------------------------------------
    // Test 5: Geographic Hotspots (Haversine 150m) & Strict Unmapped Exclusion
    // -------------------------------------------------------------
    clearIntelligenceCache();
    const hotspotRes = await fetch(`${baseUrl}/intelligence/hotspots?period=all`, {
      headers: { 'Cookie': `civic_token=${officialCookie}` },
    });
    assert(hotspotRes.status === 200, '5a. Fetched geographic hotspots');
    const hotspotData = await hotspotRes.json();
    const clusters = hotspotData.hotspot_analysis.spatial_clusters || [];

    assert(clusters.length > 0, `5b. Spatial clusters detected within 150m (found ${clusters.length} clusters)`);

    const firstCluster = clusters[0];
    assert(typeof firstCluster.centroid_lat === 'number' && typeof firstCluster.centroid_lng === 'number', '5c. Cluster has centroid GPS coordinates');
    assert(firstCluster.report_count >= 2, '5d. Spatial cluster contains >= 2 grouped complaints');
    assert(Array.isArray(firstCluster.complaint_tickets), '5e. Cluster lists associated complaint ticket numbers');

    // Strict Unmapped Exclusion Check:
    // Complaints without valid coordinates (like cmp-511) must NOT be placed into a cluster!
    assert(hotspotData.hotspot_analysis.unmapped_reports_count >= 1, '5f. Unmapped complaints without coordinates are isolated (unmapped_reports_count >= 1)');
    const allClusteredTickets = clusters.flatMap((c) => c.complaint_tickets || []);
    assert(!allClusteredTickets.includes('CM-2026-00511'), '5g. Unmapped complaint CM-2026-00511 is strictly excluded from spatial clusters');

    // -------------------------------------------------------------
    // Test 6: Historical Trends Endpoint (Daily/Weekly/Monthly Buckets)
    // -------------------------------------------------------------
    const trendRes = await fetch(`${baseUrl}/intelligence/trends?period=30d`, {
      headers: { 'Cookie': `civic_token=${adminCookie}` },
    });
    assert(trendRes.status === 200, '6a. Fetched historical trends time series');
    const trendData = await trendRes.json();
    assert(Array.isArray(trendData.historical_trends.trend_points), '6b. Time-series trend points array present');
    assert(Array.isArray(trendData.historical_trends.category_breakdown), '6c. Category velocity breakdown present');

    // -------------------------------------------------------------
    // Test 7: AI Report Generation with Gemini & Grounding Schema
    // -------------------------------------------------------------
    const mockGeminiReport = {
      executive_summary: 'Municipal infrastructure across Indiranagar and Koramangala demonstrates severe chronic water drainage vulnerabilities.',
      major_civic_concerns: [
        {
          title: 'Sub-base asphalt erosion on Indiranagar 100ft arterial',
          category: 'Roads & Footpaths',
          severity: 'critical',
          description: 'Repeated cold patching fails due to underground water main pressure surges.',
          impacted_ward: 'Indiranagar',
          supporting_ticket_numbers: ['CM-2026-00101', 'CM-2026-00450', 'CM-2026-00501'],
        },
      ],
      recurring_problems_analysis: {
        summary: 'Road repairs on 100ft road fail repeatedly across monsoons.',
        chronic_bounce_backs: 'Water supply line bursts repeatedly at Jayanagar 14th Main after repair closures.',
      },
      geographic_hotspots: [
        {
          cluster_name: 'Indiranagar 100ft Rd Corridor',
          approximate_location: '100ft Road, opposite Metro Pillar 82',
          dominant_category: 'Roads & Footpaths',
          complaint_count: 3,
          observations: 'Heavy vehicle transit combined with recurring asphalt breakdown.',
          recurring_infrastructure_defect: 'Cavity washaway',
        },
      ],
      historical_comparisons: {
        trend_narrative: 'Complaints increased 12% compared to prior equivalent window.',
        accelerating_concerns: ['Drainage overflows during pre-monsoon showers'],
        improving_areas: ['Garbage clearance resolution time in Malleshwaram'],
      },
      recommended_inspection_priorities: [
        {
          priority: 1,
          department: 'Roads and Infrastructure',
          action: 'Conduct deep sub-base core excavation joint with Water Supply Department',
          urgency: 'Immediate',
          rationale: 'Stop recurring asphalt surface failures at Indiranagar Metro Pillar 82',
        },
      ],
      grounded_citations: ['CM-2026-00101', 'CM-2026-00450', 'CM-2026-00501', 'CM-2026-00507'],
    };

    setGeminiClient({
      models: {
        generateContent: async () => ({
          text: JSON.stringify(mockGeminiReport),
        }),
      },
    });

    const generateRes = await fetch(`${baseUrl}/intelligence/reports/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${officialCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        time_period: '30d',
      }),
    });

    assert(generateRes.status === 201, '7a. Generated AI municipal intelligence report (201 Created)');
    const genData = await generateRes.json();
    const createdReport = genData.report;
    assert(createdReport && createdReport.id, '7b. Created report has UUID');
    assert(createdReport.content.major_civic_concerns.length > 0, '7c. Report contains structured major civic concerns');
    assert(createdReport.content.grounded_citations.length > 0, '7d. Report contains grounded citations');

    // -------------------------------------------------------------
    // Test 8: Report Retrieval & Archive
    // -------------------------------------------------------------
    const listReportsRes = await fetch(`${baseUrl}/intelligence/reports`, {
      headers: { 'Cookie': `civic_token=${adminCookie}` },
    });
    assert(listReportsRes.status === 200, '8a. Fetched reports archive list');
    const listData = await listReportsRes.json();
    assert(listData.reports.some((r) => r.id === createdReport.id), '8b. Newly generated report appears in archive list');

    const singleReportRes = await fetch(`${baseUrl}/intelligence/reports/${createdReport.id}`, {
      headers: { 'Cookie': `civic_token=${officialCookie}` },
    });
    assert(singleReportRes.status === 200, '8c. Fetched individual report by ID');
    const singleData = await singleReportRes.json();
    assert(singleData.report.id === createdReport.id, '8d. Retrieved report matches created report ID');

    // -------------------------------------------------------------
    // Test 9: Multi-Format Report Export (Printable HTML, Markdown, JSON)
    // -------------------------------------------------------------
    // HTML / PDF View Export
    const htmlExportRes = await fetch(`${baseUrl}/intelligence/reports/${createdReport.id}/export?format=html`, {
      headers: { 'Cookie': `civic_token=${officialCookie}` },
    });
    assert(htmlExportRes.status === 200, '9a. Exported report as HTML (200 OK)');
    assert(htmlExportRes.headers.get('content-type').includes('text/html'), '9b. HTML export Content-Type is text/html');
    const htmlText = await htmlExportRes.text();
    assert(htmlText.includes('@media print') && htmlText.includes('window.print()'), '9c. HTML export includes print stylesheet and print trigger');

    // Markdown Export
    const mdExportRes = await fetch(`${baseUrl}/intelligence/reports/${createdReport.id}/export?format=md`, {
      headers: { 'Cookie': `civic_token=${adminCookie}` },
    });
    assert(mdExportRes.status === 200, '9d. Exported report as Markdown (200 OK)');
    assert(mdExportRes.headers.get('content-type').includes('text/markdown'), '9e. Markdown export Content-Type is text/markdown');
    const mdText = await mdExportRes.text();
    assert(mdText.includes('# CivicMemory — Municipal Intelligence Dossier'), '9f. Markdown export contains formatted report markdown');

    // JSON Export
    const jsonExportRes = await fetch(`${baseUrl}/intelligence/reports/${createdReport.id}/export?format=json`, {
      headers: { 'Cookie': `civic_token=${adminCookie}` },
    });
    assert(jsonExportRes.status === 200, '9g. Exported report as JSON (200 OK)');
    const jsonData = await jsonExportRes.json();
    assert(jsonData.id === createdReport.id, '9h. JSON export contains valid report JSON payload');

    // -------------------------------------------------------------
    // Test 10: In-Memory 5-Minute Cache Validation
    // -------------------------------------------------------------
    const cacheRes1 = await fetch(`${baseUrl}/intelligence/overview?period=7d`, {
      headers: { 'Cookie': `civic_token=${adminCookie}` },
    });
    const data1 = await cacheRes1.json();
    assert(data1.source === 'database', '10a. First request reads from database');

    const cacheRes2 = await fetch(`${baseUrl}/intelligence/overview?period=7d`, {
      headers: { 'Cookie': `civic_token=${adminCookie}` },
    });
    const data2 = await cacheRes2.json();
    assert(data2.source === 'cache', '10b. Second identical request served from in-memory cache');

  } catch (err) {
    console.error('Unhandled test exception:', err);
    failed++;
  } finally {
    resetGeminiClient();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  console.log('\n====================================================================');
  console.log(`Historical Intelligence Tests Completed: ${passed} passed, ${failed} failed`);
  console.log('====================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runHistoricalCivicIntelligenceTestSuite();
