import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/database.js';
import { config } from '../config/env.js';
import {
  citizenRegisterSchema,
  verifyRegistrationOtpSchema,
  resendRegistrationOtpSchema,
  forgotPasswordRequestSchema,
  verifyResetOtpSchema,
  resendResetOtpSchema,
  resetPasswordSchema,
  loginSchema,
} from '../validators/authValidators.js';
import {
  generateOtp,
  hashOtp,
  verifyOtpHash,
  generateSecureToken,
  hashToken,
  maskEmail,
  maskPhone,
  dispatchEmailOtp,
  dispatchSmsOtp,
} from '../services/otpService.js';
import { logAuditEvent } from '../utils/auditLogger.js';
import { isKnownUlb, LOCAL_PINCODE_CACHE } from '../utils/indiaGeoData.js';
import { dynamicPinCache } from './geoController.js';
import {
  checkRegistrationDispatchAbuse,
  checkResendChannelAbuse,
  recordDispatch,
} from '../services/providerAbuseService.js';

// Secure cookie configuration (SameSite=None is strictly paired with Secure=true)
export const cookieOptions = {
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: config.cookieSameSite,
  maxAge: config.cookieMaxAgeMs,
  path: '/',
};

// Helper to sign JWT with unique JTI for revokability
export function signUserToken(user) {
  const jti = uuidv4();
  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
  return { token, jti };
}

