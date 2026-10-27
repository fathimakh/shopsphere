import Interaction from '../models/interaction.js';
import Product from '../models/product.js';
import User from '../models/user.js';
import ApiError from '../utils/ApiError.js';
import generateToken from '../utils/generateToken.js';
import { buildPagination, createQueryReader } from '../utils/queryReader.js';
import { escapeRegex, isObjectIdString, normalizeEmail } from '../utils/strings.js';

const ADDRESS_FIELDS = ['street', 'city', 'state', 'postalCode', 'country'];
const PRODUCT_CARD_FIELDS = '-reviews -__v';

const wrongPassword = (field, message) =>
  new ApiError(400, message, { code: 'INVALID_PASSWORD', errors: [{ field, message }] });

/** 409 when another account already uses this email. */
const assertEmailAvailable = async (email, userId) => {
  if (await User.exists({ email, _id: { $ne: userId } })) {
    throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
  }
};

const findUserOr404 = async (id) => {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  return user;
};

// ---------------------------------------------------------------------------
// Own profile
// ---------------------------------------------------------------------------

/** GET /api/users/profile */
export const getProfile = (req, res) => {
  res.json({ success: true, user: req.user });
};

/** PUT /api/users/profile — partial update of name, email, phone and address fields. */
export const updateProfile = async (req, res) => {
  const { name, email, phone, address } = req.body;
  const user = req.user;

  if (name !== undefined) user.name = name.trim();
  if (email !== undefined) {
    const normalizedEmail = normalizeEmail(email);
    await assertEmailAvailable(normalizedEmail, user._id);
    user.email = normalizedEmail;
  }
  if (phone !== undefined) user.phone = phone?.trim() ?? '';
  if (address) {
    // Only the address fields that were sent change; an empty string clears a field.
    for (const field of ADDRESS_FIELDS) {
      if (address[field] !== undefined) user.address[field] = address[field]?.trim() ?? '';
    }
  }

  await user.save();
  res.json({ success: true, user });
};

/** PUT /api/users/profile/password — verifies the current password, then revokes every older token. */
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password +tokenVersion');

  if (!(await user.comparePassword(currentPassword))) {
    throw wrongPassword('currentPassword', 'Current password is incorrect');
  }
  if (await user.comparePassword(newPassword)) {
    throw ApiError.validation(
      [{ field: 'newPassword', message: 'New password must be different from the current password' }],
      'New password must be different from the current password',
    );
  }

  user.password = newPassword;
  user.tokenVersion += 1;
  await user.save();

  res.json({
    success: true,
    message: 'Password updated. Other sessions have been signed out.',
    token: generateToken(user),
  });
};

/** DELETE /api/users/profile — closes the caller's account after re-entering the password. */
export const deleteAccount = async (req, res) => {
  if (req.user.role === 'admin') {
    throw ApiError.conflict('Administrator accounts cannot be self-deleted. Ask another admin to remove it.', 'SELF_DELETE');
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(req.body.password))) {
    throw wrongPassword('password', 'Password is incorrect');
  }

  // Orders are kept as business records (they snapshot names and prices); browsing data is not.
  await Promise.all([User.deleteOne({ _id: user._id }), Interaction.deleteMany({ user: user._id })]);
  res.json({ success: true, message: 'Your account has been deleted' });
};

// ---------------------------------------------------------------------------
// Saved cart (mirrors the Redux cart so it follows the user across devices)
// ---------------------------------------------------------------------------

/** Keeps purchasable lines only: existing, in-stock products with a quantity within 1..stock. */
const toCartLines = (items) =>
  items
    .filter(({ product }) => product && product.stock > 0)
    .map(({ product, quantity }) => ({ product, quantity: Math.min(Math.max(1, quantity), product.stock) }));

/** GET /api/users/cart — saved cart with populated products. */
export const getCart = async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('cart')
    .populate({ path: 'cart.product', select: PRODUCT_CARD_FIELDS });
  res.json({ success: true, cart: toCartLines(user.cart) });
};

/**
 * PUT /api/users/cart — replaces the saved cart. Malformed or unknown product ids and
 * out-of-stock products are dropped, duplicate lines are merged and quantities are
 * clamped to 1..stock, so the stored cart is always purchasable.
 */
export const saveCart = async (req, res) => {
  const quantities = new Map();
  for (const { product, quantity } of req.body.items) {
    const id = String(product).trim().toLowerCase();
    if (isObjectIdString(id)) quantities.set(id, (quantities.get(id) ?? 0) + Number(quantity));
  }

  const products = await Product.find({ _id: { $in: [...quantities.keys()] } }).select(PRODUCT_CARD_FIELDS);
  const productsById = new Map(products.map((product) => [product.id, product]));
  const cart = toCartLines(
    [...quantities].map(([id, quantity]) => ({ product: productsById.get(id), quantity })),
  );

  await User.updateOne(
    { _id: req.user._id },
    { $set: { cart: cart.map(({ product, quantity }) => ({ product: product._id, quantity })) } },
  );
  res.json({ success: true, cart });
};

// ---------------------------------------------------------------------------
// Admin user management
// ---------------------------------------------------------------------------

/** GET /api/users — query: search (name/email), role, page, limit. */
export const listUsers = async (req, res) => {
  const query = createQueryReader(req.query);
  const search = query.string('search');
  const role = query.oneOf('role', User.schema.path('role').enumValues);
  const { page, limit, skip } = query.pagination({ defaultLimit: 20, maxLimit: 100 });
  query.assertValid();

  const filter = {};
  if (role) filter.role = role;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, users, pagination: buildPagination(page, limit, total) });
};

/** GET /api/users/:id */
export const getUserById = async (req, res) => {
  res.json({ success: true, user: await findUserOr404(req.params.id) });
};

/** PUT /api/users/:id — name, email and role. An admin cannot change their own role. */
export const updateUser = async (req, res) => {
  const { name, email, role } = req.body;
  const user = await findUserOr404(req.params.id);

  if (role !== undefined && role !== user.role && user._id.equals(req.user._id)) {
    throw ApiError.conflict('You cannot change your own role', 'SELF_ROLE_CHANGE');
  }
  if (name !== undefined) user.name = name.trim();
  if (email !== undefined) {
    const normalizedEmail = normalizeEmail(email);
    await assertEmailAvailable(normalizedEmail, user._id);
    user.email = normalizedEmail;
  }
  if (role !== undefined) user.role = role;

  await user.save();
  res.json({ success: true, user });
};

/** DELETE /api/users/:id — an admin cannot delete their own account. */
export const deleteUser = async (req, res) => {
  if (req.user._id.equals(req.params.id)) {
    throw ApiError.conflict('You cannot delete your own account', 'SELF_DELETE');
  }
  const user = await findUserOr404(req.params.id);

  await Promise.all([User.deleteOne({ _id: user._id }), Interaction.deleteMany({ user: user._id })]);
  res.json({ success: true, message: `User ${user.email} deleted` });
};
