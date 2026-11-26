import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { uploadEvidenceMiddleware } from '../middleware/uploadMiddleware.js';
import {
  getOfficialDashboard,
  getDepartmentComplaints,
  getDepartmentComplaintById,
  getDepartmentOfficials,
  assignComplaint,
  updateOfficialComplaintStatus,
  addProgressUpdate,
  uploadRepairEvidence,
  acceptComplaint,
  reassignDepartment,
  getRoutingHistory,
  reviseTranslation,
  getOfficialNotifications,
} from '../controllers/officialController.js';
import {
  setComplaintDeadline,
  removeComplaintDeadline,
} from '../controllers/deadlineController.js';

const router = express.Router();

// All official routes require authentication and official or admin role
router.use(authenticate, requireRole('official', 'admin'));

// Dashboard & KPI Overview
router.get('/dashboard', getOfficialDashboard);

// Department Complaints Queue (Paginated & Filtered)
router.get('/complaints', getDepartmentComplaints);

// Department Officials (for assignment picker)
router.get('/officials', getDepartmentOfficials);

// Single Complaint Detail Inspection
router.get('/complaints/:id', getDepartmentComplaintById);

// Assign Official within Department (Strictly Admin only)
router.post('/complaints/:id/assign', requireRole('admin'), assignComplaint);

// Set or Modify Task Deadline (Strictly Admin only — Engineers strictly forbidden)
router.post('/complaints/:id/deadline', requireRole('admin'), setComplaintDeadline);
router.delete('/complaints/:id/deadline', requireRole('admin'), removeComplaintDeadline);

// Official notifications
router.get('/notifications', getOfficialNotifications);

// Update Status (Under Review, Verified, Assigned, In Progress, Work Completed)
router.patch('/complaints/:id/status', updateOfficialComplaintStatus);

// Post Progress Note / Dispatch Update
router.post('/complaints/:id/progress', addProgressUpdate);

// Upload Before/After Repair Evidence Photos
router.post('/complaints/:id/evidence', uploadEvidenceMiddleware, uploadRepairEvidence);

// Formally Accept / Acknowledge Complaint into Department
router.post('/complaints/:id/accept', acceptComplaint);

// Reassign Complaint to another Department (preserves AI recommendation)
router.post('/complaints/:id/reassign-department', reassignDepartment);

// Routing and Assignment Audit Trail
router.get('/complaints/:id/routing-history', getRoutingHistory);

// Revise / Regenerate Standardised English Translation
router.post('/complaints/:id/revise-translation', reviseTranslation);

export default router;
