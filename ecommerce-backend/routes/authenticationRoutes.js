import { Router } from 'express';
import { getMe, login, logout, register } from '../controllers/authentication.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validateRequest.js';
import { loginRules, logoutRules, registerRules } from '../validators/authValidators.js';

// Mounted at /api/auth (behind authLimiter).
const router = Router();

router.post('/register', validateBody(registerRules), register);
router.post('/login', validateBody(loginRules), login);
router.get('/me', protect, getMe);
router.post('/logout', protect, validateBody(logoutRules), logout);

export default router;
