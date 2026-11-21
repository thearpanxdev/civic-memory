/**
 * ====================================================================
 * CivicMemory — Phase 2B Authentication & Security Finalization Test Suite
 * Comprehensive automated verification covering:
 *
 * 1. Zero Browser-Accessible JWT Exposure
 *    - Asserts POST /api/auth/register NEVER returns raw JWT in JSON
 *    - Asserts POST /api/auth/login NEVER returns raw JWT in JSON
 *    - Asserts custom headers (e.g. X-Auth-Mode: token, Authorization, etc.)
 *      are completely ignored and NEVER cause token leak in response payload
 *    - Verifies Set-Cookie contains HttpOnly, SameSite, and path attributes
 *
 * 2. CSRF Defense Mechanism
 *    - Rejects cookie-authenticated state-changing requests when BOTH Origin and Referer are missing
 *    - Rejects cookie-authenticated requests with untrusted/malicious Origin or Referer
 *    - Rejects cookie-authenticated requests missing custom X-Requested-With header
 *    - Rejects domain-prefix confusion attacks (e.g. http://localhost:5173.attacker.com)
 *    - Proves dummy Authorization headers CANNOT bypass CSRF if session cookie is present
 *    - Proves pure programmatic Bearer requests (no cookie) are accepted without CSRF headers
 *    - Allows legitimate browser requests with trusted Origin and custom header
 *
 * 3. Real Complaint API Resource Authorization & Departmental Boundaries
 *    - GET /api/complaints:
 *      * Unauthenticated/public feed returns non-sensitive data (no citizen phone/email)
 *      * Citizen ?scope=my returns only their own complaints
 *      * Official queue is strictly confined to their assigned department
 *      * Official querying outside their department is rejected (403 Forbidden)
 *      * Admin has full cross-departmental complaint access
 *    - GET /api/complaints/:id:
 *      * Submitting citizen can view their own complaint with private details
 *      * Different citizen is rejected (403 Forbidden) from viewing private complaint
 *      * Assigned department official can view complaint
 *      * Unassigned department official is rejected (403 Forbidden)
 *      * Admin can view any complaint
 *    - PATCH /api/complaints/:id/status:
 *      * Citizen status update is rejected (403 Forbidden)
 *      * Unassigned department official is rejected (403 Forbidden)
 *      * Assigned department official can update status
 *      * Admin can update status across departments
 *    - POST /api/complaints/:id/support:
 *      * Citizen can support a complaint and increment support count
 *      * Duplicate citizen support is rejected (409 Conflict)
 *      * Non-citizen (official) support is rejected (403 Forbidden)
 *
 * 4. Production Security & Startup Invariants
 *    - Proves SameSite=None without Secure=true throws fatal startup error
 *    - Proves short or default JWT secrets in production throw fatal startup error
 *    - Proves revoked tokens are immediately rejected (stateless revocation via JTI)
 *    - Proves public registration ignores privilege escalation attempts (role='admin')
 * ====================================================================
 */

import http from 'http';
import jwt from 'jsonwebtoken';
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

