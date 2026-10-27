import { Router } from 'express';
import {
  deleteContactMessage,
  listContactMessages,
  submitContactMessage,
  updateContactStatus,
} from '../controllers/contactController.js';
import { authorize, optionalAuth, protect } from '../middleware/authMiddleware.js';
import { contactLimiter } from '../middleware/rateLimiter.js';
import { validateBody, validateObjectIdParam } from '../middleware/validateRequest.js';
import { contactRules, contactStatusRules } from '../validators/contactValidators.js';

// Mounted at /api/contact. Anyone can write to us; only admins read the inbox.
const router = Router();
const adminOnly = [protect, authorize('admin')];

router.param('id', validateObjectIdParam('message'));

router
  .route('/')
  .post(contactLimiter, optionalAuth, validateBody(contactRules), submitContactMessage)
  .get(...adminOnly, listContactMessages);
router
  .route('/:id')
  .patch(...adminOnly, validateBody(contactStatusRules), updateContactStatus)
  .delete(...adminOnly, deleteContactMessage);

export default router;
