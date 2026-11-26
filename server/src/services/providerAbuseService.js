import db from '../config/database.js';
import { config } from '../config/env.js';

/**
 * CivicMemory — Provider Abuse Protection & Circuit Breaker Service
 *
 * Implements multi-tier destination and IP rate controls:
 * 1. SMS Dispatch per mobile phone number (Default: 5 dispatches per 1 hour)
 * 2. SMS Dispatch per client IP (Default: 10 dispatches per 1 hour)
 * 3. Global SMS Provider Volume Cap (Default: 100 dispatches per 15 minutes)
 * 4. Email Dispatch per destination address (Default: 8 dispatches per 1 hour)
 * 5. Email Dispatch per client IP (Default: 20 dispatches per 1 hour)
 * 6. Provider Circuit Breakers for SMS Gateway and SMTP
 *    - Trips OPEN after 5 consecutive failures
 *    - 60-second cooldown period before HALF_OPEN probe
 *
 * Deployment Architecture:
 * - Backed by persistent SQLite tables (provider_dispatch_quotas, provider_circuit_breakers).
 * - Multi-process / cluster safe (all workers share the DB via WAL mode).
 * - Bounded, expiring storage: auto-purges expired quota records on access.
 * - Uniform rate-limit error responses that never leak account registration status.
 */

export const DEFAULT_LIMITS = {
  smsPhoneMax: 5,
  smsPhoneWindowMs: 60 * 60 * 1000, // 1 hour

  smsIpMax: 10,
  smsIpWindowMs: 60 * 60 * 1000, // 1 hour

  smsGlobalMax: 100,
  smsGlobalWindowMs: 15 * 60 * 1000, // 15 minutes

  emailDestMax: 8,
  emailDestWindowMs: 60 * 60 * 1000, // 1 hour

  emailIpMax: 20,
  emailIpWindowMs: 60 * 60 * 1000, // 1 hour

  circuitBreakerThreshold: 5,
  circuitBreakerCooldownMs: 60 * 1000, // 60 seconds
};

let activeLimits = { ...DEFAULT_LIMITS };
let hasExplicitTestLimits = false;

export function setAbuseLimits(overrides) {
  activeLimits = { ...DEFAULT_LIMITS, ...overrides };
  hasExplicitTestLimits = true;
}

export function resetAbuseLimits() {
  activeLimits = { ...DEFAULT_LIMITS };
  hasExplicitTestLimits = false;
}

export function getEffectiveLimits(reqHeaders = {}) {
  if (config.nodeEnv === 'test') {
    if (reqHeaders['x-test-abuse-limits'] || hasExplicitTestLimits) {
      return activeLimits;
    }
    // High ceiling in default test runs to prevent unhindered standard suites from flaking
    return {
      ...activeLimits,
      smsPhoneMax: activeLimits.smsPhoneMax === DEFAULT_LIMITS.smsPhoneMax ? 10000 : activeLimits.smsPhoneMax,
      smsIpMax: activeLimits.smsIpMax === DEFAULT_LIMITS.smsIpMax ? 10000 : activeLimits.smsIpMax,
      smsGlobalMax: activeLimits.smsGlobalMax === DEFAULT_LIMITS.smsGlobalMax ? 10000 : activeLimits.smsGlobalMax,
      emailDestMax: activeLimits.emailDestMax === DEFAULT_LIMITS.emailDestMax ? 10000 : activeLimits.emailDestMax,
      emailIpMax: activeLimits.emailIpMax === DEFAULT_LIMITS.emailIpMax ? 10000 : activeLimits.emailIpMax,
    };
  }
  return activeLimits;
}

/**
 * Prunes expired quotas from the database to enforce strictly bounded storage.
 */
export function pruneExpiredQuotas(now = Date.now()) {
  try {
    db.prepare('DELETE FROM provider_dispatch_quotas WHERE window_expires_at < ?').run(now);
  } catch (_) {}
}

/**
 * Retrieves the current unexpired dispatch count for a given quota key.
 */
export function getQuotaCount(quotaKey, now = Date.now()) {
  pruneExpiredQuotas(now);
  const row = db.prepare(`
    SELECT dispatch_count, window_expires_at
    FROM provider_dispatch_quotas
    WHERE quota_key = ?
  `).get(quotaKey);

  if (!row || now > row.window_expires_at) return 0;
  return row.dispatch_count;
}

/**
 * Increments the dispatch count for a quota key within its sliding/fixed window.
 */
export function incrementQuota(quotaKey, windowMs, now = Date.now()) {
  pruneExpiredQuotas(now);
  const existing = db.prepare(`
    SELECT dispatch_count, window_expires_at
    FROM provider_dispatch_quotas
    WHERE quota_key = ?
  `).get(quotaKey);

  if (!existing || now > existing.window_expires_at) {
    db.prepare(`
      INSERT INTO provider_dispatch_quotas (quota_key, dispatch_count, window_start, window_expires_at)
      VALUES (?, 1, ?, ?)
      ON CONFLICT(quota_key) DO UPDATE SET
        dispatch_count = 1,
        window_start = excluded.window_start,
        window_expires_at = excluded.window_expires_at
    `).run(quotaKey, now, now + windowMs);
    return 1;
  } else {
    db.prepare(`
      UPDATE provider_dispatch_quotas
      SET dispatch_count = dispatch_count + 1
      WHERE quota_key = ?
    `).run(quotaKey);
    return existing.dispatch_count + 1;
  }
}

