import express from 'express';
import {
  getComplaints,
  getComplaintById,
  updateComplaintStatus,
  supportComplaint,
} from '../controllers/complaintController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { csrfProtection } from '../middleware/csrfMiddleware.js';

const router = express.Router();

// Optional authentication middleware for GET / (handles both public feed and role-scoped queries)
function optionalAuthenticate(req, res, next) {
  if ((req.cookies && req.cookies.civic_token) || (req.headers.authorization && req.headers.authorization.startsWith('Bearer '))) {
    return authenticate(req, res, next);
  }
  next();
}

// 1. Query complaints (public feed or role-scoped queue)
router.get('/', optionalAuthenticate, getComplaints);

// 2. Inspect specific complaint details (strictly authorized server-side)
router.get('/:id', authenticate, getComplaintById);

// 3. Update complaint status (strictly authorized to assigned department official or admin)
router.patch('/:id/status', authenticate, csrfProtection, updateComplaintStatus);

// 4. Support an existing complaint (citizens only, CSRF-protected)
router.post('/:id/support', authenticate, csrfProtection, supportComplaint);

export default router;
