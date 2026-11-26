import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import {
  getAdminDashboard,
  getAdminDepartments,
  createDepartment,
  updateDepartment,
  toggleDepartmentStatus,
  getAdminOfficials,
  createOfficial,
  updateOfficialDepartment,
  toggleOfficialStatus,
  getAdminAnalytics,
  getAdminAuditLogs,
} from '../controllers/adminController.js';
import {
  setComplaintDeadline,
  removeComplaintDeadline,
  getComplaintDeadlineHistory,
} from '../controllers/deadlineController.js';
import {
  getAdminGrievances,
  getAdminGrievanceById,
  respondToGrievance,
  updateGrievanceStatus,
} from '../controllers/grievanceController.js';
import {
  getAdminTenders,
  getAdminTenderById,
  getEligibleComplaintsForTender,
  createGovernmentTender,
  markTenderReadyForPublication,
  publishGovernmentTender,
  updateGovernmentTenderStatus,
} from '../controllers/tenderController.js';

const router = express.Router();

// All admin routes strictly require authentication and 'admin' role
router.use(authenticate, requireRole('admin'));

// Municipal Platform Dashboard
router.get('/dashboard', getAdminDashboard);

// Departments overview & management
router.get('/departments', getAdminDepartments);
router.post('/departments', createDepartment);
router.put('/departments/:id', updateDepartment);
router.patch('/departments/:id/status', toggleDepartmentStatus);

// Official user accounts
router.get('/officials', getAdminOfficials);
router.post('/officials', createOfficial);
router.patch('/officials/:id/department', updateOfficialDepartment);
router.patch('/officials/:id/status', toggleOfficialStatus);

// Analytics & Visual Reporting
router.get('/analytics', getAdminAnalytics);

// Immutable System Audit Logs
router.get('/audit-logs', getAdminAuditLogs);

// Task Deadlines Management (Admin-Only Authority)
router.post('/complaints/:id/deadline', setComplaintDeadline);
router.delete('/complaints/:id/deadline', removeComplaintDeadline);
router.get('/complaints/:id/deadline-history', getComplaintDeadlineHistory);

// Grievance Support & Redressal Management
router.get('/grievances', getAdminGrievances);
router.get('/grievances/:id', getAdminGrievanceById);
router.post('/grievances/:id/respond', respondToGrievance);
router.patch('/grievances/:id/status', updateGrievanceStatus);

// Government Tender Management (State & Central Public Procurement)
router.get('/tenders', getAdminTenders);
router.get('/tenders/eligible-complaints', getEligibleComplaintsForTender);
router.get('/tenders/:id', getAdminTenderById);
router.post('/tenders', createGovernmentTender);
router.patch('/tenders/:id/ready', markTenderReadyForPublication);
router.patch('/tenders/:id/publish', publishGovernmentTender);
router.patch('/tenders/:id/status', updateGovernmentTenderStatus);

export default router;