/**
 * Retrieves circuit breaker state for a provider (e.g. 'sms' or 'email').
 */
export function getCircuitBreakerState(providerName, now = Date.now()) {
  const row = db.prepare(`
    SELECT state, failure_count, last_failure_at, cooldown_until
    FROM provider_circuit_breakers
    WHERE provider_name = ?
  `).get(providerName);

  if (!row) {
    return { state: 'CLOSED', failure_count: 0, last_failure_at: 0, cooldown_until: 0 };
  }

  // Automatic transition from OPEN to HALF_OPEN when cooldown expires
  if (row.state === 'OPEN' && now >= row.cooldown_until) {
    db.prepare("UPDATE provider_circuit_breakers SET state = 'HALF_OPEN' WHERE provider_name = ?").run(providerName);
    return { state: 'HALF_OPEN', failure_count: row.failure_count, last_failure_at: row.last_failure_at, cooldown_until: row.cooldown_until };
  }

  return row;
}

/**
 * Records successful provider dispatch (resets circuit breaker to CLOSED).
 */
export function recordProviderSuccess(providerName) {
  db.prepare(`
    INSERT INTO provider_circuit_breakers (provider_name, state, failure_count, last_failure_at, cooldown_until)
    VALUES (?, 'CLOSED', 0, 0, 0)
    ON CONFLICT(provider_name) DO UPDATE SET
      state = 'CLOSED',
      failure_count = 0,
      cooldown_until = 0
  `).run(providerName);
}

/**
 * Records provider failure and trips breaker to OPEN if consecutive failures reach threshold.
 */
export function recordProviderFailure(providerName, now = Date.now()) {
  const limits = activeLimits;
  const current = getCircuitBreakerState(providerName, now);
  const nextFailures = current.failure_count + 1;
  const shouldTrip = nextFailures >= limits.circuitBreakerThreshold || current.state === 'HALF_OPEN';
  const nextState = shouldTrip ? 'OPEN' : (current.state === 'HALF_OPEN' ? 'OPEN' : 'CLOSED');
  const cooldownUntil = shouldTrip ? now + limits.circuitBreakerCooldownMs : current.cooldown_until;

  db.prepare(`
    INSERT INTO provider_circuit_breakers (provider_name, state, failure_count, last_failure_at, cooldown_until)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(provider_name) DO UPDATE SET
      state = excluded.state,
      failure_count = excluded.failure_count,
      last_failure_at = excluded.last_failure_at,
      cooldown_until = excluded.cooldown_until
  `).run(providerName, nextState, nextFailures, now, cooldownUntil);
}

/**
 * Manually trips a circuit breaker into OPEN state (useful for automated testing).
 */
export function tripCircuitBreaker(providerName, cooldownMs = 60000, now = Date.now()) {
  db.prepare(`
    INSERT INTO provider_circuit_breakers (provider_name, state, failure_count, last_failure_at, cooldown_until)
    VALUES (?, 'OPEN', 5, ?, ?)
    ON CONFLICT(provider_name) DO UPDATE SET
      state = 'OPEN',
      failure_count = 5,
      last_failure_at = excluded.last_failure_at,
      cooldown_until = excluded.cooldown_until
  `).run(providerName, now, now + cooldownMs);
}

/**
 * Pre-flight abuse and circuit breaker check before registration hashing and dispatch.
 */
