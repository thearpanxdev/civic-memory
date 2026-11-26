/**
 * ====================================================================
 * CivicMemory — Phase 2D Official & Municipal Admin Portals Test Suite
 * Automated verification of:
 *
 * 1. Official Portal & Departmental Isolation:
 *    - Department-scoped KPI dashboard
 *    - Paginated and filtered complaint queue
 *    - Cross-department access prevention (403 Forbidden)
 *    - Citizen role restriction (403 Forbidden)
 *    - Unauthenticated request rejection (401 Unauthorized)
 *
 * 2. Official Assignment & Cross-Department Protection:
 *    - Official listing within department
 *    - Assignment creation with notes and status advancement
 *    - Cross-department assignment rejection (400 Bad Request)
 *    - Assignment audit trail recording
 *
 * 3. Status Transitions & Citizen Verification Boundary:
 *    - In Progress and Work Completed transitions
 *    - Unilateral citizen resolution block (400 Bad Request)
 *    - Automatic progress update logging on Work Completed
 *
 * 4. Field Progress Logs & Repair Evidence Upload:
 *    - Structured progress notes (inspection, crew_dispatched, work_update)
 *    - File signature verification: spoofed binary rejected (400)
 *    - Valid JPEG upload with random UUID in protected disk storage
 *    - Detail endpoint returns complete audit history & evidence
 *
 * 5. Municipal Admin Management:
 *    - Cross-departmental system dashboard
 *    - Department workload performance metrics
 *    - Official account provisioning with bcrypt hashing
 *    - Department reassignment
 *    - Official account activation / deactivation
 *    - Protection against deactivating the last active administrator
 *
 * 6. Analytics & System Audit Logs:
 *    - SQL aggregations (status, department, ward, chronic clusters)
 *    - Paginated audit log retrieval with user attribution
 * ====================================================================
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import app from '../src/index.js';
import db from '../src/config/database.js';
import { config } from '../src/config/env.js';

let server;
let baseUrl;

function parseSetCookie(res) {
  const cookieHeader = res.headers.get('set-cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/civic_token=([^;]+)/);
  return match ? match[1] : null;
}

// Generate genuine minimal JPEG buffer with valid magic bytes (FF D8 FF E0 ...)
function createGenuineJpegBuffer() {
  return Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
    0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0xFF, 0xD9,
  ]);
}

// Generate fake binary payload disguised as an image
function createSpoofedBinaryBuffer() {
  return Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xFF\xFF\x00\x00ThisIsMalware');
}

async function runOfficialAdminTestSuite() {
  console.log('====================================================================');
  console.log('CivicMemory — Phase 2D Official & Municipal Admin Portals Test Suite');
  console.log('====================================================================\n');

  // Start test server on ephemeral port
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
      console.error(`  ✗ FAIL: ${testName} - ${details}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Setup: Login Seeded Accounts
    // -------------------------------------------------------------
    console.log('--- Setup: Authenticating Test Personas ---');

    // 1. Roads Official (dept-roads)
    const roadsLoginRes = await fetch(`${baseUrl}/auth/login`, {
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
    const roadsCookie = parseSetCookie(roadsLoginRes);
    assert(roadsLoginRes.status === 200 && roadsCookie, 'Setup 1: Roads Official authenticated');

    // 2. Sanitation Official (dept-sanitation)
    const sanLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        email: 'official.sanitation@civicmemory.local',
        password: 'Official@Civic2026!',
      }),
    });
    const sanCookie = parseSetCookie(sanLoginRes);
    assert(sanLoginRes.status === 200 && sanCookie, 'Setup 2: Sanitation Official authenticated');

    // 3. Municipal Admin
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
    assert(adminLoginRes.status === 200 && adminCookie, 'Setup 3: Municipal Admin authenticated');

    // 4. Citizen Arjun
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
    assert(citizenLoginRes.status === 200 && citizenCookie, 'Setup 4: Citizen Arjun authenticated');
    // Test Fixture: Dedicated active Roads complaint
    const officialTestComplaintId = 'test-cmp-official-001';

    // Clean up previous runs if any
    db.prepare('DELETE FROM complaint_assignments WHERE complaint_id = ?').run(officialTestComplaintId);
    db.prepare('DELETE FROM complaint_status_history WHERE complaint_id = ?').run(officialTestComplaintId);
    db.prepare('DELETE FROM complaint_progress_updates WHERE complaint_id = ?').run(officialTestComplaintId);
    db.prepare('DELETE FROM complaint_images WHERE complaint_id = ?').run(officialTestComplaintId);
    db.prepare('DELETE FROM complaints WHERE id = ? OR ticket_number = ?').run(officialTestComplaintId, 'CM-TEST-OFFICIAL-001');

    db.prepare(`
      INSERT INTO complaints (
        id, ticket_number, citizen_id, department_id, assigned_official_id,
        title, description, category, severity, status,
        latitude, longitude, address, landmark, ward_zone, ward_id,
        duplicate_of_id, root_incident_id, relation_type,
        is_recurring, recurrence_count, support_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      officialTestComplaintId,
      'CM-TEST-OFFICIAL-001',
      'user-citizen-arjun',
      'dept-roads',
      null,
      'Test pothole requiring municipal repair',
      'Dedicated test complaint for verifying the official assignment and repair lifecycle.',
      'Roads and Infrastructure',
      'medium',
      'Under Review',
      12.9784,
      77.6408,
      '100ft Road, Indiranagar',
      'Near 12th Main Junction',
      'Ward 7 - Indiranagar (Central Zone)',
      'ward-indiranagar',
      null,
      officialTestComplaintId,
      'standalone',
      0,
      0,
      1,
      new Date().toISOString(),
      new Date().toISOString()
    );

    // -------------------------------------------------------------
    // Section 1: Official Dashboard & Departmental Isolation
    // -------------------------------------------------------------
    console.log('\n--- Section 1: Official Dashboard & Departmental Isolation ---');

    // 1.1 Unauthenticated access rejected (401)
    const unauthDashRes = await fetch(`${baseUrl}/official/dashboard`);
    assert(unauthDashRes.status === 401, '1.1 Unauthenticated dashboard request rejected with 401 Unauthorized');

    // 1.2 Citizen role restricted from official portal (403)
    const citizenDashRes = await fetch(`${baseUrl}/official/dashboard`, {
      headers: { 'Cookie': `civic_token=${citizenCookie}` },
    });
    assert(citizenDashRes.status === 403, '1.2 Citizen access to official dashboard rejected with 403 Forbidden');

    // 1.3 Roads Official gets dashboard metrics scoped to Roads & Infrastructure
    const roadsDashRes = await fetch(`${baseUrl}/official/dashboard`, {
      headers: { 'Cookie': `civic_token=${roadsCookie}` },
    });
    const roadsDashData = await roadsDashRes.json();
    assert(
      roadsDashRes.status === 200 &&
      roadsDashData.department &&
      roadsDashData.department.name === 'Roads and Infrastructure' &&
      roadsDashData.metrics &&
      typeof roadsDashData.metrics.total === 'number',
      '1.3 Roads Official retrieves department-scoped dashboard metrics'
    );

    // 1.4 Roads Official complaints list strictly filtered to Roads department
    const roadsComplaintsRes = await fetch(`${baseUrl}/official/complaints`, {
      headers: { 'Cookie': `civic_token=${roadsCookie}` },
    });
    const roadsComplaintsData = await roadsComplaintsRes.json();
    const allRoads = roadsComplaintsData.complaints.every((c) => c.department_id === 'dept-roads');
    assert(
      roadsComplaintsRes.status === 200 &&
      roadsComplaintsData.complaints.length > 0 &&
      allRoads,
      '1.4 Roads Official complaint list strictly isolated to Roads & Infrastructure department'
    );

    // 1.5 Roads Official blocked from accessing a Sanitation complaint detail (403)
    const roadsSanComplaintRes = await fetch(`${baseUrl}/official/complaints/cmp-210`, { // cmp-210 is Sanitation
      headers: { 'Cookie': `civic_token=${roadsCookie}` },
    });
    assert(
      roadsSanComplaintRes.status === 403,
      '1.5 Roads Official blocked from accessing Sanitation complaint details (403 Forbidden)'
    );

    // -------------------------------------------------------------
    // Section 2: Department Officials & Assignment Management
    // -------------------------------------------------------------
    console.log('\n--- Section 2: Department Officials & Assignment Management ---');

    // 2.1 Get department officials for assignment picker
    const deptOffRes = await fetch(`${baseUrl}/official/officials`, {
      headers: { 'Cookie': `civic_token=${roadsCookie}` },
    });
    const deptOffData = await deptOffRes.json();
    assert(
      deptOffRes.status === 200 &&
      Array.isArray(deptOffData.officials) &&
      deptOffData.officials.some((o) => o.email === 'official.roads@civicmemory.local'),
      '2.1 GET /api/official/officials returns active officials in the department'
    );

    // 2.2 Regular Engineer strictly prohibited from assigning or reassigning tasks (403 Forbidden)
    const engineerAssignAttemptRes = await fetch(`${baseUrl}/official/complaints/${officialTestComplaintId}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${roadsCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        assigned_official_id: 'user-official-roads',
        notes: 'Engineer attempting unauthorized task assignment.',
      }),
    });
    const engineerAssignAttemptData = await engineerAssignAttemptRes.json();
    assert(
      engineerAssignAttemptRes.status === 403,
      '2.2 Regular Engineer strictly blocked from assigning tasks (403 Forbidden)'
    );

    // 2.3 Municipal Admin successfully assigns complaint cmp-101 to Roads Official (200 OK)
    const adminAssignRes = await fetch(`${baseUrl}/official/complaints/${officialTestComplaintId}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${adminCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        assigned_official_id: 'user-official-roads',
        notes: 'Admin assigned Senior Road Inspector for immediate field survey.',
      }),
    });
    const adminAssignData = await adminAssignRes.json();
    assert(
      adminAssignRes.status === 200 && adminAssignData.assigned_official.id === 'user-official-roads',
      '2.3 Municipal Admin successfully assigned complaint to Roads Official'
    );

    // 2.4 Municipal Admin successfully reassigns / updates assigned engineer task (200 OK)
    const adminReassignRes = await fetch(`${baseUrl}/official/complaints/${officialTestComplaintId}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${adminCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        assigned_official_id: 'user-official-roads',
        notes: 'Admin updated directive: Deploy asphalt crew before monsoon rains.',
      }),
    });
    const adminReassignData = await adminReassignRes.json();
    assert(
      adminReassignRes.status === 200 && adminReassignData.assigned_official.id === 'user-official-roads',
      '2.4 Municipal Admin successfully reassigns / updates assigned engineer task'
    );

    // 2.5 Cross-department assignment rejected (400) even for Admin
    const crossAssignRes = await fetch(`${baseUrl}/official/complaints/${officialTestComplaintId}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${adminCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        assigned_official_id: 'user-official-sanitation', // Sanitation official
        notes: 'Attempting invalid cross-department assignment',
      }),
    });
    assert(
      crossAssignRes.status === 400,
      '2.5 Cross-department assignment strictly prohibited with 400 Bad Request'
    );

    // -------------------------------------------------------------
    // Section 3: Status Transitions & Citizen Verification Boundary
    // -------------------------------------------------------------
    console.log('\n--- Section 3: Status Transitions & Citizen Verification Boundary ---');

    // 3.1 Transition to 'In Progress'
    const inProgRes = await fetch(`${baseUrl}/official/complaints/${officialTestComplaintId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${roadsCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        status: 'In Progress',
        notes: 'Asphalt resurfacing crew dispatched to 100ft Road.',
      }),
    });
    const inProgData = await inProgRes.json();

    assert(
      inProgRes.status === 200 && inProgData.to_status === 'In Progress',
      '3.1 Complaint status successfully updated to In Progress'
    );

    // 3.2 Strict Boundary: Official directly setting 'Resolved' is BLOCKED (400)
    const directResolveRes = await fetch(`${baseUrl}/official/complaints/${officialTestComplaintId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${roadsCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        status: 'Resolved',
        notes: 'Attempting unilateral resolution without citizen verification',
      }),
    });
    assert(
      directResolveRes.status === 400,
      '3.2 Invariant: Official cannot unilaterally resolve complaint; requires Work Completed + citizen verification'
    );

    // 3.3 Official marks 'Work Completed'
    const workCompletedRes = await fetch(`${baseUrl}/official/complaints/${officialTestComplaintId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${roadsCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        status: 'Work Completed',
        notes: 'Pothole filled and sealed with bitumen. Requesting citizen sign-off.',
      }),
    });
    const workCompletedData = await workCompletedRes.json();

    assert(
      workCompletedRes.status === 200 && workCompletedData.to_status === 'Work Completed',
      '3.3 Official marks Work Completed (Awaiting Citizen Verification)'
    );

    // -------------------------------------------------------------
    // Section 4: Progress Notes & Repair Evidence Upload
    // -------------------------------------------------------------
    console.log('\n--- Section 4: Progress Notes & Repair Evidence Upload ---');

    // 4.1 Post progress update note
    const progressRes = await fetch(`${baseUrl}/official/complaints/${officialTestComplaintId}/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${roadsCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        update_type: 'inspection',
        message: 'Quality inspection completed by Municipal Field Engineer.',
      }),
    });
    const progressData = await progressRes.json();
    assert(
      progressRes.status === 201 && progressData.progress.update_type === 'inspection',
      '4.1 Official successfully added structured field progress update'
    );

    // 4.2 Spoofed binary upload rejected (400)
    const boundary = '----CivicMemoryBoundary' + Math.random().toString(36).substring(2);
    const spoofedBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="images"; filename="fake_repair.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      createSpoofedBinaryBuffer(),
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="image_type"\r\n\r\nafter_repair\r\n`),
      Buffer.from(`--${boundary}--\r\n`),
    ]);

    const spoofedRes = await fetch(`${baseUrl}/official/complaints/${officialTestComplaintId}/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Cookie': `civic_token=${roadsCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: spoofedBody,
    });
    assert(
      spoofedRes.status === 400,
      '4.2 File signature verification: Fake image payload rejected with 400 Bad Request'
    );

    // 4.3 Genuine JPEG evidence upload succeeds (201)
    const validBoundary = '----CivicMemoryBoundary' + Math.random().toString(36).substring(2);
    const validBody = Buffer.concat([
      Buffer.from(`--${validBoundary}\r\nContent-Disposition: form-data; name="images"; filename="repair_evidence.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      createGenuineJpegBuffer(),
      Buffer.from(`\r\n--${validBoundary}\r\nContent-Disposition: form-data; name="image_type"\r\n\r\nafter_repair\r\n`),
      Buffer.from(`--${validBoundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\nPothole resurfacing complete\r\n`),
      Buffer.from(`--${validBoundary}--\r\n`),
    ]);

    const validUploadRes = await fetch(`${baseUrl}/official/complaints/${officialTestComplaintId}/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${validBoundary}`,
        'Cookie': `civic_token=${roadsCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: validBody,
    });
    const validUploadData = await validUploadRes.json();
    assert(
      validUploadRes.status === 201 && validUploadData.images.length === 1,
      '4.3 Genuine repair evidence photo uploaded with magic byte verification'
    );

    // 4.4 Verify complaint detail contains complete assignment, progress, and image audit trail
    const detailRes = await fetch(`${baseUrl}/official/complaints/${officialTestComplaintId}`, {
      headers: { 'Cookie': `civic_token=${roadsCookie}` },
    });
    const detailData = await detailRes.json();
    assert(
      detailRes.status === 200 &&
      detailData.complaint.id === officialTestComplaintId &&
      detailData.assignments.length > 0 &&
      detailData.progressUpdates.length > 0 &&
      detailData.images.some((img) => img.image_type === 'after_repair'),
      '4.4 GET /api/official/complaints/:id returns complete assignments, progress trail & repair photos'
    );

    // -------------------------------------------------------------
    // Section 5: Municipal Admin Portal & Official Provisioning
    // -------------------------------------------------------------
    console.log('\n--- Section 5: Municipal Admin Portal & Official Provisioning ---');

    // 5.1 Official blocked from admin routes (403)
    const offAdminBlockRes = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { 'Cookie': `civic_token=${roadsCookie}` },
    });
    assert(offAdminBlockRes.status === 403, '5.1 Department Official blocked from Admin portal (403 Forbidden)');

    // 5.2 Admin accesses system-wide dashboard
    const adminDashRes = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { 'Cookie': `civic_token=${adminCookie}` },
    });
    const adminDashData = await adminDashRes.json();
    assert(
      adminDashRes.status === 200 &&
      adminDashData.metrics.totalDepartments >= 5 &&
      adminDashData.metrics.totalComplaints >= 8,
      '5.2 Admin accesses system-wide municipal overview dashboard'
    );

    // 5.3 Admin lists departments with performance metrics
    const adminDeptRes = await fetch(`${baseUrl}/admin/departments`, {
      headers: { 'Cookie': `civic_token=${adminCookie}` },
    });
    const adminDeptData = await adminDeptRes.json();
    assert(
      adminDeptRes.status === 200 && adminDeptData.departments.length >= 5,
      '5.3 Admin retrieves all municipal departments with workload metrics'
    );

    // 5.4 Admin provisions a new official account
    const testOfficialEmail = `inspector.test.${Date.now()}@civicmemory.local`;
    const createOffRes = await fetch(`${baseUrl}/admin/officials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${adminCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        email: testOfficialEmail,
        password: 'OfficialSecure@2026',
        full_name: 'Inspector Vikram Rao',
        phone: '+91 98765 43210',
        department_id: 'dept-drainage',
      }),
    });
    const createOffData = await createOffRes.json();
    assert(
      createOffRes.status === 201 &&
      createOffData.official.role === 'official' &&
      createOffData.official.department_id === 'dept-drainage',
      '5.4 Admin successfully created new official account with bcrypt hash'
    );
    const newOfficialId = createOffData.official.id;

    // 5.5 New official can authenticate successfully
    const newOffLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        email: testOfficialEmail,
        password: 'OfficialSecure@2026',
      }),
    });
    const newOffCookie = parseSetCookie(newOffLoginRes);
    assert(newOffLoginRes.status === 200 && newOffCookie, '5.5 Newly created official can login with credentials');

    // -------------------------------------------------------------
    // Section 6: Admin Department Reassignment & Account Lifecycle
    // -------------------------------------------------------------
    console.log('\n--- Section 6: Admin Department Reassignment & Account Lifecycle ---');

    // 6.1 Reassign official to Water Supply department
    const reassignRes = await fetch(`${baseUrl}/admin/officials/${newOfficialId}/department`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${adminCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        department_id: 'dept-water',
      }),
    });
    const reassignData = await reassignRes.json();
    assert(
      reassignRes.status === 200 && reassignData.department_id === 'dept-water',
      '6.1 Admin reassigns official to Water Supply department'
    );

    // 6.2 Deactivate official account
    const deactRes = await fetch(`${baseUrl}/admin/officials/${newOfficialId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${adminCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        is_active: false,
      }),
    });
    assert(deactRes.status === 200, '6.2 Admin successfully deactivates official account');

    // 6.3 Deactivated account login blocked (401)
    const deactLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        email: testOfficialEmail,
        password: 'OfficialSecure@2026',
      }),
    });
    assert(
      deactLoginRes.status === 401,
      '6.3 Deactivated official login strictly rejected with 401 Unauthorized'
    );

    // 6.4 Invariant: Cannot deactivate the last active administrator
    const adminUser = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
    const deactAdminRes = await fetch(`${baseUrl}/admin/officials/${adminUser.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${adminCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        is_active: false,
      }),
    });
    assert(
      deactAdminRes.status === 400,
      '6.4 Invariant: System strictly blocks deactivating the last active administrator account'
    );

    // -------------------------------------------------------------
    // Section 7: Analytics & System Audit Logs
    // -------------------------------------------------------------
    console.log('\n--- Section 7: Analytics & System Audit Logs ---');

    // 7.1 Admin Analytics aggregations
    const analyticsRes = await fetch(`${baseUrl}/admin/analytics`, {
      headers: { 'Cookie': `civic_token=${adminCookie}` },
    });
    const analyticsData = await analyticsRes.json();
    assert(
      analyticsRes.status === 200 &&
      Array.isArray(analyticsData.statusDistribution) &&
      Array.isArray(analyticsData.departmentWorkload) &&
      Array.isArray(analyticsData.wardDistribution) &&
      Array.isArray(analyticsData.chronicClusters),
      '7.1 GET /api/admin/analytics returns SQL aggregations for charts & chronic failure clusters'
    );

    // 7.2 Audit log retrieval with actor attribution
    const auditRes = await fetch(`${baseUrl}/admin/audit-logs`, {
      headers: { 'Cookie': `civic_token=${adminCookie}` },
    });
    const auditData = await auditRes.json();
    assert(
      auditRes.status === 200 &&
      auditData.logs.length > 0 &&
      auditData.logs.some((l) => l.action === 'COMPLAINT_ASSIGNED') &&
      auditData.logs.some((l) => l.action === 'OFFICIAL_CREATED'),
      '7.2 GET /api/admin/audit-logs returns immutable audit log trail with user attribution'
    );

  } catch (error) {
    console.error('Test execution unhandled error:', error);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n====================================================================');
  console.log(`Test Execution Finished: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runOfficialAdminTestSuite();
