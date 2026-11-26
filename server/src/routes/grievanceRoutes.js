import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  submitGrievance,
  getMyGrievances,
  getMyGrievanceById,
} from '../controllers/grievanceController.js';

const router = express.Router();

// All grievance endpoints require authentication (citizens or officials)
router.use(authenticate);

// Submit a new grievance
router.post('/', submitGrievance);

// List grievances submitted by authenticated user
router.get('/my', getMyGrievances);

// Inspect single grievance with responses
router.get('/:id', getMyGrievanceById);

export default router;
