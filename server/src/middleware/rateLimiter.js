import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

// Strict rate limiter for authentication routes (login attempts)
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.nodeEnv === 'test' ? 10000 : 15, // Limit each IP to 15 login requests per windowMs
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    error: 'Too many login attempts from this IP. Please try again after 15 minutes.',
  },
  skip: () => config.nodeEnv === 'test',
});

// Standard rate limiter for general auth operations (e.g. registration)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.nodeEnv === 'test' ? 10000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please slow down.',
  },
  skip: () => config.nodeEnv === 'test',
});

// Rate limiter for postal PIN lookup (60 requests per 15 minutes per IP)
export const geoLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => (req.headers['x-test-rate-limit'] ? 3 : (config.nodeEnv === 'test' ? 10000 : 60)),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many postal lookup requests from this IP. Please try again later.',
  },
  skip: (req) => config.nodeEnv === 'test' && !req.headers['x-test-rate-limit'],
});

// Dedicated strict rate limiter for AI locality assessment (20 requests per 15 minutes per IP)
export const localityCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => (req.headers['x-test-rate-limit'] ? 2 : (config.nodeEnv === 'test' ? 10000 : 20)),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many locality assessment requests from this IP. Please try again later.',
  },
  skip: (req) => config.nodeEnv === 'test' && !req.headers['x-test-rate-limit'],
});
