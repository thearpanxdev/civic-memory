import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || 'dev_civicmemory_secret_key_9921';
const otpPepperSecret = process.env.OTP_PEPPER_SECRET || 'dev_otp_pepper_secret_9921_default_key_secure';

// Production Security Checks
if (nodeEnv === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev_civicmemory_secret_key_9921') {
    throw new Error('[FATAL SECURITY ERROR] In production, JWT_SECRET must be explicitly set and cannot be the default development key.');
  }
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('[FATAL SECURITY ERROR] In production, JWT_SECRET must be at least 32 characters long for cryptographic security.');
  }
  if (!process.env.OTP_PEPPER_SECRET || process.env.OTP_PEPPER_SECRET === 'dev_otp_pepper_secret_9921_default_key_secure') {
    throw new Error('[FATAL SECURITY ERROR] In production, OTP_PEPPER_SECRET must be explicitly set and cannot be the default development key.');
  }
  if (process.env.OTP_PEPPER_SECRET.length < 32) {
    throw new Error('[FATAL SECURITY ERROR] In production, OTP_PEPPER_SECRET must be at least 32 characters long for cryptographic security.');
  }
  if (process.env.COOKIE_SECURE === 'false') {
    throw new Error('[FATAL SECURITY ERROR] In production, COOKIE_SECURE cannot be set to false. Cookies must be transmitted over HTTPS.');
  }
  if (process.env.SMTP_HOST) {
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    if (smtpPort !== 465 && smtpPort !== 587) {
      throw new Error(`[FATAL SECURITY ERROR] In production, SMTP_PORT must be 465 (implicit TLS) or 587 (mandatory STARTTLS). Insecure port ${smtpPort} is prohibited.`);
    }
  }
}

const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

// Allowed origins for CORS and CSRF Origin validation
const allowedOrigins = [
  clientUrl,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://192.168.0.168:5173',
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
  otpPepperSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieMaxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds (matches 7d JWT expiration)
  cookieSecure,
  cookieSameSite,
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  geminiTimeoutMs: parseInt(process.env.GEMINI_TIMEOUT_MS || '15000', 10),
  dbPath: process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.resolve(__dirname, '../../data/civicmemory.db'),
  uploadDir: process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, '../../uploads'),
  storageDir: process.env.STORAGE_DIR ? path.resolve(process.env.STORAGE_DIR) : path.resolve(__dirname, '../../storage'),
  protectedUploadDir: process.env.PROTECTED_UPLOAD_DIR ? path.resolve(process.env.PROTECTED_UPLOAD_DIR) : path.resolve(__dirname, '../../storage/evidence'),
  maxUploadFiles: parseInt(process.env.MAX_UPLOAD_FILES || '5', 10),
  maxUploadSizeBytes: parseInt(process.env.MAX_UPLOAD_SIZE_BYTES || '5242880', 10), // 5MB limit per image
  maxVideoSizeBytes: parseInt(process.env.MAX_VIDEO_SIZE_BYTES || '26214400', 10), // 25MB limit per video
  maxVideoDurationSeconds: parseInt(process.env.MAX_VIDEO_DURATION_SECONDS || '30', 10), // 30s limit
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  allowedMediaMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/webm', 'video/mp4'],
  // OTP, SMS & Email Gateway configuration (Never hardcode credentials)
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || 'no-reply@civicmemory.gov.in',
  smsGatewayUrl: process.env.SMS_GATEWAY_URL || '',
  smsApiKey: process.env.SMS_API_KEY || '',
  smsSenderId: process.env.SMS_SENDER_ID || 'CIVICMEM',
  otpExpiryMs: parseInt(process.env.OTP_EXPIRY_MS || '600000', 10), // 10 minutes default
  otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),
  otpCooldownMs: parseInt(process.env.OTP_COOLDOWN_MS || '60000', 10), // 60s cooldown
  resetTokenExpiryMs: parseInt(process.env.RESET_TOKEN_EXPIRY_MS || '900000', 10), // 15 mins default
};
