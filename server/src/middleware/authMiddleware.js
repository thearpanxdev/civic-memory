import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import db from '../config/database.js';

/**
 * Authentication Middleware
 * Validates JWT from HttpOnly cookie (preferred) or Authorization: Bearer header.
 * Enforces cryptographic signature, expiration, and server-side JTI revocation.
 */
export function authenticate(req, res, next) {
  try {
    let token = null;
    let authSource = 'none';

    // 1. Preferred source: Secure HttpOnly cookie
    if (req.cookies && req.cookies.civic_token) {
      token = req.cookies.civic_token;
      authSource = 'cookie';
    }
    // 2. Programmatic API fallback: Authorization header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
      authSource = 'header';
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. No session found.' });
    }

    // Verify token signature and expiration
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Session expired. Please log in again.' });
      }
      return res.status(401).json({ error: 'Invalid authentication token.' });
    }

    // Enforce JTI requirement (all valid tokens must have a unique JTI for revokability)
    if (!decoded.jti) {
      return res.status(401).json({ error: 'Invalid authentication token: Missing token identifier.' });
    }

    // Check if token has been revoked (with safe database fail-closed handling)
    let isRevoked = false;
    try {
      const revoked = db.prepare('SELECT token_id FROM revoked_tokens WHERE token_id = ?').get(decoded.jti);
      isRevoked = !!revoked;
    } catch (dbErr) {
      console.error('[Auth Revocation Check Error]:', dbErr);
      // Fail closed: reject request if revocation status cannot be verified
      return res.status(500).json({ error: 'Authentication verification service temporarily unavailable.' });
    }

    if (isRevoked) {
      return res.status(401).json({ error: 'Session has been invalidated. Please log in again.' });
    }

    // Fetch live user status from database
    const userId = decoded.sub || decoded.id;
    let user;
    try {
      user = db.prepare(`
        SELECT u.id, u.email, u.full_name, u.phone, u.role, u.department_id, u.is_active, u.created_at,
               d.name as department_name, d.code as department_code
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.id = ?
      `).get(userId);
    } catch (dbErr) {
      console.error('[Auth User Lookup Error]:', dbErr);
      return res.status(500).json({ error: 'User lookup service error.' });
    }

    if (!user) {
      return res.status(401).json({ error: 'User account not found.' });
    }

    if (user.is_active !== 1) {
      return res.status(403).json({ error: 'Account has been deactivated. Please contact support.' });
    }

    // Attach sanitized user, token metadata, and auth source to request
    req.user = user;
    req.tokenJti = decoded.jti;
    req.tokenExp = decoded.exp;
    req.authSource = authSource;

    next();
  } catch (error) {
    console.error('[Auth Middleware Error]:', error);
    return res.status(500).json({ error: 'Authentication processing failed.' });
  }
}
