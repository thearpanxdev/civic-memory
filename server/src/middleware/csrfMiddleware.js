import { config } from '../config/env.js';

/**
 * CSRF Protection Middleware
 * Protects state-changing endpoints against Cross-Site Request Forgery (CSRF).
 *
 * Rules:
 * 1. If request has a session cookie (`civic_token`):
 *    - MUST have either an Origin or Referer header; REJECTS if BOTH are missing.
 *    - Origin/Referer MUST match `config.allowedOrigins`.
 *    - MUST include custom header `X-Requested-With: XMLHttpRequest` (or `X-CSRF-Protection`).
 *    - Note: Presence of a Bearer header does NOT exempt a cookie-authenticated request,
 *      preventing attackers from bypassing CSRF by injecting dummy Authorization headers.
 * 2. If request is pure Bearer (no session cookie attached):
 *    - Allowed through because browsers never send Bearer headers on cross-site form/ambient submissions.
 * 3. Public endpoints without cookies (login, register):
 *    - Validates Origin if provided, ensuring cross-site scripts cannot submit forms from malicious domains.
 */
export function csrfProtection(req, res, next) {
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  // Safe read-only methods (GET, HEAD, OPTIONS) do not require CSRF verification
  if (!stateChangingMethods.includes(req.method)) {
    return next();
  }

  const hasCookieAuth = !!(req.cookies && req.cookies.civic_token);
  const authHeader = req.headers.authorization;
  const isPureBearer = !hasCookieAuth && !!(authHeader && authHeader.startsWith('Bearer '));

  // Pure programmatic Bearer token requests (no cookies) are immune to browser ambient-credential CSRF
  if (isPureBearer) {
    return next();
  }

  // Helper to validate origin/referer against allowedOrigins using exact origin matching
  const isAllowedOrigin = (urlStr) => {
    try {
      const parsed = new URL(urlStr);
      return config.allowedOrigins.some((allowed) => {
        try {
          return new URL(allowed).origin === parsed.origin;
        } catch {
          return allowed.replace(/\/$/, '') === parsed.origin;
        }
      });
    } catch {
      return false;
    }
  };

  // If request contains browser cookies, enforce strict CSRF verification
  if (hasCookieAuth) {
    const origin = req.headers.origin;
    const referer = req.headers.referer;

    // A. Reject if BOTH Origin and Referer are missing
    if (!origin && !referer) {
      return res.status(403).json({
        error: 'CSRF Protection: Missing Origin and Referer headers on cookie-authenticated state-changing request.',
      });
    }

    // B. Enforce trusted Origin and/or Referer (must match trusted origin exactly)
    if (origin && !isAllowedOrigin(origin)) {
      return res.status(403).json({
        error: 'CSRF Protection: Untrusted or unauthorized request Origin.',
      });
    }

    if (referer && !isAllowedOrigin(referer)) {
      return res.status(403).json({
        error: 'CSRF Protection: Untrusted or unauthorized request Referer.',
      });
    }

    // C. Enforce custom header (standard HTML forms cannot attach custom headers cross-site)
    const customHeader = req.headers['x-requested-with'] || req.headers['x-csrf-protection'];
    if (!customHeader) {
      return res.status(403).json({
        error: 'CSRF Protection: Missing required security header (X-Requested-With).',
      });
    }

    return next();
  }

  // Public state-changing requests without existing session (e.g. login, register):
  // Verify Origin / Referer if provided
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({
      error: 'CSRF Protection: Untrusted request Origin on public endpoint.',
    });
  }
  if (referer && !isAllowedOrigin(referer)) {
    return res.status(403).json({
      error: 'CSRF Protection: Untrusted request Referer on public endpoint.',
    });
  }

  next();
}
