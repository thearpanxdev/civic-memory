import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { csrfProtection } from '../middleware/csrfMiddleware.js';
import {
  getIntelligenceOverview,
  getRecurringIssues,
  getGeographicHotspots,
  getHistoricalTrendsData,
  generateReport,
  listReports,
  getReportById,
  exportReport,
} from '../controllers/intelligenceController.js';

const router = express.Router();

// All intelligence endpoints strictly require official or admin authorization
router.use(authenticate, requireRole('official', 'admin'));

// 1. Analytical data aggregations
router.get('/overview', getIntelligenceOverview);
router.get('/recurring', getRecurringIssues);
router.get('/hotspots', getGeographicHotspots);
router.get('/trends', getHistoricalTrendsData);

// 2. AI Executive Reports
router.post('/reports/generate', csrfProtection, generateReport);
router.get('/reports', listReports);
router.get('/reports/:id', getReportById);
router.get('/reports/:id/export', exportReport);

export default router;
