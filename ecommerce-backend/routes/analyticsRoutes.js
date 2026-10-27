import express, { Router } from 'express';
import {
  clearImportedModel,
  exportInteractions,
  exportProducts,
  exportRatingMatrix,
  getProductRecommendations,
  getRecommendations,
  getStatus,
  getSummary,
  importSimilarities,
  trackInteraction,
} from '../controllers/analyticsController.js';
import { authorize, optionalAuth, protect } from '../middleware/authMiddleware.js';
import { validateBody, validateObjectIdParam } from '../middleware/validateRequest.js';
import { trackRules } from '../validators/analyticsValidators.js';

const router = Router();
const adminOnly = [protect, authorize('admin')];

// RapidMiner's scored output can be uploaded as a raw CSV body (curl --data-binary @file.csv).
const csvBody = express.text({ type: ['text/csv', 'text/plain'], limit: '10mb' });

router.param('id', validateObjectIdParam('product'));

router.post('/track', protect, validateBody(trackRules), trackInteraction);
router.get('/recommendations', optionalAuth, getRecommendations);
router.get('/recommendations/product/:id', getProductRecommendations);

router.get('/export/rating-matrix.csv', ...adminOnly, exportRatingMatrix);
router.get('/export/interactions.csv', ...adminOnly, exportInteractions);
router.get('/export/products.csv', ...adminOnly, exportProducts);

router.route('/import').post(...adminOnly, csvBody, importSimilarities).delete(...adminOnly, clearImportedModel);

router.get('/status', ...adminOnly, getStatus);
router.get('/summary', ...adminOnly, getSummary);

export default router;