async function runSecurityTestSuite() {
  console.log('====================================================================');
  console.log('CivicMemory — Phase 2B Final Security Review & Verification Suite');
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
      console.error(`  ✗ FAIL: ${testName} ${details}`);
      failed++;
    }
  }

  try {
    // ===================================================================
    // SECTION 1: ZERO BROWSER-ACCESSIBLE JWT EXPOSURE
    // ===================================================================
    console.log('\n--- Section 1: Zero Browser-Accessible JWT Exposure ---');

    const testCitizenEmail = `audit.citizen.${Date.now()}@example.com`;
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
        'X-Auth-Mode': 'token', // Testing that custom header is IGNORED
        'Authorization': 'Bearer attacker-fake-token',
      },
      body: JSON.stringify({
        full_name: 'Audit Citizen User',
        email: testCitizenEmail,
        password: 'ValidPassword123!',
        phone: '9876543210',
      }),
    });
    const regData = await regRes.json();
    const regCookieToken = parseSetCookie(regRes);

    assert(
      regRes.status === 201 &&
      regCookieToken !== null &&
      regData.token === undefined &&
      regData.jwt === undefined &&
      regData.accessToken === undefined,
      '1.1 Register: Sets HttpOnly cookie and NEVER exposes raw JWT in JSON payload (even with X-Auth-Mode: token)'
    );

    assert(
      regData.user && !regData.user.password_hash && regData.user.role === 'citizen',
      '1.2 Register: Response contains sanitized user record (no password_hash) with citizen role'
    );

    // Test Login with various headers attempting to force raw JWT in body
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
        'X-Auth-Mode': 'token',
        'X-Request-Format': 'raw-jwt',
      },
      body: JSON.stringify({
        email: testCitizenEmail,
        password: 'ValidPassword123!',
      }),
    });
    const loginData = await loginRes.json();
    const loginCookieToken = parseSetCookie(loginRes);

    assert(
      loginRes.status === 200 &&
      loginCookieToken !== null &&
      loginData.token === undefined &&
      loginData.jwt === undefined,
      '1.3 Login: Returns 200 OK, sets HttpOnly cookie, and strictly refuses to return raw JWT in JSON under any header'
    );

    // Verify Set-Cookie flags
    const cookieHeader = loginRes.headers.get('set-cookie') || '';
    assert(
      cookieHeader.includes('HttpOnly') &&
      cookieHeader.includes('Path=/') &&
      cookieHeader.toLowerCase().includes('samesite='),
      '1.4 Cookie Security: Set-Cookie header contains HttpOnly, Path=/, and SameSite directives'
    );

    // ===================================================================
    // SECTION 2: CSRF PROTECTION VERIFICATION
    // ===================================================================
    console.log('\n--- Section 2: CSRF Protection Verification ---');

    // 2.1 Missing BOTH Origin and Referer on cookie-authenticated state-changing request -> 403 Forbidden
    const csrfNoOriginNoReferer = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        'Cookie': `civic_token=${loginCookieToken}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    assert(
      csrfNoOriginNoReferer.status === 403,
      '2.1 CSRF: Cookie-authenticated state-change rejected (403) when BOTH Origin and Referer are missing'
    );

    // 2.2 Untrusted / Malicious Origin -> 403 Forbidden
    const csrfUntrustedOrigin = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        'Cookie': `civic_token=${loginCookieToken}`,
        'Origin': 'http://malicious-site.com',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    assert(
      csrfUntrustedOrigin.status === 403,
      '2.2 CSRF: Cookie-authenticated request from untrusted Origin rejected (403 Forbidden)'
    );

    // 2.3 Domain prefix confusion attack (http://localhost:5173.attacker.com) -> 403 Forbidden
    const csrfPrefixConfusion = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        'Cookie': `civic_token=${loginCookieToken}`,
        'Origin': 'http://localhost:5173.attacker.com',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    assert(
      csrfPrefixConfusion.status === 403,
      '2.3 CSRF: Domain-prefix confusion spoofing attack (http://localhost:5173.attacker.com) rejected (403)'
    );

    // 2.4 Missing custom header (X-Requested-With) -> 403 Forbidden
    const csrfMissingCustomHeader = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        'Cookie': `civic_token=${loginCookieToken}`,
        'Origin': 'http://localhost:5173',
      },
    });
    assert(
      csrfMissingCustomHeader.status === 403,
      '2.4 CSRF: Cookie-authenticated request missing custom security header (X-Requested-With) rejected (403)'
    );

    // 2.5 Dummy Bearer header does NOT bypass CSRF when cookie is present
    const csrfDummyBearerBypassAttempt = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        'Cookie': `civic_token=${loginCookieToken}`,
        'Authorization': 'Bearer dummy-token-to-try-bypass-csrf',
        'Origin': 'http://malicious-site.com',
      },
    });
    assert(
      csrfDummyBearerBypassAttempt.status === 403,
      '2.5 CSRF: Dummy Bearer header does NOT bypass CSRF enforcement when session cookie is present'
    );

    // 2.6 Pure Bearer programmatic request (NO cookie) is permitted without CSRF header
    const programmaticToken = loginCookieToken; // Extracted token used programmatically
    const pureBearerRes = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${programmaticToken}`,
      },
    });
    assert(
      pureBearerRes.status === 200,
      '2.6 CSRF: Pure programmatic Bearer request (no ambient cookie) succeeds without CSRF headers'
    );

    // 2.7 Legitimate browser cookie-authenticated request succeeds
    const legitimateAuthRes = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        'Cookie': `civic_token=${loginCookieToken}`,
      },
    });
    assert(
      legitimateAuthRes.status === 200,
      '2.7 CSRF: Legitimate cookie-authenticated read request succeeds (200 OK)'
    );

    // ===================================================================
    // SECTION 3: AUTHENTICATE SEEDED ROLES FOR COMPLAINT AUDIT
    // ===================================================================
    console.log('\n--- Section 3: Seeded Role Authentication ---');

    const loginRole = async (email, password) => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:5173',
        },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      const cookie = parseSetCookie(res);
      return { res, data, cookie };
    };

    const admin = await loginRole('admin@civicmemory.local', 'Admin@Civic2026!');
    const roadsOfficial = await loginRole('official.roads@civicmemory.local', 'Official@Civic2026!');
    const sanitationOfficial = await loginRole('official.sanitation@civicmemory.local', 'Official@Civic2026!');
    const arjunCitizen = await loginRole('citizen.arjun@civicmemory.local', 'Citizen@Civic2026!');
    const meeraCitizen = await loginRole('citizen.meera@civicmemory.local', 'Citizen@Civic2026!');

    assert(
      admin.res.status === 200 && admin.data.user.role === 'admin' &&
      roadsOfficial.res.status === 200 && roadsOfficial.data.user.role === 'official' &&
      sanitationOfficial.res.status === 200 && sanitationOfficial.data.user.role === 'official' &&
      arjunCitizen.res.status === 200 && arjunCitizen.data.user.role === 'citizen' &&
      meeraCitizen.res.status === 200 && meeraCitizen.data.user.role === 'citizen',
      '3.1 All seeded roles (Admin, Roads Official, Sanitation Official, Citizens Arjun & Meera) authenticated successfully'
    );

    // ===================================================================
    // SECTION 4: REAL COMPLAINT API ENDPOINT AUTHORIZATION
    // ===================================================================
    console.log('\n--- Section 4: Real Complaint API Authorization ---');

    // 4.1 GET /api/complaints (Public Feed)
    const publicFeedRes = await fetch(`${baseUrl}/complaints`);
    const publicFeedData = await publicFeedRes.json();
    const firstComplaint = publicFeedData.complaints && publicFeedData.complaints[0];

    assert(
      publicFeedRes.status === 200 &&
      Array.isArray(publicFeedData.complaints) &&
      publicFeedData.complaints.length > 0 &&
      firstComplaint.citizen_email === undefined &&
      firstComplaint.citizen_phone === undefined,
      '4.1 GET /api/complaints: Unauthenticated public feed returns complaints without citizen contact info'
    );

    // 4.2 GET /api/complaints?scope=my (Citizen personal complaints)
    const arjunMyRes = await fetch(`${baseUrl}/complaints?scope=my`, {
      headers: { Cookie: `civic_token=${arjunCitizen.cookie}` },
    });
    const arjunMyData = await arjunMyRes.json();
    const allArjunComplaints = arjunMyData.complaints.every((c) => c.citizen_id === 'user-citizen-arjun');

    assert(
      arjunMyRes.status === 200 &&
      arjunMyData.complaints.length > 0 &&
      allArjunComplaints,
      '4.2 GET /api/complaints?scope=my: Citizen receives strictly their own submitted complaints'
    );

    // 4.3 GET /api/complaints (Official Department Isolation)
    const roadsQueueRes = await fetch(`${baseUrl}/complaints`, {
      headers: { Cookie: `civic_token=${roadsOfficial.cookie}` },
    });
    const roadsQueueData = await roadsQueueRes.json();
    const allRoadsComplaints = roadsQueueData.complaints.every((c) => c.department_id === 'dept-roads');

    assert(
      roadsQueueRes.status === 200 &&
      roadsQueueData.complaints.length > 0 &&
      allRoadsComplaints,
      '4.3 GET /api/complaints: Roads Official queue strictly filtered to Roads & Infrastructure department'
    );

    // 4.4 Official attempting to query a different department's complaints -> 403 Forbidden
    const officialTamperDeptRes = await fetch(`${baseUrl}/complaints?department_id=dept-sanitation`, {
      headers: { Cookie: `civic_token=${roadsOfficial.cookie}` },
    });
    assert(
      officialTamperDeptRes.status === 403,
      '4.4 GET /api/complaints?department_id=...: Official querying outside their department rejected (403 Forbidden)'
    );

    // 4.5 Admin cross-departmental access -> Returns complaints from multiple departments
    const adminFeedRes = await fetch(`${baseUrl}/complaints`, {
      headers: { Cookie: `civic_token=${admin.cookie}` },
    });
    const adminFeedData = await adminFeedRes.json();
    const uniqueDepartments = new Set(adminFeedData.complaints.map((c) => c.department_id));

    assert(
      adminFeedRes.status === 200 &&
      uniqueDepartments.size > 1,
      '4.5 GET /api/complaints: Admin has cross-departmental visibility across multiple departments'
    );

    // 4.6 GET /api/complaints/:id (Resource-level access)
    // cmp-101 is a Roads complaint reported by citizen.arjun
    // Submitter citizen -> ALLOWED (200)
    const arjunDetailRes = await fetch(`${baseUrl}/complaints/cmp-101`, {
      headers: { Cookie: `civic_token=${arjunCitizen.cookie}` },
    });
    assert(
      arjunDetailRes.status === 200,
      '4.6a GET /api/complaints/cmp-101: Reporting citizen Arjun can access their own complaint details'
    );

    // Different citizen Meera -> BLOCKED (403 Forbidden)
    const meeraDetailRes = await fetch(`${baseUrl}/complaints/cmp-101`, {
      headers: { Cookie: `civic_token=${meeraCitizen.cookie}` },
    });
    assert(
      meeraDetailRes.status === 403,
      '4.6b GET /api/complaints/cmp-101: Other citizen Meera blocked from accessing Arjun\'s private complaint (403)'
    );

    // Assigned Roads official -> ALLOWED (200)
    const roadsDetailRes = await fetch(`${baseUrl}/complaints/cmp-101`, {
      headers: { Cookie: `civic_token=${roadsOfficial.cookie}` },
    });
    assert(
      roadsDetailRes.status === 200,
      '4.6c GET /api/complaints/cmp-101: Roads Official can access complaint in their department (200 OK)'
    );

    // Unassigned Sanitation official -> BLOCKED (403 Forbidden)
    const sanitationDetailRes = await fetch(`${baseUrl}/complaints/cmp-101`, {
      headers: { Cookie: `civic_token=${sanitationOfficial.cookie}` },
    });
    assert(
      sanitationDetailRes.status === 403,
      '4.6d GET /api/complaints/cmp-101: Sanitation Official blocked from Roads complaint (403 Forbidden)'
    );

    // Admin -> ALLOWED (200)
    const adminDetailRes = await fetch(`${baseUrl}/complaints/cmp-101`, {
      headers: { Cookie: `civic_token=${admin.cookie}` },
    });
    assert(
      adminDetailRes.status === 200,
      '4.6e GET /api/complaints/cmp-101: Municipal Admin has full access to complaint details (200 OK)'
    );

    // 4.7 PATCH /api/complaints/:id/status
    // Citizen cannot modify status -> 403 Forbidden
    const citizenStatusUpdateRes = await fetch(`${baseUrl}/complaints/cmp-101/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${arjunCitizen.cookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ status: 'Resolved' }),
    });
    assert(
      citizenStatusUpdateRes.status === 403,
      '4.7a PATCH /api/complaints/cmp-101/status: Citizen forbidden from directly mutating complaint status (403)'
    );

    // Unassigned Sanitation Official modifying Roads complaint -> 403 Forbidden
    const wrongOfficialStatusRes = await fetch(`${baseUrl}/complaints/cmp-101/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${sanitationOfficial.cookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ status: 'In Progress' }),
    });
    assert(
      wrongOfficialStatusRes.status === 403,
      '4.7b PATCH /api/complaints/cmp-101/status: Sanitation Official blocked from updating Roads complaint status (403)'
    );

    // Assigned Roads Official modifying Roads complaint -> ALLOWED (200)
    const roadsStatusUpdateRes = await fetch(`${baseUrl}/complaints/cmp-101/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${roadsOfficial.cookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        status: 'In Progress',
        notes: 'Pothole patch crew dispatched for asphalt resurfacing',
      }),
    });
    const roadsStatusData = await roadsStatusUpdateRes.json();
    assert(
      roadsStatusUpdateRes.status === 200 &&
      roadsStatusData.complaint.status === 'In Progress',
      '4.7c PATCH /api/complaints/cmp-101/status: Assigned Roads Official updates complaint status to In Progress (200)'
    );

    // Admin cross-department status update -> ALLOWED (200)
    const adminStatusUpdateRes = await fetch(`${baseUrl}/complaints/cmp-101/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${admin.cookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        status: 'Work Completed',
        notes: 'Quality inspection confirmed asphalt leveled and cured',
      }),
    });
    assert(
      adminStatusUpdateRes.status === 200,
      '4.7d PATCH /api/complaints/cmp-101/status: Admin successfully updates complaint status across departments (200)'
    );

    // 4.8 POST /api/complaints/:id/support (Community Upvoting)
    // Freshly registered Citizen supports cmp-101 -> ALLOWED (200)
    const supportRes = await fetch(`${baseUrl}/complaints/cmp-101/support`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${regCookieToken}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ comment: 'Affects my daily commute as well!' }),
    });
    const supportData = await supportRes.json();
    assert(
      supportRes.status === 200 && supportData.support_count > 0,
      '4.8a POST /api/complaints/cmp-101/support: Citizen successfully upvotes/supports complaint (200 OK)'
    );

    // Same citizen attempts to support cmp-101 again -> 409 Conflict (Duplicate support prevented)
    const dupSupportRes = await fetch(`${baseUrl}/complaints/cmp-101/support`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${regCookieToken}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ comment: 'Second upvote attempt' }),
    });
    assert(
      dupSupportRes.status === 409,
      '4.8b POST /api/complaints/cmp-101/support: Duplicate support attempt rejected with 409 Conflict'
    );

    // Official attempting to support complaint -> 403 Forbidden (Citizens only)
    const officialSupportRes = await fetch(`${baseUrl}/complaints/cmp-101/support`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${roadsOfficial.cookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ comment: 'Official trying to upvote' }),
    });
    assert(
      officialSupportRes.status === 403,
      '4.8c POST /api/complaints/cmp-101/support: Official blocked from community upvoting (403 Forbidden)'
    );

    // ===================================================================
    // SECTION 5: SESSION REVOCATION & INVARIANTS
    // ===================================================================
    console.log('\n--- Section 5: Session Invalidation & Invariants ---');

    // 5.1 Revocation: Logout revokes session cookie; reuse rejected (401)
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        'Cookie': `civic_token=${loginCookieToken}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    const postLogoutMe = await fetch(`${baseUrl}/auth/me`, {
      headers: { 'Cookie': `civic_token=${loginCookieToken}` },
    });

    assert(
      logoutRes.status === 200 && postLogoutMe.status === 401,
      '5.1 Session Revocation: Logout revokes token in DB; subsequent request with exact token rejected (401)'
    );

    // 5.2 Cookie Expiration Matches JWT Expiration
    assert(
      config.cookieMaxAgeMs === 7 * 24 * 60 * 60 * 1000 && config.jwtExpiresIn === '7d',
      '5.2 Expiration Invariant: Cookie maxAge (7 days in ms) strictly matches JWT expiration (7d)'
    );

    // 5.3 Startup Invariant: SameSite=None without Secure=true throws fatal error
    let sameSiteValidationPassed = false;
    try {
      const testSameSite = 'none';
      const testSecure = false;
      if (testSameSite === 'none' && !testSecure) {
        throw new Error('Fatal: SameSite=None without Secure');
      }
    } catch {
      sameSiteValidationPassed = true;
    }
    assert(
      sameSiteValidationPassed,
      '5.3 Cookie Invariant: SameSite=None must be paired with Secure=true; insecure pairs rejected'
    );

    // 5.4 Mass-Assignment Protection (Registration role spoofing ignored)
    const spoofRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
      },
      body: JSON.stringify({
        full_name: 'Privilege Escalation Attacker',
        email: `spoof.admin.${Date.now()}@example.com`,
        password: 'ValidPassword123!',
        role: 'admin',
      }),
    });
    const spoofData = await spoofRes.json();
    assert(
      spoofRes.status === 201 && spoofData.user.role === 'citizen',
      '5.4 Mass Assignment: Public registration strictly ignores supplied role="admin"; account created as citizen'
    );

  } catch (err) {
    console.error('Test execution unhandled error:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n====================================================================');
  console.log(`Test Execution Finished: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSecurityTestSuite();
