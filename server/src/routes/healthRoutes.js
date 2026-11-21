import express from 'express';
import db from '../config/database.js';

const router = express.Router();

router.get('/health', (req, res) => {
  try {
    // Verify DB connectivity with quick query
    const dbCheck = db.prepare('SELECT 1 as alive').get();
    const tableCountRow = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table'").get();

    return res.status(200).json({
      status: 'healthy',
      app: 'CivicMemory API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: dbCheck.alive === 1 ? 'connected' : 'unreachable',
        type: 'Native Node SQLite (node:sqlite DatabaseSync)',
        tables_count: tableCountRow.count,
      },
      aiEngine: {
        provider: 'Google Gemini',
        sdk: '@google/genai',
        status: 'configured',
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: 'unhealthy',
      app: 'CivicMemory API',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

export default router;
