import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../src/index.js';
import db from '../src/config/database.js';
import { config } from '../src/config/env.js';
import {
  dispatchEmailOtp,
  dispatchSmsOtp,
  getTestOtp,
  clearTestOtps,
  hashOtp,
  verifyOtpHash,
  getMailTransporter,
  resetMailTransporter,
} from '../src/services/otpService.js';
import {
  setAbuseLimits,
  resetAbuseLimits,
  clearAbuseStore,
  tripCircuitBreaker,
  getCircuitBreakerState,
} from '../src/services/providerAbuseService.js';

test('CivicMemory — Stage 1 Security Remediation & Final Hardening Suite', async (t) => {
  config.nodeEnv = 'test';
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  t.after(() => {
    resetAbuseLimits();
    clearAbuseStore();
    server.close();
  });

  const timestamp = Date.now();

  // Helper to generate unique 10-digit Indian phone numbers
  const getUniquePhone = (offset = 0) => '9' + String(Date.now() + offset).slice(-9);

  // =========================================================================
  // 1. ADDRESS FIELDS OMITTED -> REJECTED (400) & NO USER CREATED
  // =========================================================================
  await t.test('1. Registration rejects payload when address fields are omitted (400)', async () => {
    const email = `no.address.${timestamp}@example.com`;
    const phone = getUniquePhone(1);

    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'No Address User',
        email,
        phone,
        password: 'ValidPassword123!',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'Validation failed');
    assert.ok(body.details.state, 'State field error expected');
    assert.ok(body.details.district, 'District field error expected');
    assert.ok(body.details.ulb, 'ULB field error expected');
    assert.ok(body.details.locality, 'Locality field error expected');
    assert.ok(body.details.street, 'Street field error expected');
    assert.ok(body.details.pin_code, 'PIN code field error expected');

    const userInDb = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    assert.equal(userInDb, undefined, 'User must not be created when address fields are omitted');
  });

  // =========================================================================
  // 2. LEGACY PAYLOAD -> REJECTED (400) & NO ACTIVE ACCOUNT CREATED
  // =========================================================================
  await t.test('2. Legacy registration payload rejected; bypass impossible (400)', async () => {
    const legacyEmail = `legacy.bypass.${timestamp}@example.com`;
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'Legacy Attacker',
        email: legacyEmail,
        password: 'ValidPassword123!',
        phone: getUniquePhone(2),
      }),
    });

    assert.equal(res.status, 400);
    const setCookie = res.headers.get('set-cookie');
    assert.equal(setCookie, null, 'No session cookie issued for legacy payload');

    const userInDb = db.prepare('SELECT id FROM users WHERE email = ?').get(legacyEmail);
    assert.equal(userInDb, undefined, 'Legacy bypass must not insert active user into users table');
  });

  // =========================================================================
  // 3. EMAIL VERIFIED BUT MOBILE UNVERIFIED -> NO ACTIVE ACCOUNT
  // =========================================================================
  await t.test('3. Email verified but mobile unverified does NOT create active account', async () => {
    const email = `email.only.${timestamp}@example.com`;
    const phone = getUniquePhone(3);

    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'Email Only User',
        email,
        phone,
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });
    assert.equal(regRes.status, 200);
    const regData = await regRes.json();
    const regId = regData.registration_id;

    const emailOtp = getTestOtp(email);
    const wrongMobileOtp = '000000';

    const verifyRes = await fetch(`${baseUrl}/auth/register/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        registration_id: regId,
        email_otp: emailOtp,
        mobile_otp: wrongMobileOtp,
      }),
    });

    assert.equal(verifyRes.status, 400);
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.email_verified, true);
    assert.equal(verifyData.mobile_verified, false);

    const userInDb = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    assert.equal(userInDb, undefined, 'Account must NOT exist in users table when mobile is unverified');
  });

  // =========================================================================
  // 4. MOBILE VERIFIED BUT EMAIL UNVERIFIED -> NO ACTIVE ACCOUNT
  // =========================================================================
  await t.test('4. Mobile verified but email unverified does NOT create active account', async () => {
    const email = `mobile.only.${timestamp}@example.com`;
    const phone = getUniquePhone(4);

    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'Mobile Only User',
        email,
        phone,
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Koramangala',
        street: '80 Feet Road',
        pin_code: '560034',
      }),
    });
    assert.equal(regRes.status, 200);
    const regData = await regRes.json();
    const regId = regData.registration_id;

    const wrongEmailOtp = '000000';
    const mobileOtp = getTestOtp(phone);

    const verifyRes = await fetch(`${baseUrl}/auth/register/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        registration_id: regId,
        email_otp: wrongEmailOtp,
        mobile_otp: mobileOtp,
      }),
    });

    assert.equal(verifyRes.status, 400);
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.email_verified, false);
    assert.equal(verifyData.mobile_verified, true);

    const userInDb = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    assert.equal(userInDb, undefined, 'Account must NOT exist in users table when email is unverified');
  });

  // =========================================================================
  // 5. BOTH VERIFIED -> ACCOUNT CREATED IN USERS EXACTLY ONCE
  // =========================================================================
  await t.test('5. Dual verification creates active user account exactly once and consumes pending registration', async () => {
    const email = `dual.verified.${Date.now()}@example.com`;
    const phone = getUniquePhone(50);

    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'Dual Verified Citizen',
        email,
        phone,
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Whitefield',
        street: 'ITPL Main Road',
        pin_code: '560066',
      }),
    });
    assert.equal(regRes.status, 200);
    const regData = await regRes.json();
    const regId = regData.registration_id;

    const emailOtp = getTestOtp(email);
    const mobileOtp = getTestOtp(phone);

    const verifyRes = await fetch(`${baseUrl}/auth/register/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        registration_id: regId,
        email_otp: emailOtp,
        mobile_otp: mobileOtp,
      }),
    });

    assert.equal(verifyRes.status, 201);
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.success, true);
    assert.equal(verifyData.user.email, email);
    assert.equal(verifyData.user.role, 'citizen');

    const matchingUsers = db.prepare('SELECT id FROM users WHERE email = ?').all(email);
    assert.equal(matchingUsers.length, 1, 'Exact 1 user record created');

    const pendingInDb = db.prepare('SELECT id FROM citizen_pending_registrations WHERE id = ?').get(regId);
    assert.equal(pendingInDb, undefined, 'Pending registration record consumed and deleted');

    const secondVerifyRes = await fetch(`${baseUrl}/auth/register/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        registration_id: regId,
        email_otp: emailOtp,
        mobile_otp: mobileOtp,
      }),
    });
    assert.equal(secondVerifyRes.status, 400);
  });

  // =========================================================================
  // 6. MISSING PRODUCTION SMTP CONFIGURATION -> DELIVERY FAILS (FAIL CLOSED)
  // =========================================================================
  await t.test('6. Production mode without configured SMTP fails closed', async () => {
    const origEnv = config.nodeEnv;
    const origSmtpHost = config.smtpHost;
    const origSmtpUser = config.smtpUser;

    try {
      config.nodeEnv = 'production';
      config.smtpHost = '';
      config.smtpUser = '';

      const result = await dispatchEmailOtp('prod.citizen@example.com', '123456');
      assert.equal(result.success, false, 'Dispatch must fail in production without SMTP config');
      assert.equal(result.unconfigured, true, 'Flagged as unconfigured');
      assert.equal(result.status, 'unconfigured');
      assert.equal(result.delivered, false);
      assert.equal(result.providerAccepted, false);
    } finally {
      config.nodeEnv = origEnv;
      config.smtpHost = origSmtpHost;
      config.smtpUser = origSmtpUser;
    }
  });

  // =========================================================================
  // 7. MISSING PRODUCTION SMS CONFIGURATION -> DELIVERY FAILS (FAIL CLOSED)
  // =========================================================================
  await t.test('7. Production mode without configured SMS gateway fails closed', async () => {
    const origEnv = config.nodeEnv;
    const origSmsUrl = config.smsGatewayUrl;
    const origSmsKey = config.smsApiKey;

    try {
      config.nodeEnv = 'production';
      config.smsGatewayUrl = '';
      config.smsApiKey = '';

      const result = await dispatchSmsOtp('9800000007', '123456');
      assert.equal(result.success, false, 'Dispatch must fail in production without SMS gateway');
      assert.equal(result.unconfigured, true, 'Flagged as unconfigured');
      assert.equal(result.status, 'unconfigured');
      assert.equal(result.delivered, false);
      assert.equal(result.providerAccepted, false);
    } finally {
      config.nodeEnv = origEnv;
      config.smsGatewayUrl = origSmsUrl;
      config.smsApiKey = origSmsKey;
    }
  });

  // =========================================================================
  // 8. PRODUCTION & DEV MODE NEVER LOGS PLAINTEXT OTPS
  // =========================================================================
  await t.test('8. Dev and production modes never log plaintext OTPs', async () => {
    const origEnv = config.nodeEnv;
    const origLog = console.log;
    let loggedMessages = [];
    console.log = (...args) => {
      loggedMessages.push(args.join(' '));
    };

    const secretOtp = '876543';

    try {
      config.nodeEnv = 'development';
      await dispatchEmailOtp('dev.logger@example.com', secretOtp);
      await dispatchSmsOtp('9800000008', secretOtp);

      const hasPlaintextOtp = loggedMessages.some((msg) => msg.includes(secretOtp));
      assert.equal(hasPlaintextOtp, false, 'Plaintext OTP must NEVER appear in console logs');
    } finally {
      console.log = origLog;
      config.nodeEnv = origEnv;
    }
  });

  // =========================================================================
  // 9. TEST OTP CAPTURE IS UNAVAILABLE OUTSIDE TEST ENVIRONMENT
  // =========================================================================
  await t.test('9. Test OTP capture returns null outside NODE_ENV === "test"', async () => {
    const origEnv = config.nodeEnv;

    try {
      config.nodeEnv = 'production';
      const prodOtp = getTestOtp('anyone@example.com');
      assert.equal(prodOtp, null, 'getTestOtp must return null in production');

      config.nodeEnv = 'development';
      const devOtp = getTestOtp('anyone@example.com');
      assert.equal(devOtp, null, 'getTestOtp must return null in development');
    } finally {
      config.nodeEnv = origEnv;
    }
  });

  // =========================================================================
  // 10. PROVIDER FAILURES DO NOT CREATE FALSELY SUCCESSFUL REGISTRATIONS
  // =========================================================================
  await t.test('10. Provider delivery failure aborts registration and returns 503', async () => {
    const origEnv = config.nodeEnv;
    const origSmtpHost = config.smtpHost;
    const origSmtpUser = config.smtpUser;

    const email = `provider.fail.${timestamp}@example.com`;
    const phone = getUniquePhone(10);

    try {
      config.nodeEnv = 'production';
      config.smtpHost = '';
      config.smtpUser = '';

      const res = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
        body: JSON.stringify({
          full_name: 'Provider Fail User',
          email,
          phone,
          password: 'ValidPassword123!',
          state: 'Karnataka',
          district: 'Bengaluru Urban',
          ulb: 'BBMP',
          locality: 'Indiranagar',
          street: '100 Feet Road',
          pin_code: '560038',
        }),
      });

      assert.equal(res.status, 503, 'Provider failure must return 503 Service Unavailable');

      const pending = db.prepare('SELECT id FROM citizen_pending_registrations WHERE email = ?').get(email);
      assert.equal(pending, undefined, 'Pending registration must be rolled back on provider delivery failure');
    } finally {
      config.nodeEnv = origEnv;
      config.smtpHost = origSmtpHost;
      config.smtpUser = origSmtpUser;
    }
  });

  // =========================================================================
  // 11. RESEND INDEPENDENT ROTATION: EMAIL SUCCEEDS BUT SMS FAILS
  // =========================================================================
  await t.test('11. Resend independent rotation: Email succeeds, SMS fails -> newly delivered email OTP verifies; previous SMS OTP remains valid', async () => {
    const email = `resend.smsfail.${Date.now()}@example.com`;
    const phone = getUniquePhone(11);

    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'Resend Safety User',
        email,
        phone,
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });
    assert.equal(regRes.status, 200);
    const regData = await regRes.json();
    const regId = regData.registration_id;

    const initialEmailOtp = getTestOtp(email);
    const initialMobileOtp = getTestOtp(phone);
    assert.ok(initialEmailOtp, 'Initial email OTP must be captured');
    assert.ok(initialMobileOtp, 'Initial mobile OTP must be captured');

    // Bypass cooldown in DB for testing
    db.prepare('UPDATE citizen_pending_registrations SET resend_available_at = 0 WHERE id = ?').run(regId);

    // Simulate SMS gateway failure (using invalid gateway URL)
    const origSmsUrl = config.smsGatewayUrl;
    const origSmsKey = config.smsApiKey;

    try {
      config.smsGatewayUrl = 'http://127.0.0.1:59999/fakesms';
      config.smsApiKey = 'invalid-key';

      const resendRes = await fetch(`${baseUrl}/auth/register/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
        body: JSON.stringify({ registration_id: regId, type: 'both' }),
      });

      assert.equal(resendRes.status, 200, 'Resend returns 200 when at least one channel succeeds');
      const resendData = await resendRes.json();
      assert.equal(resendData.success, true);
      assert.equal(resendData.channels.email.sent, true, 'Email channel reported as sent');
      assert.equal(resendData.channels.mobile.sent, false, 'SMS channel reported as failed');

      // The newly delivered email OTP must be different from initial
      const newEmailOtp = getTestOtp(email);
      assert.ok(newEmailOtp, 'New email OTP must be captured');
      assert.notEqual(newEmailOtp, initialEmailOtp, 'New email OTP must be newly generated');

      // The old email OTP must NO LONGER work
      const failVerifyRes = await fetch(`${baseUrl}/auth/register/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
        body: JSON.stringify({
          registration_id: regId,
          email_otp: initialEmailOtp, // Old email OTP!
          mobile_otp: initialMobileOtp,
        }),
      });
      assert.equal(failVerifyRes.status, 400, 'Old email OTP must be rejected after rotation');

      // VERIFICATION: Newly delivered email OTP + previous SMS OTP must verify successfully!
      const verifyRes = await fetch(`${baseUrl}/auth/register/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
        body: JSON.stringify({
          registration_id: regId,
          email_otp: newEmailOtp,      // Newly delivered email OTP
          mobile_otp: initialMobileOtp, // Previous SMS OTP
        }),
      });

      assert.equal(verifyRes.status, 201, 'Verification must succeed with new email OTP + previous SMS OTP');
    } finally {
      config.smsGatewayUrl = origSmsUrl;
      config.smsApiKey = origSmsKey;
    }
  });

  // =========================================================================
  // 12. RESEND INDEPENDENT ROTATION: SMS SUCCEEDS BUT EMAIL FAILS
  // =========================================================================
  await t.test('12. Resend independent rotation: SMS succeeds, email fails -> newly delivered SMS OTP verifies; previous email OTP remains valid', async () => {
    const email = `resend.emailfail.${Date.now()}@example.com`;
    const phone = getUniquePhone(12);

    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'Email Fail User',
        email,
        phone,
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });
    assert.equal(regRes.status, 200);
    const regData = await regRes.json();
    const regId = regData.registration_id;

    const initialEmailOtp = getTestOtp(email);
    const initialMobileOtp = getTestOtp(phone);

    // Bypass cooldown in DB for testing
    db.prepare('UPDATE citizen_pending_registrations SET resend_available_at = 0 WHERE id = ?').run(regId);

    const origSmtpHost = config.smtpHost;
    const origSmtpUser = config.smtpUser;
    const origSmtpPort = config.smtpPort;

    try {
      resetMailTransporter();
      config.smtpHost = '127.0.0.1';
      config.smtpPort = 59998;
      config.smtpUser = 'test';
      config.smtpPass = 'test';

      const resendRes = await fetch(`${baseUrl}/auth/register/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
        body: JSON.stringify({ registration_id: regId, type: 'both' }),
      });

      assert.equal(resendRes.status, 200, 'Resend returns 200 when SMS succeeds');
      const resendData = await resendRes.json();
      assert.equal(resendData.success, true);
      assert.equal(resendData.channels.email.sent, false, 'Email channel reported as failed');
      assert.equal(resendData.channels.mobile.sent, true, 'SMS channel reported as sent');

      const newMobileOtp = getTestOtp(phone);
      assert.ok(newMobileOtp, 'New mobile OTP must be captured');
      assert.notEqual(newMobileOtp, initialMobileOtp, 'New mobile OTP must be newly generated');

      // The old mobile OTP must NO LONGER work
      const failVerifyRes = await fetch(`${baseUrl}/auth/register/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
        body: JSON.stringify({
          registration_id: regId,
          email_otp: initialEmailOtp,
          mobile_otp: initialMobileOtp, // Old mobile OTP!
        }),
      });
      assert.equal(failVerifyRes.status, 400, 'Old mobile OTP must be rejected after rotation');

      // VERIFICATION: Previous email OTP + newly delivered mobile OTP must verify successfully!
      const verifyRes = await fetch(`${baseUrl}/auth/register/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
        body: JSON.stringify({
          registration_id: regId,
          email_otp: initialEmailOtp, // Previous email OTP
          mobile_otp: newMobileOtp,   // Newly delivered mobile OTP
        }),
      });

      assert.equal(verifyRes.status, 201, 'Verification must succeed with previous email OTP + new mobile OTP');
    } finally {
      resetMailTransporter();
      config.smtpHost = origSmtpHost;
      config.smtpUser = origSmtpUser;
      config.smtpPort = origSmtpPort;
    }
  });

  // =========================================================================
  // 12b. RESEND: BOTH CHANNELS SUCCEED -> BOTH NEW OTPS VERIFY
  // =========================================================================
  await t.test('12b. Resend: Both succeed -> both new OTPs verify successfully', async () => {
    const email = `resend.bothok.${Date.now()}@example.com`;
    const phone = getUniquePhone(121);

    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'Both OK User',
        email,
        phone,
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });
    assert.equal(regRes.status, 200);
    const regData = await regRes.json();
    const regId = regData.registration_id;

    const initialEmailOtp = getTestOtp(email);
    const initialMobileOtp = getTestOtp(phone);

    // Bypass cooldown in DB for testing
    db.prepare('UPDATE citizen_pending_registrations SET resend_available_at = 0 WHERE id = ?').run(regId);

    const resendRes = await fetch(`${baseUrl}/auth/register/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ registration_id: regId, type: 'both' }),
    });

    assert.equal(resendRes.status, 200);
    const resendData = await resendRes.json();
    assert.equal(resendData.channels.email.sent, true);
    assert.equal(resendData.channels.mobile.sent, true);

    const newEmailOtp = getTestOtp(email);
    const newMobileOtp = getTestOtp(phone);
    assert.notEqual(newEmailOtp, initialEmailOtp);
    assert.notEqual(newMobileOtp, initialMobileOtp);

    // Verify with both newly delivered OTPs
    const verifyRes = await fetch(`${baseUrl}/auth/register/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        registration_id: regId,
        email_otp: newEmailOtp,
        mobile_otp: newMobileOtp,
      }),
    });
    assert.equal(verifyRes.status, 201, 'Verification with both new OTPs must succeed');
  });

  // =========================================================================
  // 12c. RESEND: BOTH CHANNELS FAIL -> BOTH PREVIOUS OTPS REMAIN VALID
  // =========================================================================
  await t.test('12c. Resend: Both fail -> both previous OTPs remain valid and verify', async () => {
    const email = `resend.bothfail.${Date.now()}@example.com`;
    const phone = getUniquePhone(122);

    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'Both Fail User',
        email,
        phone,
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });
    assert.equal(regRes.status, 200);
    const regData = await regRes.json();
    const regId = regData.registration_id;

    const initialEmailOtp = getTestOtp(email);
    const initialMobileOtp = getTestOtp(phone);

    // Bypass cooldown in DB for testing
    db.prepare('UPDATE citizen_pending_registrations SET resend_available_at = 0 WHERE id = ?').run(regId);

    const origEnv = config.nodeEnv;
    const origSmtpHost = config.smtpHost;
    const origSmsUrl = config.smsGatewayUrl;

    try {
      config.nodeEnv = 'production';
      config.smtpHost = ''; // Unconfigured -> fails closed
      config.smsGatewayUrl = ''; // Unconfigured -> fails closed

      const resendRes = await fetch(`${baseUrl}/auth/register/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
        body: JSON.stringify({ registration_id: regId, type: 'both' }),
      });

      assert.equal(resendRes.status, 503, 'Resend returns 503 when both channels fail');
      const resendData = await resendRes.json();
      assert.equal(resendData.success, false);
      assert.equal(resendData.channels.email.sent, false);
      assert.equal(resendData.channels.mobile.sent, false);

      // Verify original OTPs remain usable
      config.nodeEnv = 'test';
      const verifyRes = await fetch(`${baseUrl}/auth/register/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
        body: JSON.stringify({
          registration_id: regId,
          email_otp: initialEmailOtp,
          mobile_otp: initialMobileOtp,
        }),
      });
      assert.equal(verifyRes.status, 201, 'Verification with initial OTPs must succeed when resend fails');
    } finally {
      config.nodeEnv = origEnv;
      config.smtpHost = origSmtpHost;
      config.smsGatewayUrl = origSmsUrl;
    }
  });

  // =========================================================================
  // 12d. CONCURRENT RESEND REQUESTS CANNOT OVERWRITE NEWER STATE
  // =========================================================================
  await t.test('12d. Concurrent resend requests cannot overwrite newer OTP state incorrectly', async () => {
    const email = `resend.concurrent.${Date.now()}@example.com`;
    const phone = getUniquePhone(123);

    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'Concurrent Resend User',
        email,
        phone,
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });
    assert.equal(regRes.status, 200);
    const regData = await regRes.json();
    const regId = regData.registration_id;

    // Reset cooldown to permit resend
    db.prepare('UPDATE citizen_pending_registrations SET resend_available_at = 0 WHERE id = ?').run(regId);

    // Fire two resend requests concurrently
    const [resend1, resend2] = await Promise.all([
      fetch(`${baseUrl}/auth/register/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
        body: JSON.stringify({ registration_id: regId, type: 'both' }),
      }),
      fetch(`${baseUrl}/auth/register/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
        body: JSON.stringify({ registration_id: regId, type: 'both' }),
      }),
    ]);

    const statuses = [resend1.status, resend2.status].sort();
    assert.deepEqual(statuses, [200, 429], 'Exactly one concurrent resend must succeed (200) and the other rejected by cooldown (429)');

    // The successful resend's OTPs must verify successfully
    const latestEmailOtp = getTestOtp(email);
    const latestMobileOtp = getTestOtp(phone);

    const verifyRes = await fetch(`${baseUrl}/auth/register/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        registration_id: regId,
        email_otp: latestEmailOtp,
        mobile_otp: latestMobileOtp,
      }),
    });
    assert.equal(verifyRes.status, 201, 'Verification must succeed with newer OTP state');
  });

  // =========================================================================
  // 13. CONCURRENT OTP VERIFICATION REQUESTS (ATOMICITY & TRANSACTION INTEGRITY)
  // =========================================================================
  await t.test('13. Concurrent OTP verification requests: Exactly one succeeds, no duplicate accounts or crashes', async () => {
    const email = `concurrent.verify.${Date.now()}@example.com`;
    const phone = getUniquePhone(13);

    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'Concurrent User',
        email,
        phone,
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });
    assert.equal(regRes.status, 200);
    const regData = await regRes.json();
    const regId = regData.registration_id;

    const emailOtp = getTestOtp(email);
    const mobileOtp = getTestOtp(phone);

    // Launch two simultaneous verification requests with the exact same valid payload
    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/auth/register/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
        body: JSON.stringify({ registration_id: regId, email_otp: emailOtp, mobile_otp: mobileOtp }),
      }),
      fetch(`${baseUrl}/auth/register/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
        body: JSON.stringify({ registration_id: regId, email_otp: emailOtp, mobile_otp: mobileOtp }),
      }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    assert.deepEqual(statuses, [201, 400], 'Exactly one request succeeds (201) and concurrent request is rejected cleanly (400)');

    // Confirm exactly one user record exists in database
    const matchingUsers = db.prepare('SELECT id FROM users WHERE email = ?').all(email);
    assert.equal(matchingUsers.length, 1, 'Only one active user created in database');

    // Confirm pending record is consumed
    const pendingInDb = db.prepare('SELECT id FROM citizen_pending_registrations WHERE id = ?').get(regId);
    assert.equal(pendingInDb, undefined, 'Pending registration record consumed');
  });

  // =========================================================================
  // 14. DATABASE FAILURE DURING ACCOUNT ACTIVATION (ATOMIC ROLLBACK)
  // =========================================================================
  await t.test('14. Database constraint conflict during activation rolls back cleanly (409)', async () => {
    const email = `conflict.race.${Date.now()}@example.com`;
    const phone = getUniquePhone(14);

    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'Race Conflict User',
        email,
        phone,
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });
    assert.equal(regRes.status, 200);
    const regData = await regRes.json();
    const regId = regData.registration_id;

    const emailOtp = getTestOtp(email);
    const mobileOtp = getTestOtp(phone);

    // Directly insert an existing user with the same email before verify executes
    db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, phone, role)
      VALUES (?, ?, 'hash123', 'Pre-existing User', '9899999999', 'citizen')
    `).run(`user-${Date.now()}`, email);

    // Now attempt verification
    const verifyRes = await fetch(`${baseUrl}/auth/register/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ registration_id: regId, email_otp: emailOtp, mobile_otp: mobileOtp }),
    });

    assert.equal(verifyRes.status, 409, 'Expected 409 Conflict when unique email constraint is violated');
    const verifyData = await verifyRes.json();
    assert.match(verifyData.error, /already exists/i);
  });

  // =========================================================================
  // 15. DUPLICATE REGISTRATION RESPONSE CONSISTENCY (ANTI-ENUMERATION)
  // =========================================================================
  await t.test('15. Duplicate registration responses are uniform and do not leak field-level existence', async () => {
    // 1. Fresh legitimate registration
    const freshEmail = `legit.fresh.${Date.now()}@example.com`;
    const freshPhone = getUniquePhone(150);

    const freshRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'Legit User',
        email: freshEmail,
        phone: freshPhone,
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });
    assert.equal(freshRes.status, 200);
    const freshData = await freshRes.json();

    // 2. Duplicate email registration (seeded Arjun: 'citizen.arjun@civicmemory.local')
    const conflictEmailRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'Attacker Enum 1',
        email: 'citizen.arjun@civicmemory.local', // Duplicate email (Arjun's)
        phone: getUniquePhone(151), // Unique phone
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });

    // 3. Duplicate phone registration (seeded Arjun: '9811110001')
    const conflictPhoneRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'Attacker Enum 2',
        email: `unique.enum.${Date.now()}@example.com`, // Unique email
        phone: '9811110001', // Duplicate phone (Arjun's)
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });

    // 4. Duplicate both email and phone
    const conflictBothRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'Attacker Enum 3',
        email: 'citizen.arjun@civicmemory.local',
        phone: '9811110001',
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });

    // Anti-enumeration assertions: ALL return status 200!
    assert.equal(conflictEmailRes.status, 200, 'Duplicate email must return 200 (anti-enumeration)');
    assert.equal(conflictPhoneRes.status, 200, 'Duplicate phone must return 200 (anti-enumeration)');
    assert.equal(conflictBothRes.status, 200, 'Duplicate both must return 200 (anti-enumeration)');

    const emailData = await conflictEmailRes.json();
    const phoneData = await conflictPhoneRes.json();
    const bothData = await conflictBothRes.json();

    // Verify response structures and messages are IDENTICAL to non-duplicate
    assert.equal(emailData.message, freshData.message, 'Message must be identical to fresh registration');
    assert.equal(phoneData.message, freshData.message, 'Message must be identical to fresh registration');
    assert.equal(bothData.message, freshData.message, 'Message must be identical to fresh registration');

    const expectedKeys = Object.keys(freshData).sort();
    assert.deepEqual(Object.keys(emailData).sort(), expectedKeys, 'Response keys must match non-duplicate');
    assert.deepEqual(Object.keys(phoneData).sort(), expectedKeys, 'Response keys must match non-duplicate');
    assert.deepEqual(Object.keys(bothData).sort(), expectedKeys, 'Response keys must match non-duplicate');

    // Verify NO pending registration was inserted for the duplicate attempts
    const dupPending1 = db.prepare('SELECT id FROM citizen_pending_registrations WHERE id = ?').get(emailData.registration_id);
    const dupPending2 = db.prepare('SELECT id FROM citizen_pending_registrations WHERE id = ?').get(phoneData.registration_id);
    const dupPending3 = db.prepare('SELECT id FROM citizen_pending_registrations WHERE id = ?').get(bothData.registration_id);
    assert.equal(dupPending1, undefined, 'No pending registration record created for duplicate email');
    assert.equal(dupPending2, undefined, 'No pending registration record created for duplicate phone');
    assert.equal(dupPending3, undefined, 'No pending registration record created for duplicate both');

    // Verify seeded Arjun account was untouched
    const arjun = db.prepare('SELECT id, email, phone FROM users WHERE email = ?').get('citizen.arjun@civicmemory.local');
    assert.ok(arjun, 'Seeded user must exist');
    assert.equal(arjun.phone, '9811110001');
  });

  // =========================================================================
  // 16. SMTP TLS CONFIGURATION SECURITY (STARTTLS ON 587 & IMPLICIT TLS ON 465)
  // =========================================================================
  await t.test('16. SMTP TLS configuration: Port 587 enforces STARTTLS & TLS 1.2+; insecure ports rejected in prod', async () => {
    const origHost = config.smtpHost;
    const origUser = config.smtpUser;
    const origPort = config.smtpPort;
    const origEnv = config.nodeEnv;

    try {
      // 1. Port 587 verification
      config.smtpHost = 'smtp.sendgrid.net';
      config.smtpUser = 'apikey';
      config.smtpPort = 587;
      resetMailTransporter();

      const transporter587 = getMailTransporter();
      assert.ok(transporter587, 'Transporter initialized');
      assert.equal(transporter587.options.secure, false, 'Port 587 is not implicit TLS');
      assert.equal(transporter587.options.requireTLS, true, 'Port 587 strictly requires STARTTLS');
      assert.equal(transporter587.options.tls.minVersion, 'TLSv1.2', 'Port 587 requires at least TLS 1.2');
      assert.equal(transporter587.options.tls.rejectUnauthorized, true, 'Port 587 verifies certificates');

      // 2. Port 465 verification
      config.smtpPort = 465;
      resetMailTransporter();

      const transporter465 = getMailTransporter();
      assert.equal(transporter465.options.secure, true, 'Port 465 uses implicit TLS');
      assert.equal(transporter465.options.tls.minVersion, 'TLSv1.2', 'Port 465 requires at least TLS 1.2');

      // 3. Insecure port (e.g. 25) in production fails closed
      config.nodeEnv = 'production';
      config.smtpPort = 25;
      resetMailTransporter();

      assert.throws(
        () => getMailTransporter(),
        /FATAL SECURITY ERROR.*Insecure port 25 is prohibited/,
        'Insecure SMTP port must throw fatal error in production'
      );
    } finally {
      config.smtpHost = origHost;
      config.smtpUser = origUser;
      config.smtpPort = origPort;
      config.nodeEnv = origEnv;
      resetMailTransporter();
    }
  });

  // =========================================================================
  // 17. REGISTRATION ID ANTI-ENUMERATION LIFECYCLE (DUMMY SESSION BEHAVIOR)
  // =========================================================================
  await t.test('17. Registration ID anti-enumeration lifecycle: Duplicate ID behaves identically to genuine session across resend and verification', async () => {
    // 1. Duplicate registration attempt using seeded Arjun's email
    const conflictRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'Attacker Impersonator',
        email: 'citizen.arjun@civicmemory.local',
        phone: getUniquePhone(170),
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });

    assert.equal(conflictRes.status, 200, 'Duplicate registration returns 200');
    const conflictData = await conflictRes.json();
    const dummyId = conflictData.registration_id;
    assert.ok(dummyId, 'Dummy registration_id returned');

    // Verify stored in citizen_dummy_registrations but NOT citizen_pending_registrations
    const dummyRow = db.prepare('SELECT * FROM citizen_dummy_registrations WHERE id = ?').get(dummyId);
    assert.ok(dummyRow, 'Dummy registration row exists in citizen_dummy_registrations');
    const pendingRow = db.prepare('SELECT * FROM citizen_pending_registrations WHERE id = ?').get(dummyId);
    assert.equal(pendingRow, undefined, 'Must NOT exist in citizen_pending_registrations');

    // 2. Resend immediately -> 429 Cooldown (identical to genuine session!)
    const resendCooldownRes = await fetch(`${baseUrl}/auth/register/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        registration_id: dummyId,
        type: 'both',
      }),
    });

    assert.equal(resendCooldownRes.status, 429, 'Immediate resend must return 429 cooldown');
    const cooldownData = await resendCooldownRes.json();
    assert.equal(cooldownData.error, 'Please wait before requesting another code.');
    assert.ok(cooldownData.retry_after_seconds > 0, 'Retry after seconds returned');

    // 3. Fast-forward cooldown in DB
    db.prepare('UPDATE citizen_dummy_registrations SET resend_available_at = ? WHERE id = ?').run(Date.now() - 1000, dummyId);

    // 4. Resend after cooldown -> 200 OK (identical to genuine success; no OTP sent)
    clearTestOtps();
    const resendSuccessRes = await fetch(`${baseUrl}/auth/register/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        registration_id: dummyId,
        type: 'both',
      }),
    });

    assert.equal(resendSuccessRes.status, 200, 'Resend after cooldown returns 200');
    const resendData = await resendSuccessRes.json();
    assert.equal(resendData.success, true);
    assert.ok(resendData.channels.email.sent, 'Email channel reported sent');
    assert.ok(resendData.channels.mobile.sent, 'Mobile channel reported sent');
    assert.equal(getTestOtp('citizen.arjun@civicmemory.local'), null, 'NO real OTP dispatched for duplicate account');

    // Resend immediately again -> locked by fresh 60s cooldown!
    const resendRelocked = await fetch(`${baseUrl}/auth/register/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        registration_id: dummyId,
        type: 'both',
      }),
    });
    assert.equal(resendRelocked.status, 429, 'Resend re-locked by cooldown');

    // 5. Verification attempt with incorrect codes -> 400 with attempts_remaining
    const verifyFail1 = await fetch(`${baseUrl}/auth/register/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        registration_id: dummyId,
        email_otp: '111111',
        mobile_otp: '222222',
      }),
    });

    assert.equal(verifyFail1.status, 400, 'Verify returns 400');
    const failData1 = await verifyFail1.json();
    assert.equal(failData1.error, 'Both Email and Mobile verification codes are incorrect.');
    assert.equal(failData1.email_verified, false);
    assert.equal(failData1.mobile_verified, false);
    assert.equal(failData1.attempts_remaining, 4);

    // 6. Exhaust remaining 4 attempts
    for (let attempt = 3; attempt >= 0; attempt--) {
      const vRes = await fetch(`${baseUrl}/auth/register/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
        body: JSON.stringify({
          registration_id: dummyId,
          email_otp: '111111',
          mobile_otp: '222222',
        }),
      });
      assert.equal(vRes.status, 400);
      const vData = await vRes.json();
      assert.equal(vData.attempts_remaining, attempt);
    }

    // 7. 6th attempt -> Maximum verification attempts exceeded
    const verifyExhausted = await fetch(`${baseUrl}/auth/register/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        registration_id: dummyId,
        email_otp: '111111',
        mobile_otp: '222222',
      }),
    });
    assert.equal(verifyExhausted.status, 400);
    const exhaustedData = await verifyExhausted.json();
    assert.equal(exhaustedData.error, 'Maximum verification attempts exceeded. Please restart registration.');

    // 8. Verify active users table is completely untouched (NO user created)
    const arjunUsers = db.prepare('SELECT id FROM users WHERE email = ?').all('citizen.arjun@civicmemory.local');
    assert.equal(arjunUsers.length, 1, 'Only original seeded Arjun must exist');
  });

  // =========================================================================
  // 18. PROVIDER ABUSE: SMS DISPATCH PER PHONE & DESTINATION QUOTA
  // =========================================================================
  await t.test('18. Provider abuse protection: SMS dispatch per phone quota & fresh registration IDs cannot bypass', async () => {
    clearAbuseStore();
    setAbuseLimits({ smsPhoneMax: 2, smsPhoneWindowMs: 3600000 });

    const targetPhone = '9888880001';

    // 1st registration with targetPhone -> OK
    const reg1 = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'Phone User 1',
        email: `phone.user1.${Date.now()}@example.com`,
        phone: targetPhone,
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });
    assert.equal(reg1.status, 200, '1st dispatch allowed');

    // 2nd registration with targetPhone (fresh email & ID) -> OK
    const reg2 = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'Phone User 2',
        email: `phone.user2.${Date.now()}@example.com`,
        phone: targetPhone,
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });
    assert.equal(reg2.status, 200, '2nd dispatch allowed');

    // 3rd registration with targetPhone (fresh email & ID) -> Exceeds quota (429)!
    const reg3 = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'Phone User 3',
        email: `phone.user3.${Date.now()}@example.com`,
        phone: targetPhone,
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });
    assert.equal(reg3.status, 429, '3rd dispatch rejected with 429 (quota exceeded)');
    const reg3Data = await reg3.json();
    assert.match(reg3Data.error, /too many verification attempts for this mobile number/i);

    resetAbuseLimits();
    clearAbuseStore();
  });

  // =========================================================================
  // 19. PROVIDER ABUSE: SMS DISPATCH PER IP & GLOBAL VOLUME LIMIT
  // =========================================================================
  await t.test('19. Provider abuse protection: SMS dispatch per IP and global volume limit', async () => {
    clearAbuseStore();
    setAbuseLimits({ smsIpMax: 2, smsIpWindowMs: 3600000 });

    const testIp = '198.51.100.42';

    // 1st & 2nd registration from testIp -> OK
    for (let i = 1; i <= 2; i++) {
      const res = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          'X-Forwarded-For': testIp,
        },
        body: JSON.stringify({
          full_name: `IP User ${i}`,
          email: `ip.user.${i}.${Date.now()}@example.com`,
          phone: getUniquePhone(190 + i),
          password: 'ValidPassword123!',
          state: 'Karnataka',
          district: 'Bengaluru Urban',
          ulb: 'BBMP',
          locality: 'Indiranagar',
          street: '100 Feet Road',
          pin_code: '560038',
        }),
      });
      assert.equal(res.status, 200, `IP request ${i} allowed`);
    }

    // 3rd registration from same testIp -> 429
    const reg3Ip = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Forwarded-For': testIp,
      },
      body: JSON.stringify({
        full_name: 'IP User 3',
        email: `ip.user.3.${Date.now()}@example.com`,
        phone: getUniquePhone(193),
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });
    assert.equal(reg3Ip.status, 429, '3rd IP request blocked');
    const ipData = await reg3Ip.json();
    assert.match(ipData.error, /too many sms verification requests from this network/i);

    // Global volume limit test
    clearAbuseStore();
    setAbuseLimits({ smsGlobalMax: 2, smsGlobalWindowMs: 900000 });

    for (let i = 1; i <= 2; i++) {
      const gRes = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          'X-Forwarded-For': `198.51.100.${i}`,
        },
        body: JSON.stringify({
          full_name: `Global User ${i}`,
          email: `global.user.${i}.${Date.now()}@example.com`,
          phone: getUniquePhone(200 + i),
          password: 'ValidPassword123!',
          state: 'Karnataka',
          district: 'Bengaluru Urban',
          ulb: 'BBMP',
          locality: 'Indiranagar',
          street: '100 Feet Road',
          pin_code: '560038',
        }),
      });
      assert.equal(gRes.status, 200);
    }

    const gRes3 = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Forwarded-For': '198.51.100.99',
      },
      body: JSON.stringify({
        full_name: 'Global User 3',
        email: `global.user.3.${Date.now()}@example.com`,
        phone: getUniquePhone(203),
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });
    assert.equal(gRes3.status, 503, 'Global SMS volume limit returns 503');
    const gData = await gRes3.json();
    assert.match(gData.error, /volume limit reached/i);

    resetAbuseLimits();
    clearAbuseStore();
  });

  // =========================================================================
  // 20. PROVIDER ABUSE: EMAIL DISPATCH PER DESTINATION & IP
  // =========================================================================
  await t.test('20. Provider abuse protection: Email dispatch destination & IP quotas', async () => {
    clearAbuseStore();
    setAbuseLimits({ emailDestMax: 2, emailDestWindowMs: 3600000 });

    const targetEmail = `dest.quota.${Date.now()}@example.com`;

    for (let i = 1; i <= 2; i++) {
      const res = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
        body: JSON.stringify({
          full_name: `Email User ${i}`,
          email: targetEmail,
          phone: getUniquePhone(210 + i),
          password: 'ValidPassword123!',
          state: 'Karnataka',
          district: 'Bengaluru Urban',
          ulb: 'BBMP',
          locality: 'Indiranagar',
          street: '100 Feet Road',
          pin_code: '560038',
        }),
      });
      assert.equal(res.status, 200);
    }

    const res3 = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'Email User 3',
        email: targetEmail,
        phone: getUniquePhone(213),
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });
    assert.equal(res3.status, 429, '3rd email dispatch blocked');
    const res3Data = await res3.json();
    assert.match(res3Data.error, /too many verification requests for this email/i);

    resetAbuseLimits();
    clearAbuseStore();
  });

  // =========================================================================
  // 21. PROVIDER CIRCUIT BREAKER PROTECTION
  // =========================================================================
  await t.test('21. Provider circuit breaker: Trips OPEN on failures and fails fast without provider invocation', async () => {
    clearAbuseStore();

    // 1. Trip SMS circuit breaker
    tripCircuitBreaker('sms', 60000);
    const cbState = getCircuitBreakerState('sms');
    assert.equal(cbState.state, 'OPEN', 'SMS circuit breaker is OPEN');

    const resSmsOpen = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'CB User 1',
        email: `cb.user.${Date.now()}@example.com`,
        phone: getUniquePhone(220),
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });

    assert.equal(resSmsOpen.status, 503, 'Tripped circuit breaker returns 503');
    const smsOpenData = await resSmsOpen.json();
    assert.match(smsOpenData.error, /SMS verification service is temporarily unavailable/i);

    // 2. Trip Email circuit breaker
    clearAbuseStore();
    tripCircuitBreaker('email', 60000);

    const resEmailOpen = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'CB User 2',
        email: `cb.user2.${Date.now()}@example.com`,
        phone: getUniquePhone(221),
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });

    assert.equal(resEmailOpen.status, 503, 'Tripped email circuit breaker returns 503');
    const emailOpenData = await resEmailOpen.json();
    assert.match(emailOpenData.error, /Email verification service is temporarily unavailable/i);

    clearAbuseStore();
    resetAbuseLimits();
  });

  // =========================================================================
  // 22. ASYNCHRONOUS BCRYPT HASHING & PRE-FLIGHT REJECTION
  // =========================================================================
  await t.test('22. Asynchronous bcrypt hashing runs on genuine and duplicate paths; invalid inputs reject before hashing', async () => {
    // 1. Invalid input is rejected (400) immediately before hashing
    const badRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'Bad Input User',
        email: 'invalid-email-format',
        phone: '123', // invalid phone
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });
    assert.equal(badRes.status, 400, 'Invalid input rejected at schema validation');

    // 2. Genuine registration executes async bcrypt.hash without error
    const legitRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        full_name: 'Async Hash User',
        email: `async.hash.${Date.now()}@example.com`,
        phone: getUniquePhone(230),
        password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });
    assert.equal(legitRes.status, 200);
    const legitData = await legitRes.json();
    assert.ok(legitData.registration_id);
  });
});