// Helper to strip sensitive fields from user record
export function sanitizeUser(user) {
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

// Periodic cleanup of expired revoked tokens
export function cleanupRevokedTokens() {
  try {
    const now = Math.floor(Date.now() / 1000);
    db.prepare('DELETE FROM revoked_tokens WHERE expires_at < ?').run(now);
  } catch (err) {
    console.error('[CivicMemory DB] Error during revoked tokens cleanup:', err);
  }
}

/**
 * POST /api/auth/register
 * Initiates citizen registration. Requires valid contact and residential location details.
 * Dispatches cryptographically hashed single-use OTPs to both email and mobile number.
 * Active user accounts are created ONLY upon successful dual verification via /verify-otp.
 */
export async function register(req, res) {
  try {
    const parseResult = citizenRegisterSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const {
      full_name,
      email,
      phone,
      password,
      state,
      district,
      ulb,
      locality,
      street,
      pin_code,
      house_number,
      landmark,
    } = parseResult.data;

    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress;

    // Pre-flight destination and IP abuse protection (runs before expensive password hashing)
    const abuseCheck = checkRegistrationDispatchAbuse({
      email,
      phone,
      ip: clientIp,
      headers: req.headers,
    });
    if (!abuseCheck.allowed) {
      return res.status(abuseCheck.status).json({
        error: abuseCheck.error,
      });
    }

    // Check for conflict with existing active users
    const existingUser = db.prepare(`
      SELECT id FROM users
      WHERE email = ? COLLATE NOCASE OR phone = ?
    `).get(email, phone);

    if (existingUser) {
      // Anti-enumeration: execute same asynchronous bcrypt hashing workload to avoid timing disparity
      await bcrypt.hash(password, 10);
      const dummyRegistrationId = uuidv4();
      const now = Date.now();
      const expiresAt = now + config.otpExpiryMs;
      const resendAvailableAt = now + config.otpCooldownMs;

      // Generate cryptographically unmatchable dummy hashes
      const dummyEmailHash = hashOtp(`dummy-unmatchable-email-${uuidv4()}`);
      const dummyMobileHash = hashOtp(`dummy-unmatchable-mobile-${uuidv4()}`);

      // Prune expired dummy registration sessions
      try {
        db.prepare('DELETE FROM citizen_dummy_registrations WHERE expires_at < ?').run(now);
      } catch (_) {}

      // Store bounded, expiring shadow session shared across multi-instance deployment
      db.prepare(`
        INSERT INTO citizen_dummy_registrations (
          id, email_otp_hash, mobile_otp_hash,
          email_otp_attempts, mobile_otp_attempts,
          email_verified, mobile_verified,
          resend_available_at, expires_at
        ) VALUES (?, ?, ?, 0, 0, 0, 0, ?, ?)
      `).run(dummyRegistrationId, dummyEmailHash, dummyMobileHash, resendAvailableAt, expiresAt);

      // Do NOT send real OTPs to already-registered accounts
      // Return uniform HTTP 200 response identical in status, keys, and message to new registration
      return res.status(200).json({
        success: true,
        message: 'Verification codes have been dispatched to your email and mobile number.',
        registration_id: dummyRegistrationId,
        email_masked: maskEmail(email),
        phone_masked: maskPhone(phone),
        resend_cooldown_seconds: Math.ceil(config.otpCooldownMs / 1000),
      });
    }

    // Hash password asynchronously (10 rounds bcrypt)
    const password_hash = await bcrypt.hash(password, 10);
    const registrationId = uuidv4();

    // Determine authoritative server-side ULB verification status
    const isUlbRecognized = isKnownUlb(state, district, ulb);
    const serverUlbStatus = isUlbRecognized ? 'VERIFIED' : 'CUSTOM';

    // Determine authoritative server-side Locality verification level (never trust frontend claims)
    const cachedPin = dynamicPinCache?.get?.(pin_code) || LOCAL_PINCODE_CACHE[pin_code];
    let serverLocalityLevel = 'manual_unverified';
    if (cachedPin?.postOffices?.some((po) => po.toLowerCase() === locality.toLowerCase())) {
      serverLocalityLevel = 'postal_matched';
    } else if (parseResult.data.locality_verification_level === 'ai_assessed') {
      serverLocalityLevel = 'ai_assessed';
    }

    // Generate unpredictable 6-digit OTPs
    const emailOtp = generateOtp();
    const mobileOtp = generateOtp();

    const emailOtpHashed = hashOtp(emailOtp);
    const mobileOtpHashed = hashOtp(mobileOtp);

    const now = Date.now();
    const expiresAt = now + config.otpExpiryMs;
    const resendAvailableAt = now + config.otpCooldownMs;

    // Clear any previous pending registration records for this email or phone
    db.prepare(`
      DELETE FROM citizen_pending_registrations
      WHERE email = ? COLLATE NOCASE OR phone = ?
    `).run(email, phone);

    // Insert pending registration record
    db.prepare(`
      INSERT INTO citizen_pending_registrations (
        id, email, phone, full_name, password_hash,
        state, district, ulb, locality, street, pin_code, house_number, landmark,
        locality_verification_level, ulb_verification_status,
        email_otp_hash, email_otp_expires_at, email_otp_attempts, email_verified,
        mobile_otp_hash, mobile_otp_expires_at, mobile_otp_attempts, mobile_verified,
        resend_available_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 0, 0, ?)
    `).run(
      registrationId,
      email,
      phone,
      full_name,
      password_hash,
      state,
      district,
      ulb,
      locality,
      street,
      pin_code,
      house_number || null,
      landmark || null,
      serverLocalityLevel,
      serverUlbStatus,
      emailOtpHashed,
      expiresAt,
      mobileOtpHashed,
      expiresAt,
      resendAvailableAt
    );

    // Dispatch OTPs to both channels
    const emailDispatch = await dispatchEmailOtp(email, emailOtp, 'citizen registration');
    const smsDispatch = await dispatchSmsOtp(phone, mobileOtp, 'citizen registration');

    if (!emailDispatch.success || !smsDispatch.success) {
      // Rollback pending registration so no orphaned records remain
      db.prepare('DELETE FROM citizen_pending_registrations WHERE id = ?').run(registrationId);
      return res.status(503).json({
        error: 'Verification service is temporarily unavailable. Please try again later.',
      });
    }

    // Record successful dispatches against destination and IP abuse quotas
    recordDispatch({
      email,
      phone,
      ip: clientIp,
      headers: req.headers,
    });

    return res.status(200).json({
      success: true,
      message: 'Verification codes have been dispatched to your email and mobile number.',
      registration_id: registrationId,
      email_masked: maskEmail(email),
      phone_masked: maskPhone(phone),
      resend_cooldown_seconds: Math.ceil(config.otpCooldownMs / 1000),
    });
  } catch (error) {
    console.error('[Register Error]:', error);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
}

/**
 * POST /api/auth/register/verify-otp
 * Verifies both email and mobile OTPs independently before activating citizen account.
 */
export async function verifyRegistrationOtp(req, res) {
  try {
    const parseResult = verifyRegistrationOtpSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid verification request',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { registration_id, email_otp, mobile_otp } = parseResult.data;

    const pending = db.prepare(`
      SELECT * FROM citizen_pending_registrations WHERE id = ?
    `).get(registration_id);

    const dummy = !pending ? db.prepare(`
      SELECT * FROM citizen_dummy_registrations WHERE id = ?
    `).get(registration_id) : null;

    if (!pending && !dummy) {
      return res.status(400).json({
        error: 'Registration session expired or not found. Please register again.',
      });
    }

    if (dummy) {
      const now = Date.now();
      if (now > dummy.expires_at) {
        return res.status(400).json({
          error: 'Verification codes have expired. Please request new codes.',
        });
      }

      if (
        dummy.email_otp_attempts >= config.otpMaxAttempts ||
        dummy.mobile_otp_attempts >= config.otpMaxAttempts
      ) {
        return res.status(400).json({
          error: 'Maximum verification attempts exceeded. Please restart registration.',
        });
      }

      const nextEmailAttempts = dummy.email_otp_attempts + 1;
      const nextMobileAttempts = dummy.mobile_otp_attempts + 1;

      db.prepare(`
        UPDATE citizen_dummy_registrations
        SET email_otp_attempts = ?,
            mobile_otp_attempts = ?
        WHERE id = ?
      `).run(nextEmailAttempts, nextMobileAttempts, registration_id);

      const attemptsRemaining = config.otpMaxAttempts - Math.max(nextEmailAttempts, nextMobileAttempts);

      return res.status(400).json({
        error: 'Both Email and Mobile verification codes are incorrect.',
        email_verified: false,
        mobile_verified: false,
        attempts_remaining: Math.max(0, attemptsRemaining),
      });
    }

    const now = Date.now();
    if (now > pending.email_otp_expires_at || now > pending.mobile_otp_expires_at) {
      return res.status(400).json({
        error: 'Verification codes have expired. Please request new codes.',
      });
    }

    if (
      pending.email_otp_attempts >= config.otpMaxAttempts ||
      pending.mobile_otp_attempts >= config.otpMaxAttempts
    ) {
      return res.status(400).json({
        error: 'Maximum verification attempts exceeded. Please restart registration.',
      });
    }

    // Verify independent OTPs
    const isEmailValid = pending.email_verified === 1 || verifyOtpHash(email_otp, pending.email_otp_hash);
    const isMobileValid = pending.mobile_verified === 1 || verifyOtpHash(mobile_otp, pending.mobile_otp_hash);

    if (!isEmailValid || !isMobileValid) {
      const nextEmailAttempts = isEmailValid ? pending.email_otp_attempts : pending.email_otp_attempts + 1;
      const nextMobileAttempts = isMobileValid ? pending.mobile_otp_attempts : pending.mobile_otp_attempts + 1;
      const emailVerifiedStatus = isEmailValid ? 1 : pending.email_verified;
      const mobileVerifiedStatus = isMobileValid ? 1 : pending.mobile_verified;

      db.prepare(`
        UPDATE citizen_pending_registrations
        SET email_otp_attempts = ?,
            mobile_otp_attempts = ?,
            email_verified = ?,
            mobile_verified = ?
        WHERE id = ?
      `).run(nextEmailAttempts, nextMobileAttempts, emailVerifiedStatus, mobileVerifiedStatus, registration_id);

      const attemptsRemaining = config.otpMaxAttempts - Math.max(nextEmailAttempts, nextMobileAttempts);

      let errorMessage = 'Verification code is incorrect.';
      if (!isEmailValid && !isMobileValid) {
        errorMessage = 'Both Email and Mobile verification codes are incorrect.';
      } else if (!isEmailValid) {
        errorMessage = 'Email verification code is incorrect.';
      } else if (!isMobileValid) {
        errorMessage = 'Mobile verification code is incorrect.';
      }

      return res.status(400).json({
        error: errorMessage,
        email_verified: !!isEmailValid,
        mobile_verified: !!isMobileValid,
        attempts_remaining: Math.max(0, attemptsRemaining),
      });
    }

    // Dual verification success! Move to users table within an atomic SQLite transaction
    const userId = `user-citizen-${uuidv4()}`;

    let inTransaction = false;
    try {
      db.exec('BEGIN IMMEDIATE;');
      inTransaction = true;

      // Re-verify that the pending registration is still active under the transaction lock
      const activePending = db.prepare(`
        SELECT * FROM citizen_pending_registrations WHERE id = ?
      `).get(registration_id);

      if (!activePending) {
        db.exec('ROLLBACK;');
        inTransaction = false;
        return res.status(400).json({
          error: 'Registration session expired or already completed. Please sign in.',
        });
      }

      // Insert new active citizen user
      db.prepare(`
        INSERT INTO users (
          id, email, password_hash, full_name, phone, role, department_id, is_active,
          state, district, ulb, locality, street, pin_code, house_number, landmark,
          locality_verification_level, ulb_verification_status
        ) VALUES (?, ?, ?, ?, ?, 'citizen', NULL, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        activePending.email,
        activePending.password_hash,
        activePending.full_name,
        activePending.phone,
        activePending.state,
        activePending.district,
        activePending.ulb,
        activePending.locality,
        activePending.street,
        activePending.pin_code,
        activePending.house_number,
        activePending.landmark,
        activePending.locality_verification_level || 'manual_unverified',
        activePending.ulb_verification_status || 'UNVERIFIED'
      );

      // Delete pending registration record (single-use atomic consumption)
      db.prepare('DELETE FROM citizen_pending_registrations WHERE id = ?').run(registration_id);

      db.exec('COMMIT;');
      inTransaction = false;
    } catch (txErr) {
      if (inTransaction) {
        try {
          db.exec('ROLLBACK;');
        } catch (_) {}
      }

      // Check for concurrent unique constraint violation on email
      if (txErr.code === 'SQLITE_CONSTRAINT' || String(txErr.message).includes('UNIQUE')) {
        return res.status(409).json({
          error: 'An account with these contact details already exists. Please sign in or use password recovery.',
        });
      }
      throw txErr;
    }

    // Record audit event
    logAuditEvent({
      userId,
      action: 'CITIZEN_REGISTERED',
      targetEntity: 'user',
      targetId: userId,
      details: {
        email: pending.email,
        phone: maskPhone(pending.phone),
        ulb: pending.ulb,
        district: pending.district,
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'],
    });

    const newUser = db.prepare(`
      SELECT id, email, full_name, phone, role, department_id, is_active,
             state, district, ulb, locality, street, pin_code, house_number, landmark, created_at
      FROM users WHERE id = ?
    `).get(userId);

    return res.status(201).json({
      success: true,
      message: 'Account verified and registered successfully. Please sign in.',
      user: sanitizeUser(newUser),
    });
  } catch (error) {
    console.error('[Verify Registration OTP Error]:', error);
    return res.status(500).json({ error: 'Internal server error during verification.' });
  }
}

/**
 * POST /api/auth/register/resend-otp
 * Resends email, mobile, or both OTPs with cooldown enforcement.
 */
export async function resendRegistrationOtp(req, res) {
  try {
    const parseResult = resendRegistrationOtpSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid resend request',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { registration_id, type = 'both' } = parseResult.data;

    const pending = db.prepare(`
      SELECT * FROM citizen_pending_registrations WHERE id = ?
    `).get(registration_id);

    const dummy = !pending ? db.prepare(`
      SELECT * FROM citizen_dummy_registrations WHERE id = ?
    `).get(registration_id) : null;

    if (!pending && !dummy) {
      return res.status(400).json({
        error: 'Registration session not found or already completed.',
      });
    }

    if (dummy) {
      // Prevent resetting or bypassing attempt limits on resend
      if (
        dummy.email_otp_attempts >= config.otpMaxAttempts ||
        dummy.mobile_otp_attempts >= config.otpMaxAttempts
      ) {
        return res.status(400).json({
          error: 'Maximum verification attempts exceeded. Please restart registration.',
        });
      }

      const now = Date.now();
      if (now < dummy.resend_available_at) {
        const remainingSeconds = Math.ceil((dummy.resend_available_at - now) / 1000);
        return res.status(429).json({
          error: 'Please wait before requesting another code.',
          retry_after_seconds: remainingSeconds,
        });
      }

      const resendAvailableAt = now + config.otpCooldownMs;
      const claim = db.prepare(`
        UPDATE citizen_dummy_registrations
        SET resend_available_at = ?,
            expires_at = ?
        WHERE id = ? AND resend_available_at <= ?
      `).run(resendAvailableAt, now + config.otpExpiryMs, registration_id, now);

      if (claim.changes === 0) {
        return res.status(429).json({
          error: 'Please wait before requesting another code.',
          retry_after_seconds: Math.ceil(config.otpCooldownMs / 1000),
        });
      }

      // Do NOT dispatch email or SMS for dummy session
      const shouldResendEmail = type === 'email' || type === 'both';
      const shouldResendMobile = type === 'mobile' || type === 'both';

      const channels = {};
      if (shouldResendEmail) {
        channels.email = { sent: true };
      }
      if (shouldResendMobile) {
        channels.mobile = { sent: true };
      }

      let message = 'New verification code(s) sent successfully.';
      if (shouldResendEmail && shouldResendMobile) {
        message = 'New verification code(s) sent successfully.';
      } else if (shouldResendEmail) {
        message = 'Email verification code resent successfully.';
      } else if (shouldResendMobile) {
        message = 'Mobile verification code resent successfully.';
      }

      return res.status(200).json({
        success: true,
        message,
        channels,
      });
    }

    // Prevent resetting or bypassing attempt limits on resend
    if (
      pending.email_otp_attempts >= config.otpMaxAttempts ||
      pending.mobile_otp_attempts >= config.otpMaxAttempts
    ) {
      return res.status(400).json({
        error: 'Maximum verification attempts exceeded. Please restart registration.',
      });
    }

    const now = Date.now();
    if (now < pending.resend_available_at) {
      const remainingSeconds = Math.ceil((pending.resend_available_at - now) / 1000);
      return res.status(429).json({
        error: 'Please wait before requesting another code.',
        retry_after_seconds: remainingSeconds,
      });
    }

    const expiresAt = now + config.otpExpiryMs;
    const resendAvailableAt = now + config.otpCooldownMs;

    // Atomically claim resend cooldown slot to prevent concurrent resends from overwriting newer OTP state
    const claim = db.prepare(`
      UPDATE citizen_pending_registrations
      SET resend_available_at = ?
      WHERE id = ? AND resend_available_at <= ?
    `).run(resendAvailableAt, registration_id, now);

    if (claim.changes === 0) {
      return res.status(429).json({
        error: 'Please wait before requesting another code.',
        retry_after_seconds: Math.ceil(config.otpCooldownMs / 1000),
      });
    }

    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress;

    // Generate and dispatch OTPs independently per requested channel
    let newEmailOtp = null;
    let newMobileOtp = null;
    let emailDispatch = { success: false };
    let smsDispatch = { success: false };

    const shouldResendEmail = (type === 'email' || type === 'both') && pending.email_verified === 0;
    const shouldResendMobile = (type === 'mobile' || type === 'both') && pending.mobile_verified === 0;

    if (shouldResendEmail) {
      const emailAbuse = checkResendChannelAbuse({
        channel: 'email',
        destination: pending.email,
        ip: clientIp,
        headers: req.headers,
      });
      if (!emailAbuse.allowed && type === 'email') {
        return res.status(emailAbuse.status).json({
          error: emailAbuse.error,
          retry_after_seconds: Math.ceil(config.otpCooldownMs / 1000),
        });
      } else if (emailAbuse.allowed) {
        newEmailOtp = generateOtp();
        emailDispatch = await dispatchEmailOtp(pending.email, newEmailOtp, 'citizen registration');
        if (emailDispatch.success) {
          recordDispatch({ email: pending.email, ip: clientIp, headers: req.headers });
        }
      }
    }

    if (shouldResendMobile) {
      const smsAbuse = checkResendChannelAbuse({
        channel: 'mobile',
        destination: pending.phone,
        ip: clientIp,
        headers: req.headers,
      });
      if (!smsAbuse.allowed && type === 'mobile') {
        return res.status(smsAbuse.status).json({
          error: smsAbuse.error,
          retry_after_seconds: Math.ceil(config.otpCooldownMs / 1000),
        });
      } else if (smsAbuse.allowed) {
        newMobileOtp = generateOtp();
        smsDispatch = await dispatchSmsOtp(pending.phone, newMobileOtp, 'citizen registration');
        if (smsDispatch.success) {
          recordDispatch({ phone: pending.phone, ip: clientIp, headers: req.headers });
        }
      }
    }

    const emailSuccess = shouldResendEmail ? !!emailDispatch.success : false;
    const mobileSuccess = shouldResendMobile ? !!smsDispatch.success : false;

    // Atomically update database for successfully accepted channels only
    // Failed channels retain their previous hashes and expiry
    // Cumulative attempt counters are strictly preserved
    const updates = [];
    const params = [];

    if (emailSuccess && newEmailOtp) {
      updates.push('email_otp_hash = ?', 'email_otp_expires_at = ?');
      params.push(hashOtp(newEmailOtp), expiresAt);
    }

    if (mobileSuccess && newMobileOtp) {
      updates.push('mobile_otp_hash = ?', 'mobile_otp_expires_at = ?');
      params.push(hashOtp(newMobileOtp), expiresAt);
    }

    if (updates.length > 0) {
      params.push(registration_id);
      db.prepare(`
        UPDATE citizen_pending_registrations
        SET ${updates.join(', ')}
        WHERE id = ?
      `).run(...params);
    }

    // Build channel submission status report without exposing OTPs
    const channels = {};
    if (shouldResendEmail) {
      channels.email = {
        sent: !!emailSuccess,
        ...(emailSuccess ? {} : { error: 'Email delivery failed; previous code remains active' }),
      };
    }
    if (shouldResendMobile) {
      channels.mobile = {
        sent: !!mobileSuccess,
        ...(mobileSuccess ? {} : { error: 'SMS delivery failed; previous code remains active' }),
      };
    }

    const anyRequested = shouldResendEmail || shouldResendMobile;
    const anySucceeded = emailSuccess || mobileSuccess;

    if (!anySucceeded && anyRequested) {
      return res.status(503).json({
        success: false,
        error: 'Verification code delivery failed for all requested channels. Your previous verification codes remain valid. Please try again later.',
        channels,
        retry_after_seconds: Math.ceil(config.otpCooldownMs / 1000),
      });
    }

    let message = 'New verification code(s) sent successfully.';
    if (shouldResendEmail && shouldResendMobile) {
      if (emailSuccess && !mobileSuccess) {
        message = 'Email verification code resent successfully. SMS delivery failed; your previous SMS code remains valid.';
      } else if (!emailSuccess && mobileSuccess) {
        message = 'Mobile verification code resent successfully. Email delivery failed; your previous Email code remains valid.';
      }
    } else if (shouldResendEmail && emailSuccess) {
      message = 'Email verification code resent successfully.';
    } else if (shouldResendMobile && mobileSuccess) {
      message = 'Mobile verification code resent successfully.';
    }

    return res.status(200).json({
      success: true,
      message,
      channels,
      resend_cooldown_seconds: Math.ceil(config.otpCooldownMs / 1000),
    });
  } catch (error) {
    console.error('[Resend Registration OTP Error]:', error);
    return res.status(500).json({ error: 'Internal server error while resending verification code.' });
  }
}

/**
 * POST /api/auth/forgot-password
 * Initiates recovery with OTP dispatch, enforcing strict anti-enumeration.
 */
export async function forgotPassword(req, res) {
  try {
    const parseResult = forgotPasswordRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid recovery request',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { identifier } = parseResult.data;
    const trimmed = identifier.trim();
    const isEmail = trimmed.includes('@');
    const cleanPhone = trimmed.replace(/[\s\-]/g, '');

    const user = isEmail
      ? db.prepare('SELECT id, email, phone, is_active FROM users WHERE email = ? COLLATE NOCASE').get(trimmed)
      : db.prepare('SELECT id, email, phone, is_active FROM users WHERE phone = ? OR phone = ?').get(cleanPhone, cleanPhone.replace('+91', ''));

    const now = Date.now();
    const expiresAt = now + config.otpExpiryMs;
    const resendAvailableAt = now + config.otpCooldownMs;

    if (user && user.is_active === 1) {
      const otp = generateOtp();
      const otpHashed = hashOtp(otp);
      const resetId = uuidv4();
      const contactType = isEmail ? 'email' : 'phone';
      const contactValue = isEmail ? user.email : user.phone;

      // Invalidate existing unused reset requests for this user
      db.prepare(`
        DELETE FROM password_reset_requests
        WHERE user_id = ? AND used_at IS NULL
      `).run(user.id);

      db.prepare(`
        INSERT INTO password_reset_requests (
          id, user_id, contact_type, contact_value, otp_hash, expires_at,
          attempts, resend_available_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)
      `).run(resetId, user.id, contactType, contactValue, otpHashed, expiresAt, resendAvailableAt);

      if (contactType === 'email') {
        await dispatchEmailOtp(user.email, otp, 'password recovery');
      } else {
        await dispatchSmsOtp(user.phone, otp, 'password recovery');
      }

      return res.status(200).json({
        success: true,
        message: 'If an account exists with this contact information, a recovery code has been sent.',
        reset_id: resetId,
        contact_type: contactType,
        contact_masked: contactType === 'email' ? maskEmail(user.email) : maskPhone(user.phone),
        resend_cooldown_seconds: Math.ceil(config.otpCooldownMs / 1000),
      });
    }

    // Anti-enumeration: Return indistinguishable response for non-existent users
    return res.status(200).json({
      success: true,
      message: 'If an account exists with this contact information, a recovery code has been sent.',
      reset_id: uuidv4(),
      contact_type: isEmail ? 'email' : 'phone',
      contact_masked: isEmail ? maskEmail(trimmed) : maskPhone(trimmed),
      resend_cooldown_seconds: Math.ceil(config.otpCooldownMs / 1000),
    });
  } catch (error) {
    console.error('[Forgot Password Error]:', error);
    return res.status(500).json({ error: 'Internal server error during password recovery.' });
  }
}

/**
 * POST /api/auth/forgot-password/verify-otp
 * Verifies recovery OTP and returns short-lived reset token upon success.
 */
export async function verifyResetOtp(req, res) {
  try {
    const parseResult = verifyResetOtpSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid verification input',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { reset_id, otp } = parseResult.data;

    const resetReq = db.prepare(`
      SELECT * FROM password_reset_requests WHERE id = ?
    `).get(reset_id);

    if (!resetReq || resetReq.used_at) {
      return res.status(400).json({
        error: 'Invalid or expired recovery session. Please request a new recovery code.',
      });
    }

    const now = Date.now();
    if (now > resetReq.expires_at) {
      return res.status(400).json({
        error: 'Recovery code has expired. Please request a new recovery code.',
      });
    }

    if (resetReq.attempts >= config.otpMaxAttempts) {
      return res.status(400).json({
        error: 'Maximum verification attempts exceeded. Please request a new recovery code.',
      });
    }

    const isValid = verifyOtpHash(otp, resetReq.otp_hash);

    if (!isValid) {
      const nextAttempts = resetReq.attempts + 1;
      db.prepare(`
        UPDATE password_reset_requests SET attempts = ? WHERE id = ?
      `).run(nextAttempts, reset_id);

      return res.status(400).json({
        error: 'Invalid recovery code. Please check and try again.',
        attempts_remaining: Math.max(0, config.otpMaxAttempts - nextAttempts),
      });
    }

    // Verification successful: issue single-use reset token
    const resetToken = generateSecureToken();
    const tokenHash = hashToken(resetToken);
    const tokenExpiresAt = now + config.resetTokenExpiryMs;

    db.prepare(`
      UPDATE password_reset_requests
      SET verified_at = CURRENT_TIMESTAMP,
          reset_token_hash = ?,
          reset_token_expires_at = ?
      WHERE id = ?
    `).run(tokenHash, tokenExpiresAt, reset_id);

    return res.status(200).json({
      success: true,
      message: 'Recovery code verified successfully. Please enter your new password.',
      reset_token: resetToken,
    });
  } catch (error) {
    console.error('[Verify Reset OTP Error]:', error);
    return res.status(500).json({ error: 'Internal server error while verifying recovery code.' });
  }
}

/**
 * POST /api/auth/forgot-password/resend-otp
 * Resends recovery OTP with cooldown enforcement.
 */
export async function resendResetOtp(req, res) {
  try {
    const parseResult = resendResetOtpSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { reset_id } = parseResult.data;

    const resetReq = db.prepare(`
      SELECT * FROM password_reset_requests WHERE id = ? AND used_at IS NULL
    `).get(reset_id);

    if (!resetReq) {
      return res.status(400).json({
        error: 'Recovery session not found or already completed.',
      });
    }

    const now = Date.now();
    if (now < resetReq.resend_available_at) {
      const remainingSeconds = Math.ceil((resetReq.resend_available_at - now) / 1000);
      return res.status(429).json({
        error: 'Please wait before requesting another recovery code.',
        retry_after_seconds: remainingSeconds,
      });
    }

    const newOtp = generateOtp();
    const newOtpHashed = hashOtp(newOtp);
    const expiresAt = now + config.otpExpiryMs;
    const resendAvailableAt = now + config.otpCooldownMs;

    db.prepare(`
      UPDATE password_reset_requests
      SET otp_hash = ?,
          expires_at = ?,
          attempts = 0,
          resend_available_at = ?
      WHERE id = ?
    `).run(newOtpHashed, expiresAt, resendAvailableAt, reset_id);

    if (resetReq.contact_type === 'email') {
      await dispatchEmailOtp(resetReq.contact_value, newOtp, 'password recovery');
    } else {
      await dispatchSmsOtp(resetReq.contact_value, newOtp, 'password recovery');
    }

    return res.status(200).json({
      success: true,
      message: 'New recovery code sent successfully.',
      resend_cooldown_seconds: Math.ceil(config.otpCooldownMs / 1000),
    });
  } catch (error) {
    console.error('[Resend Reset OTP Error]:', error);
    return res.status(500).json({ error: 'Internal server error while resending recovery code.' });
  }
}

/**
 * POST /api/auth/reset-password
 * Resets user password, revokes existing sessions, and logs audit event.
 */
export async function resetPassword(req, res) {
  try {
    const parseResult = resetPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { reset_token, new_password } = parseResult.data;
    const tokenHash = hashToken(reset_token);

    const resetReq = db.prepare(`
      SELECT * FROM password_reset_requests
      WHERE reset_token_hash = ? AND used_at IS NULL
    `).get(tokenHash);

    if (!resetReq) {
      return res.status(400).json({
        error: 'Invalid or expired password reset session. Please request a new recovery code.',
      });
    }

    const now = Date.now();
    if (now > resetReq.reset_token_expires_at) {
      return res.status(400).json({
        error: 'Password reset session has expired. Please request a new recovery code.',
      });
    }

    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(resetReq.user_id);
    if (!user) {
      return res.status(400).json({
        error: 'User account not found.',
      });
    }

    // Hash new password using bcrypt (10 rounds)
    const password_hash = await bcrypt.hash(new_password, 10);

    // Update password and touch updated_at timestamp (to invalidate pre-existing JWTs)
    db.prepare(`
      UPDATE users
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(password_hash, user.id);

    // Invalidate recovery token immediately (single-use)
    db.prepare(`
      UPDATE password_reset_requests
      SET used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(resetReq.id);

    // Revoke all existing JWT sessions for this user in revoked_tokens table
    const expiresAt = Math.floor(Date.now() / 1000) + 7 * 86400;
    db.prepare(`
      INSERT OR IGNORE INTO revoked_tokens (token_id, user_id, expires_at)
      VALUES (?, ?, ?)
    `).run(`pwd_reset_${uuidv4()}`, user.id, expiresAt);

    // Clear session cookie if active
    res.clearCookie('civic_token', {
      ...cookieOptions,
      maxAge: 0,
    });

    // Record audit event without exposing password or OTP
    logAuditEvent({
      userId: user.id,
      action: 'PASSWORD_RESET',
      targetEntity: 'user',
      targetId: user.id,
      details: {
        method: 'otp_verification',
        contact_type: resetReq.contact_type,
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'],
    });

    // Do NOT auto-login; return citizen to sign-in screen
    return res.status(200).json({
      success: true,
      message: 'Password reset successful. Please sign in with your new password.',
    });
  } catch (error) {
    console.error('[Reset Password Error]:', error);
    return res.status(500).json({ error: 'Internal server error during password reset.' });
  }
}

/**
 * POST /api/auth/login
 * Authenticates citizen, official, or admin with rate limiting & generic errors.
 * Sets HttpOnly cookie. Raw JWT is NEVER returned in the JSON response under any header.
 */
export async function login(req, res) {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { email, password } = parseResult.data;

    const user = db.prepare(`
      SELECT u.id, u.email, u.password_hash, u.full_name, u.phone, u.role, u.department_id, u.is_active, u.created_at,
             d.name as department_name, d.code as department_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.email = ?
    `).get(email);

    // Generic error response to prevent user enumeration
    if (!user || user.is_active !== 1) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const safeUser = sanitizeUser(user);
    const { token } = signUserToken(safeUser);

    // Set secure HttpOnly cookie exclusively
    res.cookie('civic_token', token, cookieOptions);

    // Raw JWT is NEVER exposed in the JSON response payload under any circumstance or header
    return res.status(200).json({
      message: 'Login successful.',
      user: safeUser,
    });
  } catch (error) {
    console.error('[Login Error]:', error);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
}

/**
 * GET /api/auth/me
 * Returns currently authenticated user profile
 */
export async function getMe(req, res) {
  return res.status(200).json({
    user: req.user,
  });
}

/**
 * POST /api/auth/logout
 * Invalidates session cookie and records JWT in revoked_tokens table
 */
export async function logout(req, res) {
  try {
    if (req.tokenJti && req.user) {
      const expiresAt = req.tokenExp || Math.floor(Date.now() / 1000) + 7 * 86400;
      db.prepare(`
        INSERT OR IGNORE INTO revoked_tokens (token_id, user_id, expires_at)
        VALUES (?, ?, ?)
      `).run(req.tokenJti, req.user.id, expiresAt);
    }

    // Clean up expired revoked tokens asynchronously
    cleanupRevokedTokens();

    res.clearCookie('civic_token', {
      ...cookieOptions,
      maxAge: 0,
    });

    return res.status(200).json({
      message: 'Logged out successfully. Session invalidated.',
    });
  } catch (error) {
    console.error('[Logout Error]:', error);
    return res.status(500).json({ error: 'Error during session termination.' });
  }
}
