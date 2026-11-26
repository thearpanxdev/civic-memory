/**
 * ====================================================================
 * CivicMemory — AI-Powered Automatic Municipal Department Routing Test Suite
 *
 * Automated verification for:
 * 1. AI Classification & Routing across civic domains (Roads, Drainage, Sanitation, Lighting, Water).
 * 2. Dynamic SQLite-backed prompt assembly (no hardcoded departments in prompts).
 * 3. Ambiguity & Manual Review Thresholds (confidence < 75 or explicit manual review flag).
 * 4. Priority Management (Low, Medium, High, Critical public safety hazards).
 * 5. Official Complaint Acceptance (formal acknowledgment boundary).
 * 6. Department Reassignment Workflow (preserves original AI recommendation + audit trail).
 * 7. Admin Department Management (CRUD + toggle active/inactive).
 * 8. Strict Role-Based Security & Audit Trail Inspection.
 * ====================================================================
 */

import http from 'http';
import app from '../src/index.js';
import db from '../src/config/database.js';
import { setGeminiClient, resetGeminiClient } from '../src/services/geminiService.js';
import {
  getActiveDepartments,
  buildDepartmentRoutingPrompt,
  matchDepartment,
  classifyAndRouteComplaint,
} from '../src/services/departmentRoutingService.js';

let server;
let baseUrl;

