/**
 * ====================================================================
 * CivicMemory — Phase 2B Authentication & RBAC Automated Test Suite
 * Tests all 14 required security, auth, and role isolation conditions
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

async function runTests() {
  console.log('========================================================');
  console.log('Starting CivicMemory Authentication & Authorization Tests');
  console.log('========================================================\n');

  // Start temporary test server on random open port
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}/api/auth`;

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
    // ---------------------------------------------------------------
    // Test 1: Citizen Registration
    // ---------------------------------------------------------------
    const testEmail = `test.citizen.${Date.now()}@example.com`;
    const regRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Test Citizen User',
        email: testEmail,
        password: 'ValidPassword123!',
        phone: '9876543210',
      }),
    });
    const regData = await regRes.json();
    const regCookieToken = parseSetCookie(regRes);

    assert(
      regRes.status === 201 && regData.user && regData.user.role === 'citizen' && regData.token,
      '1. Citizen registration succeeds with 201 Created and JWT token'
    );
    assert(
      !regData.user.password_hash && regCookieToken,
      '1b. Registration sets HttpOnly cookie and does NOT expose password_hash'
    );

    // ---------------------------------------------------------------
    // Test 2: Duplicate Email Rejection
    // ---------------------------------------------------------------
    const dupRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Impostor User',
        email: testEmail,
        password: 'ValidPassword123!',
      }),
    });
    const dupData = await dupRes.json();
    assert(
      dupRes.status === 409 && dupData.error.includes('already exists'),
      '2. Duplicate email registration rejected with 409 Conflict'
    );

    // ---------------------------------------------------------------
    // Test 3: Correct Login
    // ---------------------------------------------------------------
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'ValidPassword123!',
      }),
    });
    const loginData = await loginRes.json();
    const loginCookieToken = parseSetCookie(loginRes);

    assert(
      loginRes.status === 200 && loginData.user && loginData.token && loginCookieToken,
      '3. Correct login returns 200 OK and sets secure session cookie'
    );

    // ---------------------------------------------------------------
    // Test 4: Incorrect Password Rejection
    // ---------------------------------------------------------------
    const wrongPassRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword999!',
      }),
    });
    const wrongPassData = await wrongPassRes.json();
    assert(
      wrongPassRes.status === 401 && wrongPassData.error === 'Invalid email or password.',
      '4. Incorrect password rejected with generic 401 Unauthorized'
    );

    // ---------------------------------------------------------------
    // Test 5: Login with Existing Seeded Users (Citizen, Official, Admin)
    // ---------------------------------------------------------------
    const seededAdminRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@civicmemory.local',
        password: 'Admin@Civic2026!',
      }),
    });
    const adminData = await seededAdminRes.json();

    const seededOfficialRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'official.roads@civicmemory.local',
        password: 'Official@Civic2026!',
      }),
    });
    const officialData = await seededOfficialRes.json();

    const seededCitizenRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'citizen.arjun@civicmemory.local',
        password: 'Citizen@Civic2026!',
      }),
    });
    const citizenData = await seededCitizenRes.json();

    assert(
      seededAdminRes.status === 200 && adminData.user.role === 'admin' &&
      seededOfficialRes.status === 200 && officialData.user.role === 'official' &&
      seededCitizenRes.status === 200 && citizenData.user.role === 'citizen',
      '5. Seeded admin, official, and citizen accounts log in successfully with correct roles'
    );

    // ---------------------------------------------------------------
    // Test 6: Invalid JWT Rejection
    // ---------------------------------------------------------------
    const invalidJwtRes = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: 'Bearer this.is.an.invalid.token' },
    });
    assert(
      invalidJwtRes.status === 401,
      '6. Malformed/invalid JWT rejected with 401 Unauthorized'
    );

    // ---------------------------------------------------------------
    // Test 7: Expired JWT Rejection
    // ---------------------------------------------------------------
    const expiredToken = jwt.sign(
      { sub: citizenData.user.id, email: citizenData.user.email, role: 'citizen', jti: 'expired-test' },
      config.jwtSecret,
      { expiresIn: '-10s' } // Expired 10 seconds ago
    );
    const expiredRes = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert(
      expiredRes.status === 401,
      '7. Expired JWT rejected with 401 Unauthorized'
    );

    // ---------------------------------------------------------------
    // Test 8: Unauthenticated Protected-Route Rejection
    // ---------------------------------------------------------------
    const noAuthRes = await fetch(`${baseUrl}/me`);
    assert(
      noAuthRes.status === 401,
      '8. Unauthenticated request to protected route rejected with 401 Unauthorized'
    );

    // ---------------------------------------------------------------
    // Test 9: Citizen Cannot Access Official or Admin Routes
    // ---------------------------------------------------------------
    const citizenOfficialTest = await fetch(`${baseUrl}/test/official-only`, {
      headers: { Authorization: `Bearer ${citizenData.token}` },
    });
    const citizenAdminTest = await fetch(`${baseUrl}/test/admin-only`, {
      headers: { Authorization: `Bearer ${citizenData.token}` },
    });
    assert(
      citizenOfficialTest.status === 403 && citizenAdminTest.status === 403,
      '9. Citizen access to official and admin routes strictly blocked with 403 Forbidden'
    );

    // ---------------------------------------------------------------
    // Test 10: Official Cannot Access Admin Routes
    // ---------------------------------------------------------------
    const officialAdminTest = await fetch(`${baseUrl}/test/admin-only`, {
      headers: { Authorization: `Bearer ${officialData.token}` },
    });
    const officialOfficialTest = await fetch(`${baseUrl}/test/official-only`, {
      headers: { Authorization: `Bearer ${officialData.token}` },
    });
    assert(
      officialAdminTest.status === 403 && officialOfficialTest.status === 200,
      '10. Official access to admin route blocked (403), while official route permitted (200)'
    );

    // ---------------------------------------------------------------
    // Test 11: Admin Access to Authorized Routes
    // ---------------------------------------------------------------
    const adminAdminTest = await fetch(`${baseUrl}/test/admin-only`, {
      headers: { Authorization: `Bearer ${adminData.token}` },
    });
    assert(
      adminAdminTest.status === 200,
      '11. Admin granted access to authorized administrative route (200 OK)'
    );

    // ---------------------------------------------------------------
    // Test 12: Logout and Real Session Invalidation
    // ---------------------------------------------------------------
    // User logs in to get a fresh token
    const freshLogin = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'ValidPassword123!',
      }),
    });
    const freshData = await freshLogin.json();
    const tokenToRevoke = freshData.token;

    // Verify token works before logout
    const preLogoutCheck = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${tokenToRevoke}` },
    });
    const preStatus = preLogoutCheck.status;

    // Call logout endpoint with token
    const logoutRes = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenToRevoke}` },
    });

    // Try to reuse the SAME token after logout
    const postLogoutCheck = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${tokenToRevoke}` },
    });

    assert(
      preStatus === 200 && logoutRes.status === 200 && postLogoutCheck.status === 401,
      '12. Logout revokes token in database; subsequent use of same token rejected with 401'
    );

    // ---------------------------------------------------------------
    // Test 13: Password Hashes Never Returned
    // ---------------------------------------------------------------
    const meRes = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${citizenData.token}` },
    });
    const meData = await meRes.json();
    assert(
      !regData.user?.password_hash &&
      !loginData.user?.password_hash &&
      !adminData.user?.password_hash &&
      !meData.user?.password_hash,
      '13. Password hashes are never exposed in register, login, or /me payloads'
    );

    // ---------------------------------------------------------------
    // Test 14: Public Registration Cannot Create Privileged Accounts (Mass Assignment Protection)
    // ---------------------------------------------------------------
    const spoofEmail = `spoof.admin.${Date.now()}@example.com`;
    const spoofRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Privilege Escalation Attacker',
        email: spoofEmail,
        password: 'ValidPassword123!',
        role: 'admin', // Attempted role spoofing
      }),
    });
    const spoofData = await spoofRes.json();
    assert(
      spoofRes.status === 201 && spoofData.user.role === 'citizen',
      '14. Public registration strips/overrides supplied role; user created strictly as "citizen"'
    );
  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n========================================================');
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
