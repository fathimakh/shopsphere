import { Router } from 'express';
import {
  changePassword,
  deleteAccount,
  deleteUser,
  getCart,
  getProfile,
  getUserById,
  listUsers,
  saveCart,
  updateProfile,
  updateUser,
} from '../controllers/userProfile.js';
import { authorize, protect } from '../middleware/authMiddleware.js';
import { validateBody, validateObjectIdParam } from '../middleware/validateRequest.js';
import {
  adminUpdateUserRules,
  changePasswordRules,
  deleteAccountRules,
  saveCartRules,
  updateProfileRules,
} from '../validators/userValidators.js';

// Mounted at /api/users. Every route needs a logged-in user; /:id routes are admin only.
const router = Router();
const adminOnly = authorize('admin');

router.use(protect);
router.param('id', validateObjectIdParam('user'));

// Own profile and saved cart (declared before "/:id" so these paths are not read as ids).
router
  .route('/profile')
  .get(getProfile)
  .put(validateBody(updateProfileRules, { partial: true }), updateProfile)
  .delete(validateBody(deleteAccountRules), deleteAccount);
router.put('/profile/password', validateBody(changePasswordRules), changePassword);
router.route('/cart').get(getCart).put(validateBody(saveCartRules), saveCart);

// Admin user management
router.get('/', adminOnly, listUsers);
router
  .route('/:id')
  .get(adminOnly, getUserById)
  .put(adminOnly, validateBody(adminUpdateUserRules, { partial: true }), updateUser)
  .delete(adminOnly, deleteUser);

export default router;
