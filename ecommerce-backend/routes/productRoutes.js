import { Router } from 'express';
import {
  addReview,
  createProduct,
  deleteProduct,
  getCategories,
  getProduct,
  listProducts,
  updateProduct,
} from '../controllers/productController.js';
import { authorize, optionalAuth, protect } from '../middleware/authMiddleware.js';
import { validateBody, validateObjectIdParam } from '../middleware/validateRequest.js';
import { productRules, reviewRules } from '../validators/productValidators.js';

// Mounted at /api/products. Browsing is public; catalogue changes are admin only.
const router = Router();
const adminOnly = [protect, authorize('admin')];

router.param('id', validateObjectIdParam('product'));

router.route('/').get(listProducts).post(...adminOnly, validateBody(productRules), createProduct);
router.get('/categories', getCategories);
router
  .route('/:id')
  .get(optionalAuth, getProduct)
  .put(...adminOnly, validateBody(productRules, { partial: true }), updateProduct)
  .delete(...adminOnly, deleteProduct);
router.post('/:id/reviews', protect, validateBody(reviewRules), addReview);

export default router;
