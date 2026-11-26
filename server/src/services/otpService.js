import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import { recordProviderSuccess, recordProviderFailure } from './providerAbuseService.js';

// In-memory test store strictly isolated to automated test suites (NODE_ENV === 'test')
const testDispatchedOtps = new Map();

// Lazy-initialized SMTP transporter singleton
let mailTransporter = null;

export function getMailTransporter() {
  if (!mailTransporter && config.smtpHost && config.smtpUser) {
    const isImplicitTls = config.smtpPort === 465;
    const isStartTls = config.smtpPort === 587;

    if (config.nodeEnv === 'production' && !isImplicitTls && !isStartTls) {
      throw new Error(`[FATAL SECURITY ERROR] In production, SMTP port must be 465 (implicit TLS) or 587 (mandatory STARTTLS). Insecure port ${config.smtpPort} is prohibited.`);
    }

    mailTransporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: isImplicitTls,
      requireTLS: isStartTls, // Strictly requires STARTTLS on port 587
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      },
    });
  }
  return mailTransporter;
}

export function resetMailTransporter() {
  mailTransporter = null;
}

/**
 * Generates an unpredictable, cryptographically secure 6-digit OTP string.
 */
export function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hashes an OTP with SHA-256 and server-side secret pepper (separated from JWT secret).
 */
export function hashOtp(otp) {
  if (!otp || typeof otp !== 'string') return '';
  return crypto.createHash('sha256').update(`${otp}:${config.otpPepperSecret}`).digest('hex');
}

/**
 * Constant-time verification of an input OTP against stored hash.
 */
