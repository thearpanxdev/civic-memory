import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import { initDatabase } from './config/database.js';
import healthRoutes from './routes/healthRoutes.js';

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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Static route for uploaded complaint evidence
app.use('/uploads', express.static(config.uploadDir));

// Routes
app.use('/api', healthRoutes);

// Root information route
app.get('/', (req, res) => {
  res.json({
    message: 'CivicMemory API & Civic Intelligence Engine',
    status: 'online',
    healthCheck: '/api/health',
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

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`====================================================`);
    console.log(`CivicMemory Server running on http://localhost:${config.port}`);
    console.log(`Healthcheck: http://localhost:${config.port}/api/health`);
    console.log(`Client URL: ${config.clientUrl}`);
    console.log(`====================================================`);
  });
}

export default app;
