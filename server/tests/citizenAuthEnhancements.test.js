import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../src/index.js';
import db from '../src/config/database.js';
import { getTestOtp } from '../src/services/otpService.js';

test('CivicMemory — Citizen Registration, Dual OTP Verification & Forgot Password Test Suite', async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  t.after(() => {
    server.close();
  });

  const uniqueSuffix = Date.now();
  const testCitizenEmail = `citizen.verify.${uniqueSuffix}@example.com`;
  // Generate a unique 10-digit Indian phone number starting with 9
  const testCitizenPhone = '9' + String(uniqueSuffix).slice(-9);
  const testCitizenPassword = 'CitizenSecure2026!';

  let registrationId = '';
  let emailOtp = '';
  let mobileOtp = '';

  // =========================================================================
  // SECTION 1: CITIZEN REGISTRATION VALIDATION & ADDRESS HANDLING
  // =========================================================================
  await t.test('1.1 Registration validation rejects invalid phone numbers and missing PIN code', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        full_name: 'Test Citizen',
        email: `invalid.${uniqueSuffix}@example.com`,
        phone: '12345', // Invalid phone
        password: testCitizenPassword,
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '5600', // Invalid 4-digit PIN
      }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.details.phone, 'Expected phone validation error');
    assert.ok(data.details.pin_code, 'Expected pin_code validation error');
  });

  await t.test('1.2 Registration handles phone conflict with existing user via anti-enumeration uniform response', async () => {
    // Attempt registration using seeded Arjun's phone number
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        full_name: 'Conflict Phone User',
        email: `unique.email.${uniqueSuffix}@example.com`,
        phone: '9811110001', // Seeded Arjun's phone
        password: testCitizenPassword,
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });

    assert.equal(res.status, 200, 'Duplicate registration returns 200 (anti-enumeration)');
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.registration_id);
    assert.equal(data.message, 'Verification codes have been dispatched to your email and mobile number.');

    // Ensure no pending registration was created
    const pending = db.prepare('SELECT id FROM citizen_pending_registrations WHERE id = ?').get(data.registration_id);
    assert.equal(pending, undefined, 'No pending registration record created for duplicate');
  });

  await t.test('1.3 Registration initiates dual OTP dispatch and creates pending record with address', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        full_name: 'Arjun Verification Test',
        email: testCitizenEmail,
        phone: testCitizenPhone,
        password: testCitizenPassword,
        confirm_password: testCitizenPassword,
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'Bruhat Bengaluru Mahanagara Palike (BBMP)',
        locality: 'Indiranagar',
        street: '12th Main Road, HAL 2nd Stage',
        pin_code: '560038',
        house_number: 'Flat 302, Sun Villa',
        landmark: 'Opposite Metro Pillar 84',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.registration_id);
    assert.ok(data.email_masked);
    assert.ok(data.phone_masked);
    assert.equal(data.resend_cooldown_seconds, 60);

    registrationId = data.registration_id;

    // Verify stored pending record in database
    const pending = db.prepare('SELECT * FROM citizen_pending_registrations WHERE id = ?').get(registrationId);
    assert.ok(pending);
    assert.equal(pending.email, testCitizenEmail.toLowerCase());
    assert.equal(pending.phone, testCitizenPhone);
    assert.equal(pending.state, 'Karnataka');
    assert.equal(pending.district, 'Bengaluru Urban');
    assert.equal(pending.ulb, 'Bruhat Bengaluru Mahanagara Palike (BBMP)');
    assert.equal(pending.locality, 'Indiranagar');
    assert.equal(pending.street, '12th Main Road, HAL 2nd Stage');
    assert.equal(pending.pin_code, '560038');
    assert.equal(pending.house_number, 'Flat 302, Sun Villa');
    assert.equal(pending.landmark, 'Opposite Metro Pillar 84');
    assert.equal(pending.email_verified, 0);
    assert.equal(pending.mobile_verified, 0);

    // Verify user is NOT yet created in active users table
    const unverifiedUser = db.prepare('SELECT id FROM users WHERE email = ?').get(testCitizenEmail);
    assert.equal(unverifiedUser, undefined, 'Unverified citizen must not exist in users table');

    // Retrieve dispatched OTPs from test dispatcher
    emailOtp = getTestOtp(testCitizenEmail);
    mobileOtp = getTestOtp(testCitizenPhone);
    assert.ok(emailOtp && emailOtp.length === 6, 'Email OTP should be 6 digits');
    assert.ok(mobileOtp && mobileOtp.length === 6, 'Mobile OTP should be 6 digits');
  });

  // =========================================================================
  // SECTION 2: DUAL OTP VERIFICATION, ATTEMPTS & COOLDOWN
  // =========================================================================
  await t.test('2.1 Resend cooldown prevents spamming within 60 seconds', async () => {
    const res = await fetch(`${baseUrl}/auth/register/resend-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        registration_id: registrationId,
        type: 'both',
      }),
    });

    assert.equal(res.status, 429);
    const data = await res.json();
    assert.ok(data.retry_after_seconds > 0);
  });

  await t.test('2.2 Verification rejects when both email and mobile OTPs are invalid', async () => {
    const res = await fetch(`${baseUrl}/auth/register/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        registration_id: registrationId,
        email_otp: '000000', // Wrong email OTP
        mobile_otp: '000000', // Wrong mobile OTP
      }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /Both Email and Mobile/i);
    assert.equal(data.email_verified, false);
    assert.equal(data.mobile_verified, false);

    const pending = db.prepare('SELECT email_otp_attempts, mobile_otp_attempts FROM citizen_pending_registrations WHERE id = ?').get(registrationId);
    assert.equal(pending.email_otp_attempts, 1);
    assert.equal(pending.mobile_otp_attempts, 1);
  });

  await t.test('2.3 Verification rejects invalid mobile OTP even when email OTP is correct', async () => {
    const res = await fetch(`${baseUrl}/auth/register/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        registration_id: registrationId,
        email_otp: emailOtp, // Correct email OTP
        mobile_otp: '999999', // Wrong mobile OTP
      }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /Mobile/i);
    assert.equal(data.email_verified, true);
    assert.equal(data.mobile_verified, false);
  });

  await t.test('2.4 Dual verification succeeds, activates citizen account, and deletes pending record', async () => {
    const res = await fetch(`${baseUrl}/auth/register/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        registration_id: registrationId,
        email_otp: emailOtp,
        mobile_otp: mobileOtp,
      }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.user.email, testCitizenEmail.toLowerCase());
    assert.equal(data.user.role, 'citizen');

    // Confirm account is now in users table with residential address
    const userInDb = db.prepare('SELECT * FROM users WHERE email = ?').get(testCitizenEmail.toLowerCase());
    assert.ok(userInDb);
    assert.equal(userInDb.is_active, 1);
    assert.equal(userInDb.role, 'citizen');
    assert.equal(userInDb.state, 'Karnataka');
    assert.equal(userInDb.district, 'Bengaluru Urban');
    assert.equal(userInDb.ulb, 'Bruhat Bengaluru Mahanagara Palike (BBMP)');
    assert.equal(userInDb.locality, 'Indiranagar');
    assert.equal(userInDb.street, '12th Main Road, HAL 2nd Stage');
    assert.equal(userInDb.pin_code, '560038');

    // Confirm single-use consumption: pending record must be deleted
    const pendingDeleted = db.prepare('SELECT id FROM citizen_pending_registrations WHERE id = ?').get(registrationId);
    assert.equal(pendingDeleted, undefined, 'Pending registration record must be deleted upon successful dual verification');

    // Confirm audit log event CITIZEN_REGISTERED
    const audit = db.prepare('SELECT * FROM audit_logs WHERE target_id = ? AND action = ?').get(userInDb.id, 'CITIZEN_REGISTERED');
    assert.ok(audit, 'Audit log event CITIZEN_REGISTERED must be created');

    // Verify newly registered citizen can login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        email: testCitizenEmail,
        password: testCitizenPassword,
      }),
    });

    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.equal(loginData.user.email, testCitizenEmail.toLowerCase());
  });

  // =========================================================================
  // SECTION 3: FORGOT PASSWORD WORKFLOW & SESSION INVALIDATION
  // =========================================================================
  let resetId = '';
  let resetToken = '';
  const newSecurePassword = 'NewCitizenPassword99#';

  await t.test('3.1 Forgot password returns anti-enumeration generic response for non-existent user', async () => {
    const res = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        identifier: 'nonexistent.user.99128@example.com',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.reset_id);
    assert.ok(data.contact_masked);
  });

  await t.test('3.2 Forgot password initiates recovery for registered citizen email', async () => {
    const res = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        identifier: testCitizenEmail,
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.reset_id);
    assert.equal(data.contact_type, 'email');
    assert.ok(data.contact_masked.includes('*'));

    resetId = data.reset_id;

    // Verify record in password_reset_requests
    const resetReq = db.prepare('SELECT * FROM password_reset_requests WHERE id = ?').get(resetId);
    assert.ok(resetReq);
    assert.equal(resetReq.contact_type, 'email');
  });

  await t.test('3.3 Verify reset OTP rejects wrong code and enforces max attempts', async () => {
    const wrongRes = await fetch(`${baseUrl}/auth/forgot-password/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        reset_id: resetId,
        otp: '111111',
      }),
    });

    assert.equal(wrongRes.status, 400);
    const wrongData = await wrongRes.json();
    assert.match(wrongData.error, /invalid/i);
    assert.ok(wrongData.attempts_remaining >= 0);
  });

  await t.test('3.4 Verify reset OTP succeeds with valid code and generates reset token', async () => {
    const recoveryOtp = getTestOtp(testCitizenEmail);
    assert.ok(recoveryOtp, 'Recovery OTP should have been captured in test store');

    const res = await fetch(`${baseUrl}/auth/forgot-password/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        reset_id: resetId,
        otp: recoveryOtp,
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.reset_token);
    resetToken = data.reset_token;
  });

  await t.test('3.5 Reset password enforces complexity policy and matching passwords', async () => {
    const weakRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        reset_token: resetToken,
        new_password: 'weak',
        confirm_password: 'weak',
      }),
    });

    assert.equal(weakRes.status, 400);

    const mismatchRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        reset_token: resetToken,
        new_password: newSecurePassword,
        confirm_password: 'DifferentPassword123!',
      }),
    });

    assert.equal(mismatchRes.status, 400);
  });

  await t.test('3.6 Successful password reset updates password, revokes sessions, and records audit log', async () => {
    // Obtain pre-reset session token
    const preLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        email: testCitizenEmail,
        password: testCitizenPassword,
      }),
    });
    const preCookie = preLoginRes.headers.get('set-cookie');
    assert.ok(preCookie);

    // Ensure session worked prior to reset
    const preMeRes = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Cookie: preCookie,
      },
    });
    assert.equal(preMeRes.status, 200);

    // Wait a brief tick (e.g. 1100ms) to ensure updated_at timestamp advances past JWT iat
    await new Promise((r) => setTimeout(r, 1100));

    // Execute password reset
    const resetRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        reset_token: resetToken,
        new_password: newSecurePassword,
        confirm_password: newSecurePassword,
      }),
    });

    assert.equal(resetRes.status, 200);
    const resetData = await resetRes.json();
    assert.equal(resetData.success, true);

    // Old password must now be rejected
    const oldLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        email: testCitizenEmail,
        password: testCitizenPassword,
      }),
    });
    assert.equal(oldLoginRes.status, 401, 'Old password must be rejected after password reset');

    // New password must succeed
    const newLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        email: testCitizenEmail,
        password: newSecurePassword,
      }),
    });
    assert.equal(newLoginRes.status, 200, 'New password must succeed');

    // Pre-existing session cookie must now be rejected by authMiddleware due to session revocation / password update
    const postMeRes = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Cookie: preCookie,
      },
    });
    assert.equal(postMeRes.status, 401, 'Pre-reset session must be rejected after password reset');

    // Check audit log for PASSWORD_RESET without leaked OTP or password
    const userInDb = db.prepare('SELECT id FROM users WHERE email = ?').get(testCitizenEmail.toLowerCase());
    const resetAudit = db.prepare('SELECT * FROM audit_logs WHERE target_id = ? AND action = ?').get(userInDb.id, 'PASSWORD_RESET');
    assert.ok(resetAudit, 'Audit log event PASSWORD_RESET must be created');
    assert.ok(!resetAudit.details.includes(newSecurePassword), 'Audit log must not contain plaintext password');
    assert.ok(!resetAudit.details.includes('CitizenSecure'), 'Audit log must not contain old plaintext password');
  });

  // =========================================================================
  // SECTION 4: PRESERVATION OF SEEDED ACCOUNTS
  // =========================================================================
  await t.test('4.1 Seeded citizen, official and admin accounts remain fully operational', async () => {
    const personas = [
      { email: 'citizen.arjun@civicmemory.local', password: 'Citizen@Civic2026!', role: 'citizen' },
      { email: 'official.roads@civicmemory.local', password: 'Official@Civic2026!', role: 'official' },
      { email: 'admin@civicmemory.local', password: 'Admin@Civic2026!', role: 'admin' },
    ];

    for (const persona of personas) {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
        },
        body: JSON.stringify({
          email: persona.email,
          password: persona.password,
        }),
      });

      assert.equal(res.status, 200, `Login failed for seeded persona ${persona.email}`);
      const data = await res.json();
      assert.equal(data.user.role, persona.role);
    }
  });
});
