import { randomBytes } from 'node:crypto';
import Order, { CUSTOMER_CANCELLABLE, NEXT_STATUS, ORDER_STATUSES, calculateOrderPrices } from '../models/order.js';
import Product from '../models/product.js';
import User from '../models/user.js';
import { recordPurchases } from '../services/interactionService.js';
import ApiError from '../utils/ApiError.js';
import { buildPagination, createQueryReader } from '../utils/queryReader.js';

const USER_SUMMARY = 'name email';
const FINAL_STATUSES = ['delivered', 'cancelled'];
const DEFAULT_STATUS_NOTES = {
  processing: 'Order confirmed and being prepared',
  shipped: 'Order shipped',
  delivered: 'Order delivered',
  cancelled: 'Cancelled by the store',
};

const stockConflict = (name, available) =>
  ApiError.conflict(available > 0 ? `Only ${available} left of ${name}` : `${name} is out of stock`, 'INSUFFICIENT_STOCK');

/** Returns reserved units to stock (cancellation, deletion or a failed checkout). */
const restock = async (items) => {
  if (!items.length) return;
  await Product.bulkWrite(
    items.map(({ product, quantity }) => ({
      updateOne: { filter: { _id: product }, update: { $inc: { stock: quantity, soldCount: -quantity } } },
    })),
  );
};

/** Card payments are simulated: the order is marked paid with a fake gateway reference. */
const simulateCardPayment = () => ({
  status: 'simulated-success',
  reference: `SIM-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`,
});

const findOrderOr404 = async (id, { withUser = false } = {}) => {
  const query = Order.findById(id);
  if (withUser) query.populate('user', USER_SUMMARY);
  const order = await query;
  if (!order) throw ApiError.notFound('Order not found');
  return order;
};

// populated() returns the stored id when "user" was populated (even if that user was deleted since).
const isOwner = (order, user) => {
  const ownerId = order.populated('user') ?? order.user;
  return Boolean(ownerId) && user._id.equals(ownerId);
};

/**
 * Moves an order to `status`. The update is conditional on the status it was validated
 * against, so two concurrent changes (e.g. a double-clicked cancel) cannot both apply
 * and restock twice.
 */
const applyStatusChange = async (order, status, note) => {
  const at = new Date();
  const changes = { status };
  if (status === 'delivered') {
    changes.deliveredAt = at;
    // Cash on delivery is collected when the parcel arrives.
    if (!order.isPaid) Object.assign(changes, { isPaid: true, paidAt: at });
  }
  if (status === 'cancelled') changes.cancelledAt = at;

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    { $set: changes, $push: { statusHistory: { status, note, at } } },
    { returnDocument: 'after', runValidators: true },
  ).populate('user', USER_SUMMARY);
  if (!updated) throw ApiError.conflict('This order was just updated by someone else. Refresh and try again.', 'ORDER_CHANGED');

  if (status === 'cancelled') await restock(order.orderItems);
  return updated;
};

const cancellationNote = (order, note) => (order.isPaid ? `${note}. Refund issued (simulated)` : note);

// ---------------------------------------------------------------------------
// Shopper endpoints
// ---------------------------------------------------------------------------

/**
 * POST /api/orders — the server is authoritative: names, images and prices come from the
 * catalogue, totals are computed here, and stock is reserved with conditional atomic updates
 * that are rolled back if any line (or the order itself) fails.
 */
