import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || 'dev_civicmemory_secret_key_9921';

// Production Security Checks
if (nodeEnv === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev_civicmemory_secret_key_9921') {
    throw new Error('[FATAL SECURITY ERROR] In production, JWT_SECRET must be explicitly set and cannot be the default development key.');
  }
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('[FATAL SECURITY ERROR] In production, JWT_SECRET must be at least 32 characters long for cryptographic security.');
  }
  if (process.env.COOKIE_SECURE === 'false') {
    throw new Error('[FATAL SECURITY ERROR] In production, COOKIE_SECURE cannot be set to false. Cookies must be transmitted over HTTPS.');
  }
}

const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

// Allowed origins for CORS and CSRF Origin validation
const allowedOrigins = [
  clientUrl,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

// Determine cookie security settings
const cookieSecure = nodeEnv === 'production' || process.env.COOKIE_SECURE === 'true';

// Invariant: SameSite=None MUST be paired with Secure=true across all environments
const rawSameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
if (rawSameSite === 'none' && !cookieSecure) {
  throw new Error('[FATAL SECURITY ERROR] SameSite=None must always be paired with Secure=true. Browsers reject insecure SameSite=None cookies.');
}
const cookieSameSite = ['lax', 'strict', 'none'].includes(rawSameSite) ? rawSameSite : 'lax';

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv,
  clientUrl,
  allowedOrigins,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieMaxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds (matches 7d JWT expiration)
  cookieSecure,
  cookieSameSite,
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  dbPath: path.resolve(__dirname, '../../data/civicmemory.db'),
  uploadDir: path.resolve(__dirname, '../../uploads'),
  storageDir: path.resolve(__dirname, '../../storage'),
  protectedUploadDir: path.resolve(__dirname, '../../storage/evidence'),
  maxUploadFiles: parseInt(process.env.MAX_UPLOAD_FILES || '5', 10),
  maxUploadSizeBytes: parseInt(process.env.MAX_UPLOAD_SIZE_BYTES || '5242880', 10), // 5MB limit
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
};
