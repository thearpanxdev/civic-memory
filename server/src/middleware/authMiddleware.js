import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import db from '../config/database.js';

export function authenticate(req, res, next) {
  try {
    let token = null;

    // 1. Extract from HttpOnly cookie
    if (req.cookies && req.cookies.civic_token) {
      token = req.cookies.civic_token;
    }
    // 2. Fallback to Authorization: Bearer <token> header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
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

    // Check if token has been revoked (e.g. via logout)
    if (decoded.jti) {
      const revoked = db.prepare('SELECT token_id FROM revoked_tokens WHERE token_id = ?').get(decoded.jti);
      if (revoked) {
        return res.status(401).json({ error: 'Session has been invalidated. Please log in again.' });
      }
    }

    // Fetch live user status from database
    const userId = decoded.sub || decoded.id;
    const user = db.prepare(`
      SELECT u.id, u.email, u.full_name, u.phone, u.role, u.department_id, u.is_active, u.created_at,
             d.name as department_name, d.code as department_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `).get(userId);

    if (!user) {
      return res.status(401).json({ error: 'User account not found.' });
    }

    if (user.is_active !== 1) {
      return res.status(403).json({ error: 'Account has been deactivated. Please contact support.' });
    }

    // Attach sanitized user and token metadata to request
    req.user = user;
    req.tokenJti = decoded.jti;
    req.tokenExp = decoded.exp;

    next();
  } catch (error) {
    console.error('[Auth Middleware Error]:', error);
    return res.status(500).json({ error: 'Authentication processing failed.' });
  }
}
