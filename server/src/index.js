import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import { initDatabase } from './config/database.js';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import complaintRoutes from './routes/complaintRoutes.js';
import officialRoutes from './routes/officialRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import geoRoutes from './routes/geoRoutes.js';
import intelligenceRoutes from './routes/intelligenceRoutes.js';
import grievanceRoutes from './routes/grievanceRoutes.js';
import { csrfProtection } from './middleware/csrfMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Initialize Database
try {
  initDatabase();
} catch (err) {
  console.error('[CivicMemory DB] Failed to initialize database:', err);
}

// Security & Utility Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Static route for uploaded complaint evidence
app.use('/uploads', express.static(config.uploadDir));

// API-wide CSRF Protection (defense-in-depth across all state-changing API routes)
app.use('/api', csrfProtection);

// API Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/official', officialRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/grievances', grievanceRoutes);

// Root information route
app.get('/', (req, res) => {
  res.json({
    message: 'CivicMemory API & Civic Intelligence Engine',
    status: 'online',
    healthCheck: '/api/health',
    authEndpoints: '/api/auth',
    complaintsEndpoint: '/api/complaints',
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[CivicMemory API Error]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// Start Server only when executed directly (not when imported in tests)
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain && process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`====================================================`);
    console.log(`CivicMemory Server running on http://localhost:${config.port}`);
    console.log(`Healthcheck: http://localhost:${config.port}/api/health`);
    console.log(`Auth API:    http://localhost:${config.port}/api/auth`);
    console.log(`Client URL:  ${config.clientUrl}`);
    console.log(`====================================================`);
  });
}

export default app;
