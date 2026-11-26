import express from 'express';
import {
  getStates,
  getDistricts,
  getUlbs,
  lookupPincode,
  checkLocality,
} from '../controllers/geoController.js';
import {
  geoLookupLimiter,
  localityCheckLimiter,
} from '../middleware/rateLimiter.js';

const router = express.Router();

router.get('/states', getStates);
router.get('/districts', getDistricts);
router.get('/ulbs', getUlbs);
router.get('/pincode/:pincode', geoLookupLimiter, lookupPincode);
router.post('/check-locality', localityCheckLimiter, checkLocality);

export default router;