export const createOrder = async (req, res) => {
  const { items, shippingAddress, paymentMethod } = req.body;

  // Repeated lines for the same product are merged.
  const quantities = new Map();
  for (const { product, quantity } of items) {
    const id = product.toLowerCase();
    quantities.set(id, (quantities.get(id) ?? 0) + Number(quantity));
  }

  const products = await Product.find({ _id: { $in: [...quantities.keys()] } }).select('name price images thumbnail stock');
  const productsById = new Map(products.map((product) => [product.id, product]));
  const missing = [...quantities.keys()].filter((id) => !productsById.has(id));
  if (missing.length) {
    throw ApiError.badRequest('Some products in your order are no longer available. Please review your cart.', {
      code: 'PRODUCT_NOT_FOUND',
    });
  }

  const orderItems = [...quantities].map(([id, quantity]) => {
    const product = productsById.get(id);
    if (product.stock < quantity) throw stockConflict(product.name, product.stock);
    return {
      product: product._id,
      name: product.name,
      image: product.thumbnail || product.images[0] || '',
      price: product.price,
      quantity,
    };
  });

  const reserved = [];
  let order;
  try {
    for (const item of orderItems) {
      const { modifiedCount } = await Product.updateOne(
        { _id: item.product, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity, soldCount: item.quantity } },
      );
      if (!modifiedCount) {
        // Someone bought the last units between our read and this update.
        const current = await Product.findById(item.product).select('stock');
        throw stockConflict(item.name, current?.stock ?? 0);
      }
      reserved.push(item);
    }

    const placedAt = new Date();
    const paidByCard = paymentMethod === 'CARD';
    const { fullName, phone, street, city, state, postalCode, country } = shippingAddress;
    order = await Order.create({
      user: req.user._id,
      orderItems,
      shippingAddress: { fullName, phone, street, city, state, postalCode, country: country?.trim() || 'India' },
      paymentMethod,
      ...calculateOrderPrices(orderItems),
      isPaid: paidByCard,
      paidAt: paidByCard ? placedAt : null,
      paymentResult: paidByCard ? simulateCardPayment() : null,
      statusHistory: [
        { status: 'pending', note: paidByCard ? 'Order placed and paid by card (simulated)' : 'Order placed (cash on delivery)', at: placedAt },
      ],
    });
  } catch (error) {
    await restock(reserved);
    throw error;
  }

  const productIds = orderItems.map((item) => item.product);
  await Promise.all([
    // Purchases feed the recommender; a tracking failure must not fail a placed order.
    recordPurchases(req.user._id, productIds).catch((error) =>
      console.warn('[interactions] could not record purchases:', error.message),
    ),
    User.updateOne({ _id: req.user._id }, { $pull: { cart: { product: { $in: productIds } } } }),
  ]);

  res.status(201).json({ success: true, order });
};

/** GET /api/orders/my — the caller's orders, newest first. */
export const getMyOrders = async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, orders });
};

/** GET /api/orders/:id — visible to its owner and to admins. */
export const getOrderById = async (req, res) => {
  const order = await findOrderOr404(req.params.id, { withUser: true });
  if (!isOwner(order, req.user) && req.user.role !== 'admin') {
    throw ApiError.forbidden('You can only view your own orders');
  }
  res.json({ success: true, order });
};

/** PUT /api/orders/:id/cancel — the owner may cancel while the order is pending or processing. */
export const cancelOrder = async (req, res) => {
  const order = await findOrderOr404(req.params.id);
  if (!isOwner(order, req.user)) throw ApiError.forbidden('You can only cancel your own orders');
  if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
    throw ApiError.conflict(`This order is already ${order.status} and can no longer be cancelled`, 'ORDER_NOT_CANCELLABLE');
  }

  const updated = await applyStatusChange(order, 'cancelled', cancellationNote(order, 'Cancelled by customer'));
  res.json({ success: true, order: updated });
};

// ---------------------------------------------------------------------------
// Admin endpoints
// ---------------------------------------------------------------------------

/** GET /api/orders — all orders (query: status, page, limit), newest first. */
export const listOrders = async (req, res) => {
  const query = createQueryReader(req.query);
  const status = query.oneOf('status', ORDER_STATUSES);
  const { page, limit, skip } = query.pagination({ defaultLimit: 20, maxLimit: 100 });
  query.assertValid();

  const filter = status ? { status } : {};
  const [orders, total] = await Promise.all([
    Order.find(filter).populate('user', USER_SUMMARY).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, orders, pagination: buildPagination(page, limit, total) });
};

/**
 * PUT /api/orders/:id/status — pending → processing → shipped → delivered, or cancel anything
 * not yet delivered (which restocks). Every other transition is a 409.
 */
export const updateOrderStatus = async (req, res) => {
  const { status, note } = req.body;
  const order = await findOrderOr404(req.params.id);

  if (order.status === status) {
    throw ApiError.conflict(`Order is already ${status}`, 'INVALID_STATUS_TRANSITION');
  }
  const allowed = NEXT_STATUS[order.status] === status || (status === 'cancelled' && !FINAL_STATUSES.includes(order.status));
  if (!allowed) {
    throw ApiError.conflict(`Cannot change order status from ${order.status} to ${status}`, 'INVALID_STATUS_TRANSITION');
  }

  const statusNote = note?.trim() || DEFAULT_STATUS_NOTES[status];
  const updated = await applyStatusChange(order, status, status === 'cancelled' ? cancellationNote(order, statusNote) : statusNote);
  res.json({ success: true, order: updated });
};

/** DELETE /api/orders/:id — removes an order; units of an open order go back to stock. */
export const deleteOrder = async (req, res) => {
  const order = await findOrderOr404(req.params.id);
  await order.deleteOne();

  const wasOpen = !FINAL_STATUSES.includes(order.status);
  if (wasOpen) await restock(order.orderItems);
  res.json({ success: true, message: wasOpen ? 'Order deleted and its items returned to stock' : 'Order deleted' });
};
