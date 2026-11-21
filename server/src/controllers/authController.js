import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/database.js';
import { config } from '../config/env.js';
import { registerSchema, loginSchema } from '../validators/authValidators.js';

// Standard secure cookie configuration
const cookieOptions = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

// Helper to sign JWT with unique JTI for revokability
function signUserToken(user) {
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
function sanitizeUser(user) {
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

/**
 * POST /api/auth/register
 * Public registration restricted exclusively to 'citizen' role
 */
export async function register(req, res) {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { full_name, email, password, phone } = parseResult.data;

    // Check if user already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({
        error: 'An account with this email address already exists.',
      });
    }

    // Hash password with bcrypt
    const password_hash = bcrypt.hashSync(password, 10);
    const userId = `user-citizen-${uuidv4()}`;

    // Strictly enforce role = 'citizen' for public registration
    const role = 'citizen';

    db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, phone, role, department_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, NULL, 1)
    `).run(userId, email, password_hash, full_name, phone || null, role);

    const newUser = db.prepare(`
      SELECT id, email, full_name, phone, role, department_id, is_active, created_at
      FROM users WHERE id = ?
    `).get(userId);

    const { token } = signUserToken(newUser);

    res.cookie('civic_token', token, cookieOptions);

    return res.status(201).json({
      message: 'Citizen registration successful.',
      user: sanitizeUser(newUser),
      token,
    });
  } catch (error) {
    console.error('[Register Error]:', error);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
}

/**
 * POST /api/auth/login
 * Authenticates citizen, official, or admin with rate limiting & generic errors
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

    res.cookie('civic_token', token, cookieOptions);

    return res.status(200).json({
      message: 'Login successful.',
      user: safeUser,
      token,
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
 * Invalidate session cookie and records JWT in revoked_tokens table
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