export function verifyOtpHash(inputOtp, storedHash) {
  if (!inputOtp || !storedHash || typeof inputOtp !== 'string' || typeof storedHash !== 'string') {
    return false;
  }
  const computed = hashOtp(inputOtp);
  const bufA = Buffer.from(computed, 'hex');
  const bufB = Buffer.from(storedHash, 'hex');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generates a high-entropy hex token for verified password reset sessions.
 */
export function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hashes a reset token for secure database storage.
 */
export function hashToken(token) {
  if (!token || typeof token !== 'string') return '';
  return crypto.createHash('sha256').update(`${token}:${config.otpPepperSecret}`).digest('hex');
}

/**
 * Masks an email address for privacy and anti-enumeration display (e.g. j***e@example.com).
 */
export function maskEmail(email) {
  if (!email || !email.includes('@')) return '***@***.***';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Masks a mobile number for privacy and anti-enumeration display (e.g. ******3210).
 */
export function maskPhone(phone) {
  if (!phone || phone.length < 4) return '******';
  const clean = phone.replace(/[^0-9]/g, '');
  if (clean.length < 4) return '******';
  const visible = clean.slice(-4);
  return `${'*'.repeat(Math.max(4, clean.length - 4))}${visible}`;
}

/**
 * Dispatches Email OTP via configured SMTP gateway, with test and development simulation fallback.
 * In production, unconfigured or failing SMTP fails closed.
 */
export async function dispatchEmailOtp(email, otp, context = 'registration') {
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Configured Production/Staging SMTP gateway
  if (config.smtpHost && config.smtpUser) {
    try {
      const transporter = getMailTransporter();
      if (!transporter) {
        throw new Error('SMTP transporter failed to initialize.');
      }

      console.log(`[OTP Email Gateway] Sending ${context} OTP to ${maskEmail(normalizedEmail)} via SMTP (${config.smtpHost})`);
      const info = await transporter.sendMail({
        from: config.smtpFrom,
        to: normalizedEmail,
        subject: 'CivicMemory Verification Code',
        text: `Your CivicMemory verification code is: ${otp}. It will expire in 10 minutes. Do not share this code with anyone.`,
        html: `<p>Your CivicMemory verification code is: <strong>${otp}</strong>.</p><p>It will expire in 10 minutes. Do not share this code with anyone.</p>`,
      });

      if (info && (info.messageId || info.accepted?.length > 0)) {
        recordProviderSuccess('email');
        if (config.nodeEnv === 'test') {
          testDispatchedOtps.set(normalizedEmail, otp);
        }
        return {
          success: true,
          status: 'accepted',
          providerAccepted: true,
          delivered: false, // End-device delivery confirmation is asynchronous and not confirmed at submission time
          simulated: false,
          channel: 'email',
          recipient: maskEmail(normalizedEmail),
        };
      } else {
        recordProviderFailure('email');
        console.error('[OTP Email Gateway Error]: SMTP transport returned no messageId or accepted recipient');
        return {
          success: false,
          status: 'failed',
          providerAccepted: false,
          delivered: false,
          simulated: false,
          channel: 'email',
          error: 'Email provider did not confirm submission.',
        };
      }
    } catch (err) {
      recordProviderFailure('email');
      console.error('[OTP Email Gateway Error]: Failed to dispatch email via SMTP:', err.message);
      return {
        success: false,
        status: 'failed',
        providerAccepted: false,
        delivered: false,
        simulated: false,
        channel: 'email',
        error: 'Email delivery failed.',
      };
    }
  }

  // 2. Production mode without configured SMTP: Fail Closed
  if (config.nodeEnv === 'production') {
    console.error('[FATAL SECURITY ALERT] Production SMTP provider is unconfigured. Failing closed.');
    return {
      success: false,
      status: 'unconfigured',
      providerAccepted: false,
      delivered: false,
      simulated: false,
      channel: 'email',
      error: 'Email verification service is temporarily unavailable.',
      unconfigured: true,
    };
  }

  // 3. Isolated automated test environment
  if (config.nodeEnv === 'test') {
    testDispatchedOtps.set(normalizedEmail, otp);
    return {
      success: true,
      status: 'simulated',
      providerAccepted: false,
      delivered: false,
      simulated: true,
      channel: 'email',
      recipient: maskEmail(normalizedEmail),
    };
  }

  // 4. Permitted local development simulation (Plaintext OTP is NEVER logged)
  console.log(`[OTP Email Gateway (Dev Mode)] Dispatched simulated ${context} OTP to ${maskEmail(normalizedEmail)} (SMTP unconfigured)`);
  return {
    success: true,
    status: 'simulated',
    providerAccepted: false,
    delivered: false,
    simulated: true,
    channel: 'email',
    recipient: maskEmail(normalizedEmail),
  };
}

/**
 * Dispatches Mobile SMS OTP via configured HTTP SMS gateway, with test and development simulation fallback.
 * In production, unconfigured or failing SMS gateway fails closed.
 */
export async function dispatchSmsOtp(phone, otp, context = 'registration') {
  const cleanPhone = phone.trim();

  // 1. Configured Production/Staging SMS gateway
  if (config.smsGatewayUrl && config.smsApiKey) {
    try {
      console.log(`[OTP SMS Gateway] Sending ${context} OTP to ${maskPhone(cleanPhone)} via SMS gateway`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(config.smsGatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.smsApiKey}`,
          'X-Api-Key': config.smsApiKey,
        },
        body: JSON.stringify({
          sender_id: config.smsSenderId,
          phone: cleanPhone,
          message: `Your CivicMemory verification code is: ${otp}. Valid for 10 minutes.`,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        recordProviderSuccess('sms');
        if (config.nodeEnv === 'test') {
          testDispatchedOtps.set(cleanPhone, otp);
        }
        return {
          success: true,
          status: 'accepted',
          providerAccepted: true,
          delivered: false, // End-device delivery confirmation is asynchronous and not confirmed at submission time
          simulated: false,
          channel: 'sms',
          recipient: maskPhone(cleanPhone),
        };
      } else {
        recordProviderFailure('sms');
        console.error(`[OTP SMS Gateway Error]: SMS gateway returned HTTP ${response.status}`);
        return {
          success: false,
          status: 'failed',
          providerAccepted: false,
          delivered: false,
          simulated: false,
          channel: 'sms',
          error: 'SMS provider rejected dispatch request.',
        };
      }
    } catch (err) {
      recordProviderFailure('sms');
      console.error('[OTP SMS Gateway Error]: Failed to dispatch SMS via gateway:', err.message);
      return {
        success: false,
        status: 'failed',
        providerAccepted: false,
        delivered: false,
        simulated: false,
        channel: 'sms',
        error: 'SMS delivery failed.',
      };
    }
  }

  // 2. Production mode without configured SMS gateway: Fail Closed
  if (config.nodeEnv === 'production') {
    console.error('[FATAL SECURITY ALERT] Production SMS gateway is unconfigured. Failing closed.');
    return {
      success: false,
      status: 'unconfigured',
      providerAccepted: false,
      delivered: false,
      simulated: false,
      channel: 'sms',
      error: 'SMS verification service is temporarily unavailable.',
      unconfigured: true,
    };
  }

  // 3. Isolated automated test environment
  if (config.nodeEnv === 'test') {
    testDispatchedOtps.set(cleanPhone, otp);
    return {
      success: true,
      status: 'simulated',
      providerAccepted: false,
      delivered: false,
      simulated: true,
      channel: 'sms',
      recipient: maskPhone(cleanPhone),
    };
  }

  // 4. Permitted local development simulation (Plaintext OTP is NEVER logged)
  console.log(`[OTP SMS Gateway (Dev Mode)] Dispatched simulated ${context} OTP to ${maskPhone(cleanPhone)} (SMS Gateway unconfigured)`);
  return {
    success: true,
    status: 'simulated',
    providerAccepted: false,
    delivered: false,
    simulated: true,
    channel: 'sms',
    recipient: maskPhone(cleanPhone),
  };
}

/**
 * Retrieve the latest dispatched OTP for automated testing.
 * Strictly available ONLY inside isolated test environments (NODE_ENV === 'test').
 */
export function getTestOtp(recipient) {
  if (config.nodeEnv !== 'test') {
    return null;
  }
  if (!recipient || typeof recipient !== 'string') return null;
  return testDispatchedOtps.get(recipient.toLowerCase ? recipient.toLowerCase().trim() : recipient.trim()) || null;
}

/**
 * Clear test dispatched OTPs store.
 */
export function clearTestOtps() {
  testDispatchedOtps.clear();
}
