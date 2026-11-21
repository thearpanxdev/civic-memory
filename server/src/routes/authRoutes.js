import express from 'express';
import { register, login, getMe, logout } from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { loginRateLimiter, authRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public Authentication Endpoints
router.post('/register', authRateLimiter, register);
router.post('/login', loginRateLimiter, login);

// Authenticated Session Endpoints
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

// RBAC Protected Verification Endpoints (for access control validation)
router.get('/test/citizen-only', authenticate, requireRole('citizen'), (req, res) => {
  res.json({ message: 'Welcome Citizen. You have access to this citizen-only resource.', user: req.user });
});

router.get('/test/official-only', authenticate, requireRole('official'), (req, res) => {
  res.json({ message: 'Welcome Official. You have access to departmental management tools.', user: req.user });
});

router.get('/test/admin-only', authenticate, requireRole('admin'), (req, res) => {
  res.json({ message: 'Welcome Admin. Full municipal administrative control granted.', user: req.user });
});

export default router;
