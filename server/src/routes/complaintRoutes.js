import express from 'express';
import {
  createComplaint,
  getComplaints,
  getComplaintById,
  getComplaintImage,
  updateComplaintStatus,
  supportComplaint,
  verifyComplaint,
  getWards,
  getDepartments,
} from '../controllers/complaintController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { csrfProtection } from '../middleware/csrfMiddleware.js';
import { uploadEvidenceMiddleware } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Optional authentication middleware for GET / (handles both public feed and role-scoped queries)
function optionalAuthenticate(req, res, next) {
  if ((req.cookies && req.cookies.civic_token) || (req.headers.authorization && req.headers.authorization.startsWith('Bearer '))) {
    return authenticate(req, res, next);
  }
  next();
}

// 1. Metadata endpoints (MUST be placed before /:id parameter route)
router.get('/meta/wards', getWards);
router.get('/meta/departments', getDepartments);

// 2. Query complaints (public feed or role-scoped queue via ?scope=my)
router.get('/', optionalAuthenticate, getComplaints);

// 3. Citizen complaint submission (with multipart photo upload and CSRF defense)
router.post(
  '/',
  authenticate,
  uploadEvidenceMiddleware,
  csrfProtection,
  createComplaint
);

// 4. Inspect specific complaint details (strictly authorized server-side)
router.get('/:id', authenticate, getComplaintById);

// 5. Protected evidence image retrieval (authenticated & authorized)
router.get('/:id/images/:imageId', authenticate, getComplaintImage);

// 6. Update complaint status (authorized department official or admin only)
router.patch('/:id/status', authenticate, csrfProtection, updateComplaintStatus);

// 7. Support an existing complaint (citizens only, CSRF-protected)
router.post('/:id/support', authenticate, csrfProtection, supportComplaint);

// 8. Citizen resolution verification (sign-off / reopen, CSRF-protected)
router.post('/:id/verify', authenticate, csrfProtection, verifyComplaint);

export default router;