function parseSetCookie(res) {
  const cookieHeader = res.headers.get('set-cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/civic_token=([^;]+)/);
  return match ? match[1] : null;
}

export async function runDepartmentRoutingTestSuite() {
  console.log('====================================================================');
  console.log('CivicMemory — Department Routing & AI Dispatch Test Suite');
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
      console.error(`  ✗ FAIL: ${testName} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  try {
    // ---------------------------------------------------------------
    // 0. Login & Session Setup
    // ---------------------------------------------------------------
    console.log('--- Phase 0: User Session Setup ---');

    // Admin
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@civicmemory.local', password: 'Admin@Civic2026!' }),
    });
    const adminToken = parseSetCookie(adminLoginRes);
    assert(adminLoginRes.status === 200 && adminToken, 'Admin logs in successfully');

    // Official Roads
    const roadsLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'official.roads@civicmemory.local', password: 'Official@Civic2026!' }),
    });
    const roadsToken = parseSetCookie(roadsLoginRes);
    assert(roadsLoginRes.status === 200 && roadsToken, 'Roads Official logs in successfully');

    // Official Sanitation
    const sanLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'official.sanitation@civicmemory.local', password: 'Official@Civic2026!' }),
    });
    const sanToken = parseSetCookie(sanLoginRes);
    assert(sanLoginRes.status === 200 && sanToken, 'Sanitation Official logs in successfully');

    // Citizen Arjun
    const citizenLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'citizen.arjun@civicmemory.local', password: 'Citizen@Civic2026!' }),
    });
    const citizenToken = parseSetCookie(citizenLoginRes);
    assert(citizenLoginRes.status === 200 && citizenToken, 'Citizen logs in successfully');

    const authHeaders = (token) => ({
      Cookie: `civic_token=${token}`,
      Origin: 'http://localhost:5173',
      'X-Requested-With': 'XMLHttpRequest',
    });

    // ---------------------------------------------------------------
    // 1. Dynamic Prompt Construction & Department Matching
    // ---------------------------------------------------------------
    console.log('\n--- Phase 1: Dynamic Prompt Assembly & SQLite Grounding ---');

    const activeDepts = getActiveDepartments(db);
    assert(activeDepts.length >= 5, 'Retrieves active departments from SQLite', `Count: ${activeDepts.length}`);

    const promptSample = buildDepartmentRoutingPrompt(
      {
        title: 'Deep road crater',
        description: 'Vehicles damaged near signal',
        category: 'Roads and Infrastructure',
        address: '100ft Road',
      },
      activeDepts
    );

    assert(promptSample.includes('<available_departments>'), 'Prompt wraps available departments in XML block');
    assert(promptSample.includes('dept-roads'), 'Prompt dynamically includes Roads department');
    assert(promptSample.includes('dept-sanitation'), 'Prompt dynamically includes Sanitation department');
    assert(promptSample.includes('dept-drainage'), 'Prompt dynamically includes Drainage department');
    assert(promptSample.includes('dept-lighting'), 'Prompt dynamically includes Lighting department');
    assert(promptSample.includes('dept-water'), 'Prompt dynamically includes Water department');

    const matchedRoads = matchDepartment('ROADS', activeDepts);
    assert(matchedRoads && matchedRoads.id === 'dept-roads', 'Matches department by code (ROADS)');

    const matchedDrainage = matchDepartment('Drainage and Sewerage', activeDepts);
    assert(matchedDrainage && matchedDrainage.id === 'dept-drainage', 'Matches department by exact name');

    const matchedWater = matchDepartment('Water Supply Department', activeDepts);
    assert(matchedWater && matchedWater.id === 'dept-water', 'Matches department by substring name');

    // ---------------------------------------------------------------
    // 2. Automated AI Department Classification & Complaint Creation
    // ---------------------------------------------------------------
    console.log('\n--- Phase 2: AI Classification & Routing on Submission ---');

    // Scenario 2A: High-confidence Road Damage Complaint
    const mockRoadsClient = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            recommended_department: 'Roads and Infrastructure',
            secondary_department: null,
            routing_reason: 'Issue concerns road crater and damaged pavement on municipal arterial road.',
            priority: 'High',
            confidence_score: 95,
            requires_manual_review: false,
          }),
        }),
      },
    };
    setGeminiClient(mockRoadsClient);

    const roadCompRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: { ...authHeaders(citizenToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Dangerous asphalt crater on 80ft Road',
        description: 'Large asphalt depression causing two-wheelers to swerve into oncoming traffic.',
        category: 'Roads and Infrastructure',
        ward_id: 'ward-indiranagar',
        latitude: 12.9785,
        longitude: 77.6409,
        address: '80ft Road, Indiranagar',
        severity: 'high',
        duplicate_of_id: 'none',
      }),
    });

    const roadCompData = await roadCompRes.json();
    assert(roadCompRes.status === 201, 'Submits high-confidence road complaint', roadCompData.error);
    const roadComp = roadCompData.complaint;
    assert(roadComp.department_id === 'dept-roads', 'Assigned department is dept-roads');
    assert(roadComp.recommended_department_id === 'dept-roads', 'Recommended department is dept-roads');
    assert(roadComp.routing_status === 'auto_routed', 'Routing status is auto_routed');
    assert(roadComp.requires_manual_review === 0, 'Requires manual review is 0');
    assert(roadComp.priority === 'High', 'Priority set to High');
    assert(roadComp.accepted_by_user_id === null, 'Authority has not accepted yet (invariant maintained)');

    // Verify routing audit trail in SQLite
    const roadAudit = db.prepare('SELECT * FROM department_routing_audit WHERE complaint_id = ?').get(roadComp.id);
    assert(roadAudit !== undefined, 'Department routing audit record created');
    assert(roadAudit && roadAudit.assigned_by_type === 'system_ai', 'Audit recorded assigned_by_type as system_ai');
    assert(roadAudit && roadAudit.confidence_score === 95, 'Audit recorded confidence score 95');

    // Scenario 2B: Ambiguous / Low-Confidence Complaint (< 75 confidence)
    const mockAmbiguousClient = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            recommended_department: 'Drainage and Sewerage',
            secondary_department: 'Roads and Infrastructure',
            routing_reason: 'Water stagnation observed, but citizen mentions broken road curb and possible pipe leak.',
            priority: 'Medium',
            confidence_score: 65,
            requires_manual_review: true,
          }),
        }),
      },
    };
    setGeminiClient(mockAmbiguousClient);

    const ambigRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: { ...authHeaders(citizenToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Water pooling near street curb',
        description: 'Vague accumulation of water near the footpath, not sure if pipe burst or drain overflow.',
        category: 'Drainage and sewage',
        ward_id: 'ward-koramangala',
        latitude: 12.9352,
        longitude: 77.6245,
        address: '5th Block, Koramangala',
        severity: 'medium',
        duplicate_of_id: 'none',
      }),
    });

    const ambigData = await ambigRes.json();
    assert(ambigRes.status === 201, 'Submits ambiguous complaint');
    const ambigComp = ambigData.complaint;
    assert(ambigComp.requires_manual_review === 1, 'Low confidence flagged requires_manual_review = 1');
    assert(ambigComp.routing_status === 'manual_review_required', 'Routing status is manual_review_required');
    assert(ambigComp.secondary_department_id === 'dept-roads', 'Secondary department recorded as dept-roads');

    // Scenario 2C: Critical Life Safety Hazard (Urgent Priority)
    const mockCriticalClient = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            recommended_department: 'Street Lighting',
            secondary_department: 'Drainage and Sewerage',
            routing_reason: 'Live electrical cable snapped from pole submerged in pedestrian water puddle.',
            priority: 'Critical',
            confidence_score: 98,
            requires_manual_review: false,
          }),
        }),
      },
    };
    setGeminiClient(mockCriticalClient);

    const critRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: { ...authHeaders(citizenToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Snapped live electrical cable in flooded puddle',
        description: 'Sparks flying from hanging wire on light pole into rainwater on pedestrian walkway.',
        category: 'Streetlight failure',
        ward_id: 'ward-indiranagar',
        latitude: 12.9789,
        longitude: 77.6415,
        address: '100ft Road corner',
        severity: 'critical',
        duplicate_of_id: 'none',
      }),
    });

    const critData = await critRes.json();
    assert(critRes.status === 201, 'Submits critical safety hazard complaint');
    assert(critData.complaint.priority === 'Critical', 'Complaint assigned Critical priority');
    assert(critData.complaint.department_id === 'dept-lighting', 'Routed to Street Lighting department');

    // ---------------------------------------------------------------
    // 3. Official Complaint Acceptance Workflow
    // ---------------------------------------------------------------
    console.log('\n--- Phase 3: Official Complaint Acceptance Boundary ---');

    // Official of Roads accepts roadComp
    const acceptRes = await fetch(`${baseUrl}/official/complaints/${roadComp.id}/accept`, {
      method: 'POST',
      headers: { ...authHeaders(roadsToken), 'Content-Type': 'application/json' },
    });

    const acceptData = await acceptRes.json();
    assert(acceptRes.status === 200, 'Roads official accepts road complaint', acceptData.error);
    assert(acceptData.complaint.accepted_by_user_id !== null, 'Accepted by user ID is populated');
    assert(acceptData.complaint.status === 'Assigned', 'Status updated to Assigned upon acceptance');

    // Duplicate acceptance rejected idempotently
    const reAcceptRes = await fetch(`${baseUrl}/official/complaints/${roadComp.id}/accept`, {
      method: 'POST',
      headers: { ...authHeaders(roadsToken), 'Content-Type': 'application/json' },
    });
    assert(reAcceptRes.status === 400, 'Duplicate acceptance is safely rejected (400)');

    // Official of Sanitation attempting to accept a Roads complaint is blocked
    const crossAcceptRes = await fetch(`${baseUrl}/official/complaints/${roadComp.id}/accept`, {
      method: 'POST',
      headers: { ...authHeaders(sanToken), 'Content-Type': 'application/json' },
    });
    assert(crossAcceptRes.status === 403, 'Cross-department official blocked from accepting (403)');

    // Citizen attempting to accept is blocked
    const citizenAcceptRes = await fetch(`${baseUrl}/official/complaints/${roadComp.id}/accept`, {
      method: 'POST',
      headers: { ...authHeaders(citizenToken), 'Content-Type': 'application/json' },
    });
    assert(citizenAcceptRes.status === 403, 'Citizen blocked from accepting complaints (403)');

    // ---------------------------------------------------------------
    // 4. Department Reassignment Workflow
    // ---------------------------------------------------------------
    console.log('\n--- Phase 4: Department Reassignment & AI Recommendation Preservation ---');

    // Reassign roadComp from Roads to Sanitation
    const reassignRes = await fetch(`${baseUrl}/official/complaints/${roadComp.id}/reassign-department`, {
      method: 'POST',
      headers: { ...authHeaders(roadsToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_department_id: 'dept-sanitation',
        reassignment_reason: 'Garbage dump blocking drain mouth, sanitation team required for unblocking.',
      }),
    });

    const reassignData = await reassignRes.json();
    assert(reassignRes.status === 200, 'Roads official reassigns complaint to Sanitation', reassignData.error);
    assert(reassignData.complaint.department_id === 'dept-sanitation', 'Current department updated to dept-sanitation');

    // Check that SQLite preserved the original recommendation and recorded reassignment
    const reassignedComp = db.prepare('SELECT * FROM complaints WHERE id = ?').get(roadComp.id);
    assert(
      reassignedComp.recommended_department_id === 'dept-roads',
      'Preserves original AI recommended_department_id (dept-roads)'
    );
    assert(reassignedComp.routing_status === 'manually_assigned', 'Routing status is manually_assigned');
    assert(reassignedComp.requires_manual_review === 0, 'Requires manual review cleared after reassignment');

    // Check audit trail
    const auditRows = db.prepare('SELECT * FROM department_routing_audit WHERE complaint_id = ? ORDER BY created_at ASC').all(roadComp.id);
    assert(auditRows.length === 2, 'Audit trail contains 2 entries (AI routing + human reassignment)');
    const latestAudit = auditRows[auditRows.length - 1];
    assert(latestAudit.assigned_by_type === 'official', 'Latest audit records assigned_by_type as official');
    assert(latestAudit.reassignment_reason.includes('Garbage dump blocking'), 'Audit preserves reassignment reason');

    // Reassignment validation errors
    const shortReasonRes = await fetch(`${baseUrl}/official/complaints/${roadComp.id}/reassign-department`, {
      method: 'POST',
      headers: { ...authHeaders(adminToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_department_id: 'dept-roads',
        reassignment_reason: 'bad', // < 5 chars
      }),
    });
    assert(shortReasonRes.status === 400, 'Reassignment with short reason is rejected (400)');

    const sameDeptRes = await fetch(`${baseUrl}/official/complaints/${roadComp.id}/reassign-department`, {
      method: 'POST',
      headers: { ...authHeaders(adminToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_department_id: 'dept-sanitation', // already sanitation
        reassignment_reason: 'Reassigning to same department test',
      }),
    });
    assert(sameDeptRes.status === 400, 'Reassigning to the same department is rejected (400)');

    // ---------------------------------------------------------------
    // 5. Admin Department Management CRUD & Activation Toggle
    // ---------------------------------------------------------------
    console.log('\n--- Phase 5: Admin Department Management CRUD & Status Toggle ---');

    // Admin creates new department
    const createDeptRes = await fetch(`${baseUrl}/admin/departments`, {
      method: 'POST',
      headers: { ...authHeaders(adminToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Parks and Horticulture',
        code: 'PARKS',
        description: 'Upkeep and maintenance of public parks, gardens, and urban tree canopy.',
        responsibilities: 'Pruning hazardous tree branches, municipal park lawns, playground upkeep.',
        routing_rules: 'park, tree branch, fallen tree, garden, playground equipment, horticulture',
        is_active: 1,
      }),
    });

    const createDeptData = await createDeptRes.json();
    assert(createDeptRes.status === 201, 'Admin creates Parks and Horticulture department', createDeptData.error);
    const newDeptId = createDeptData.department?.id;
    assert(newDeptId !== undefined, 'Generated department ID is valid');

    // Non-admin blocked from creating department
    const citizenCreateDeptRes = await fetch(`${baseUrl}/admin/departments`, {
      method: 'POST',
      headers: { ...authHeaders(citizenToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Unauthorized Dept', code: 'UNAUTH' }),
    });
    assert(citizenCreateDeptRes.status === 403, 'Citizen blocked from creating department (403)');

    // Admin updates department
    const updateDeptRes = await fetch(`${baseUrl}/admin/departments/${newDeptId}`, {
      method: 'PUT',
      headers: { ...authHeaders(adminToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Updated comprehensive park maintenance and urban greening.',
        routing_rules: 'park, tree branch, garden, playground, urban forest',
      }),
    });
    assert(updateDeptRes.status === 200, 'Admin updates department details');

    // Admin deactivates department
    const deactRes = await fetch(`${baseUrl}/admin/departments/${newDeptId}/status`, {
      method: 'PATCH',
      headers: { ...authHeaders(adminToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: false }),
    });
    const deactData = await deactRes.json();
    assert(deactRes.status === 200, 'Admin deactivates department');
    assert(deactData.department.is_active === 0, 'Department is_active is 0');

    // Deactivated department is excluded from getActiveDepartments()
    const activeAfterDeact = getActiveDepartments(db);
    assert(
      !activeAfterDeact.some((d) => d.id === newDeptId),
      'Deactivated department excluded from active AI routing pool'
    );

    // Reassignment to inactive department is rejected
    const reassignInactiveRes = await fetch(`${baseUrl}/official/complaints/${roadComp.id}/reassign-department`, {
      method: 'POST',
      headers: { ...authHeaders(adminToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_department_id: newDeptId,
        reassignment_reason: 'Testing reassignment to inactive department',
      }),
    });
    assert(reassignInactiveRes.status === 400, 'Reassignment to inactive department rejected (400)');

    // Admin reactivates department
    const reactRes = await fetch(`${baseUrl}/admin/departments/${newDeptId}/status`, {
      method: 'PATCH',
      headers: { ...authHeaders(adminToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: true }),
    });
    assert(reactRes.status === 200, 'Admin reactivates department');

    // ---------------------------------------------------------------
    // 6. Routing History Inspection & Scoping
    // ---------------------------------------------------------------
    console.log('\n--- Phase 6: Routing History & Official Scoping ---');

    // Fetch routing history for roadComp (now in Sanitation)
    const historyRes = await fetch(`${baseUrl}/official/complaints/${roadComp.id}/routing-history`, {
      headers: { ...authHeaders(sanToken) },
    });
    const historyData = await historyRes.json();
    assert(historyRes.status === 200, 'Sanitation official fetches routing history for assigned complaint');
    assert(Array.isArray(historyData.routing_history), 'Routing history is an array');
    assert(historyData.routing_history.length >= 2, 'Routing history contains audit entries');

    // Detail endpoint inspection includes routing_history
    const detailRes = await fetch(`${baseUrl}/official/complaints/${roadComp.id}`, {
      headers: { ...authHeaders(sanToken) },
    });
    const detailData = await detailRes.json();
    assert(detailRes.status === 200, 'Fetches complaint details');
    assert(Array.isArray(detailData.routing_history), 'Complaint detail includes routing_history array');
    assert(detailData.complaint.recommended_department_name !== undefined, 'Includes recommended_department_name');

    // Official Dashboard returns routing metrics & department workload
    const dashRes = await fetch(`${baseUrl}/official/dashboard`, {
      headers: { ...authHeaders(sanToken) },
    });
    const dashData = await dashRes.json();
    assert(dashRes.status === 200, 'Official dashboard returns successfully');
    assert(dashData.metrics.pending_routing_review !== undefined, 'Dashboard metrics include pending_routing_review');
    assert(dashData.metrics.high_or_critical !== undefined, 'Dashboard metrics include high_or_critical');
    assert(Array.isArray(dashData.department_workload), 'Dashboard includes department_workload array');

    console.log('\n====================================================================');
    console.log(`Test Suite Results: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================================\n');
  } finally {
    resetGeminiClient();
    if (server) {
      server.close();
    }
  }

  return { passed, failed };
}

// Direct execution support
if (process.argv[1]?.endsWith('departmentRouting.test.js')) {
  runDepartmentRoutingTestSuite()
    .then(({ failed }) => {
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error('Fatal error running department routing test suite:', err);
      process.exit(1);
    });
}
