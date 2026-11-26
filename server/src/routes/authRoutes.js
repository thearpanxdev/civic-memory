import express from 'express';
import {
  register,
  verifyRegistrationOtp,
  resendRegistrationOtp,
  forgotPassword,
  verifyResetOtp,
  resendResetOtp,
  resetPassword,
  login,
  getMe,
  logout,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole, requireDepartment, authorizeComplaintAccess } from '../middleware/roleMiddleware.js';
import { loginRateLimiter, authRateLimiter } from '../middleware/rateLimiter.js';
import { csrfProtection } from '../middleware/csrfMiddleware.js';

const router = express.Router();

// Public Authentication Endpoints (Rate-limited, CSRF-protected)
router.post('/register', authRateLimiter, csrfProtection, register);
router.post('/register/verify-otp', authRateLimiter, csrfProtection, verifyRegistrationOtp);
router.post('/register/resend-otp', authRateLimiter, csrfProtection, resendRegistrationOtp);

router.post('/forgot-password', authRateLimiter, csrfProtection, forgotPassword);
router.post('/forgot-password/verify-otp', authRateLimiter, csrfProtection, verifyResetOtp);
router.post('/forgot-password/resend-otp', authRateLimiter, csrfProtection, resendResetOtp);
router.post('/reset-password', authRateLimiter, csrfProtection, resetPassword);

router.post('/login', loginRateLimiter, csrfProtection, login);

// Authenticated Session Endpoints
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, csrfProtection, logout);

// RBAC Protected Verification Endpoints (for access control and audit validation)
router.get('/test/citizen-only', authenticate, requireRole('citizen'), (req, res) => {
  res.json({ message: 'Welcome Citizen. You have access to this citizen-only resource.', user: req.user });
});

router.get('/test/official-only', authenticate, requireRole('official'), (req, res) => {
  res.json({ message: 'Welcome Official. You have access to departmental management tools.', user: req.user });
});

router.get('/test/admin-only', authenticate, requireRole('admin'), (req, res) => {
  res.json({ message: 'Welcome Admin. Full municipal administrative control granted.', user: req.user });
});

// Department-specific Verification Endpoint
router.get('/test/department/roads', authenticate, requireRole('official', 'admin'), requireDepartment('dept-roads'), (req, res) => {
  res.json({ message: 'Authorized access to Roads & Infrastructure department internal queue.', user: req.user });
});

router.get('/test/department/water', authenticate, requireRole('official', 'admin'), requireDepartment('dept-water'), (req, res) => {
  res.json({ message: 'Authorized access to Water Supply department internal queue.', user: req.user });
});

// Resource-level Complaint Authorization Verification Endpoint
router.get('/test/complaint/:id', authenticate, authorizeComplaintAccess('id'), (req, res) => {
  res.json({
    message: 'Authorized access to complaint record.',
    complaint: req.complaint,
    accessed_by: req.user.email,
    role: req.user.role,
  });
});

export default router;
