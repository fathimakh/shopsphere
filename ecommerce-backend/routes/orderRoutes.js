import { Router } from 'express';
import {
  cancelOrder,
  createOrder,
  deleteOrder,
  getMyOrders,
  getOrderById,
  listOrders,
  updateOrderStatus,
} from '../controllers/orderController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';
import { validateBody, validateObjectIdParam } from '../middleware/validateRequest.js';
import { createOrderRules, updateOrderStatusRules } from '../validators/orderValidators.js';

// Mounted at /api/orders. Every route needs a logged-in user; ownership is checked per order.
const router = Router();
const adminOnly = authorize('admin');

router.use(protect);
router.param('id', validateObjectIdParam('order'));

router.route('/').post(validateBody(createOrderRules), createOrder).get(adminOnly, listOrders);
router.get('/my', getMyOrders);
router.route('/:id').get(getOrderById).delete(adminOnly, deleteOrder);
router.put('/:id/cancel', cancelOrder);
router.put('/:id/status', adminOnly, validateBody(updateOrderStatusRules), updateOrderStatus);

export default router;