export function checkRegistrationDispatchAbuse({ email, phone, ip, headers = {} }, now = Date.now()) {
  const limits = getEffectiveLimits(headers);
  const normEmail = (email || '').toLowerCase().trim();
  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  const cleanIp = (ip || 'unknown').trim();

  // 1. Upstream Provider Circuit Breakers
  const emailCb = getCircuitBreakerState('email', now);
  if (emailCb.state === 'OPEN') {
    return {
      allowed: false,
      status: 503,
      error: 'Email verification service is temporarily unavailable. Please try again later.',
      circuitBreaker: 'email',
    };
  }

  const smsCb = getCircuitBreakerState('sms', now);
  if (smsCb.state === 'OPEN') {
    return {
      allowed: false,
      status: 503,
      error: 'SMS verification service is temporarily unavailable. Please try again later.',
      circuitBreaker: 'sms',
    };
  }

  // 2. Global SMS Provider Volume Protection
  const globalSmsCount = getQuotaCount('sms:global', now);
  if (globalSmsCount >= limits.smsGlobalMax) {
    return {
      allowed: false,
      status: 503,
      error: 'Verification service volume limit reached. Please try again later.',
      quota: 'sms:global',
    };
  }

  // 3. Destination SMS Quota (Per Phone Number)
  if (cleanPhone) {
    const phoneCount = getQuotaCount(`sms:phone:${cleanPhone}`, now);
    if (phoneCount >= limits.smsPhoneMax) {
      return {
        allowed: false,
        status: 429,
        error: 'Too many verification attempts for this mobile number. Please try again later.',
        quota: 'sms:phone',
      };
    }
  }

  // 4. SMS Quota Per IP
  if (cleanIp && cleanIp !== 'unknown') {
    const ipSmsCount = getQuotaCount(`sms:ip:${cleanIp}`, now);
    if (ipSmsCount >= limits.smsIpMax) {
      return {
        allowed: false,
        status: 429,
        error: 'Too many SMS verification requests from this network. Please try again later.',
        quota: 'sms:ip',
      };
    }
  }

  // 5. Destination Email Quota (Per Email Address)
  if (normEmail) {
    const emailCount = getQuotaCount(`email:dest:${normEmail}`, now);
    if (emailCount >= limits.emailDestMax) {
      return {
        allowed: false,
        status: 429,
        error: 'Too many verification requests for this email address. Please try again later.',
        quota: 'email:dest',
      };
    }
  }

  // 6. Email Quota Per IP
  if (cleanIp && cleanIp !== 'unknown') {
    const ipEmailCount = getQuotaCount(`email:ip:${cleanIp}`, now);
    if (ipEmailCount >= limits.emailIpMax) {
      return {
        allowed: false,
        status: 429,
        error: 'Too many email verification requests from this network. Please try again later.',
        quota: 'email:ip',
      };
    }
  }

  return { allowed: true };
}

/**
 * Pre-flight check for channel resend requests.
 */
export function checkResendChannelAbuse({ channel, destination, ip, headers = {} }, now = Date.now()) {
  const limits = getEffectiveLimits(headers);
  const cleanIp = (ip || 'unknown').trim();

  if (channel === 'email') {
    const normEmail = (destination || '').toLowerCase().trim();
    const emailCb = getCircuitBreakerState('email', now);
    if (emailCb.state === 'OPEN') {
      return {
        allowed: false,
        status: 503,
        error: 'Email verification service is temporarily unavailable. Please try again later.',
      };
    }
    if (normEmail && getQuotaCount(`email:dest:${normEmail}`, now) >= limits.emailDestMax) {
      return {
        allowed: false,
        status: 429,
        error: 'Too many verification requests for this email address. Please try again later.',
      };
    }
    if (cleanIp !== 'unknown' && getQuotaCount(`email:ip:${cleanIp}`, now) >= limits.emailIpMax) {
      return {
        allowed: false,
        status: 429,
        error: 'Too many email verification requests from this network. Please try again later.',
      };
    }
  }

  if (channel === 'mobile' || channel === 'sms') {
    const cleanPhone = (destination || '').replace(/[^0-9]/g, '');
    const smsCb = getCircuitBreakerState('sms', now);
    if (smsCb.state === 'OPEN') {
      return {
        allowed: false,
        status: 503,
        error: 'SMS verification service is temporarily unavailable. Please try again later.',
      };
    }
    if (getQuotaCount('sms:global', now) >= limits.smsGlobalMax) {
      return {
        allowed: false,
        status: 503,
        error: 'Verification service volume limit reached. Please try again later.',
      };
    }
    if (cleanPhone && getQuotaCount(`sms:phone:${cleanPhone}`, now) >= limits.smsPhoneMax) {
      return {
        allowed: false,
        status: 429,
        error: 'Too many verification attempts for this mobile number. Please try again later.',
      };
    }
    if (cleanIp !== 'unknown' && getQuotaCount(`sms:ip:${cleanIp}`, now) >= limits.smsIpMax) {
      return {
        allowed: false,
        status: 429,
        error: 'Too many SMS verification requests from this network. Please try again later.',
      };
    }
  }

  return { allowed: true };
}

/**
 * Records dispatched OTP event against destination, IP, and global volume counters.
 */
export function recordDispatch({ email, phone, ip, headers = {} }, now = Date.now()) {
  const limits = getEffectiveLimits(headers);
  const cleanIp = (ip || 'unknown').trim();

  if (email) {
    const normEmail = email.toLowerCase().trim();
    incrementQuota(`email:dest:${normEmail}`, limits.emailDestWindowMs, now);
    if (cleanIp !== 'unknown') {
      incrementQuota(`email:ip:${cleanIp}`, limits.emailIpWindowMs, now);
    }
  }

  if (phone) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    incrementQuota(`sms:phone:${cleanPhone}`, limits.smsPhoneWindowMs, now);
    incrementQuota('sms:global', limits.smsGlobalWindowMs, now);
    if (cleanIp !== 'unknown') {
      incrementQuota(`sms:ip:${cleanIp}`, limits.smsIpWindowMs, now);
    }
  }
}

/**
 * Clears quota and circuit breaker state (strictly for test isolation).
 */
export function clearAbuseStore() {
  try {
    db.prepare('DELETE FROM provider_dispatch_quotas').run();
    db.prepare('DELETE FROM provider_circuit_breakers').run();
    db.prepare('DELETE FROM citizen_dummy_registrations').run();
  } catch (_) {}
}
