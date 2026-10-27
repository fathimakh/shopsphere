import {
  api,
  bearer,
  createAdmin,
  createProduct,
  createUser,
  useTestDatabase,
  validShippingAddress,
} from './helpers/testApp.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Interaction from '../models/interaction.js';
import Product from '../models/product.js';
import User from '../models/user.js';

useTestDatabase('orders');

const placeOrder = (token, items, paymentMethod = 'COD') =>
  api()
    .post('/api/orders')
    .set(bearer(token))
    .send({ items, shippingAddress: validShippingAddress(), paymentMethod });

const stockOf = async (product) => (await Product.findById(product._id)).stock;

describe('POST /api/orders', () => {
  it('prices the order on the server, reserves stock and records purchases', async () => {
    const shirt = await createProduct({ price: 400, stock: 5 });
    const mug = await createProduct({ price: 150, stock: 2 });
    const { user, token } = await createUser();
    await User.updateOne({ _id: user._id }, { cart: [{ product: shirt._id, quantity: 1 }] });

    const res = await placeOrder(token, [
      { product: shirt.id, quantity: 1, price: 1 },
      { product: shirt.id, quantity: 1 },
      { product: mug.id, quantity: 1 },
    ]).expect(201);

    const { order } = res.body;
    assert.equal(order.orderItems.length, 2, 'repeated lines are merged');
    assert.equal(order.orderItems.find((item) => item.name === shirt.name).quantity, 2);
    assert.equal(order.itemsPrice, 950);
    assert.equal(order.shippingPrice, 49);
    assert.equal(order.totalPrice, 999);
    assert.equal(order.status, 'pending');
    assert.equal(order.isPaid, false);
    assert.equal(order.shippingAddress.country, 'India');
    assert.equal(order.statusHistory[0].status, 'pending');

    assert.equal(await stockOf(shirt), 3);
    assert.equal((await Product.findById(shirt._id)).soldCount, 2);
    assert.equal(await Interaction.countDocuments({ user: user._id, event: 'purchase' }), 2);
    assert.equal((await User.findById(user._id).select('cart')).cart.length, 0, 'ordered items leave the saved cart');
  });

  it('ships free from ₹999 and marks simulated card payments as paid', async () => {
    const watch = await createProduct({ price: 999 });
    const { token } = await createUser();
    const { order } = (await placeOrder(token, [{ product: watch.id, quantity: 1 }], 'CARD').expect(201)).body;
    assert.equal(order.shippingPrice, 0);
    assert.equal(order.isPaid, true);
    assert.ok(order.paidAt);
    assert.equal(order.paymentResult.status, 'simulated-success');
  });

  it('answers 409 for insufficient stock and rolls back lines already reserved', async () => {
    const plenty = await createProduct({ stock: 10 });
    const scarce = await createProduct({ name: 'Scarce Lamp', stock: 1 });
    const { token } = await createUser();

    const res = await placeOrder(token, [
      { product: plenty.id, quantity: 2 },
      { product: scarce.id, quantity: 3 },
    ]).expect(409);
    assert.equal(res.body.message, 'Only 1 left of Scarce Lamp');
    assert.equal(res.body.code, 'INSUFFICIENT_STOCK');
    assert.equal(await stockOf(plenty), 10);
    assert.equal(await stockOf(scarce), 1);
  });

  it('rejects unknown products and invalid bodies', async () => {
    const { token } = await createUser();
    await placeOrder(token, [{ product: '507f1f77bcf86cd799439011', quantity: 1 }]).expect(400);

    const res = await api()
      .post('/api/orders')
      .set(bearer(token))
      .send({ items: [], shippingAddress: { city: 'X' }, paymentMethod: 'BITCOIN' })
      .expect(400);
    const fields = res.body.errors.map((error) => error.field);
    for (const field of ['items', 'shippingAddress.fullName', 'shippingAddress.postalCode', 'paymentMethod']) {
      assert.ok(fields.includes(field), field);
    }
    await api().post('/api/orders').send({}).expect(401);
  });
});

describe('reading orders', () => {
  it('lists my orders newest first and protects other shoppers\' orders', async () => {
    const product = await createProduct({ stock: 20 });
    const owner = await createUser();
    const stranger = await createUser();
    const admin = await createAdmin();

    const first = (await placeOrder(owner.token, [{ product: product.id, quantity: 1 }]).expect(201)).body.order;
    const second = (await placeOrder(owner.token, [{ product: product.id, quantity: 2 }]).expect(201)).body.order;

    const mine = await api().get('/api/orders/my').set(bearer(owner.token)).expect(200);
    assert.deepEqual(mine.body.orders.map((order) => order._id), [second._id, first._id]);
    assert.equal((await api().get('/api/orders/my').set(bearer(stranger.token)).expect(200)).body.orders.length, 0);

    await api().get(`/api/orders/${first._id}`).set(bearer(owner.token)).expect(200);
    await api().get(`/api/orders/${first._id}`).set(bearer(stranger.token)).expect(403);
    const asAdmin = await api().get(`/api/orders/${first._id}`).set(bearer(admin.token)).expect(200);
    assert.equal(asAdmin.body.order.user.email, owner.user.email);
    await api().get('/api/orders/bad-id').set(bearer(owner.token)).expect(400);
  });

  it('lets only admins list every order, filtered by status', async () => {
    const product = await createProduct({ stock: 5 });
    const shopper = await createUser();
    const admin = await createAdmin();
    await placeOrder(shopper.token, [{ product: product.id, quantity: 1 }]).expect(201);

    await api().get('/api/orders').set(bearer(shopper.token)).expect(403);
    const res = await api().get('/api/orders?status=pending&limit=50').set(bearer(admin.token)).expect(200);
    assert.ok(res.body.orders.length >= 1);
    assert.ok(res.body.orders.every((order) => order.status === 'pending'));
    assert.ok(res.body.orders[0].user.name);
    assert.equal(res.body.pagination.limit, 50);
    await api().get('/api/orders?status=lost').set(bearer(admin.token)).expect(400);
  });
});

describe('order status workflow', () => {
  it('moves forward one step at a time, records history and marks COD paid on delivery', async () => {
    const product = await createProduct({ stock: 5 });
    const shopper = await createUser();
    const { token } = await createAdmin();
    const { order } = (await placeOrder(shopper.token, [{ product: product.id, quantity: 1 }]).expect(201)).body;
    const setStatus = (status) => api().put(`/api/orders/${order._id}/status`).set(bearer(token)).send({ status });

    assert.equal((await setStatus('shipped').expect(409)).body.code, 'INVALID_STATUS_TRANSITION');
    await setStatus('processing').expect(200);
    await setStatus('shipped').expect(200);
    const delivered = (await setStatus('delivered').expect(200)).body.order;

    assert.deepEqual(delivered.statusHistory.map((entry) => entry.status), ['pending', 'processing', 'shipped', 'delivered']);
    assert.ok(delivered.deliveredAt);
    assert.equal(delivered.isPaid, true);
    await setStatus('cancelled').expect(409);
    await setStatus('teleported').expect(400);
    await api().put(`/api/orders/${order._id}/status`).set(bearer(shopper.token)).send({ status: 'processing' }).expect(403);
  });

  it('restocks when an admin cancels an open order', async () => {
    const product = await createProduct({ stock: 4 });
    const shopper = await createUser();
    const { token } = await createAdmin();
    const { order } = (await placeOrder(shopper.token, [{ product: product.id, quantity: 3 }]).expect(201)).body;
    assert.equal(await stockOf(product), 1);

    const res = await api().put(`/api/orders/${order._id}/status`).set(bearer(token)).send({ status: 'cancelled', note: 'Out of area' }).expect(200);
    assert.equal(res.body.order.status, 'cancelled');
    assert.equal(res.body.order.statusHistory.at(-1).note, 'Out of area');
    assert.equal(await stockOf(product), 4);
  });
});

describe('PUT /api/orders/:id/cancel', () => {
  it('lets the owner cancel a pending order once, restoring stock', async () => {
    const product = await createProduct({ stock: 3 });
    const owner = await createUser();
    const stranger = await createUser();
    const { order } = (await placeOrder(owner.token, [{ product: product.id, quantity: 2 }]).expect(201)).body;

    await api().put(`/api/orders/${order._id}/cancel`).set(bearer(stranger.token)).expect(403);
    const res = await api().put(`/api/orders/${order._id}/cancel`).set(bearer(owner.token)).expect(200);
    assert.equal(res.body.order.status, 'cancelled');
    assert.ok(res.body.order.cancelledAt);
    assert.equal(await stockOf(product), 3);

    const again = await api().put(`/api/orders/${order._id}/cancel`).set(bearer(owner.token)).expect(409);
    assert.equal(again.body.code, 'ORDER_NOT_CANCELLABLE');
    assert.equal(await stockOf(product), 3, 'no double restock');
  });

  it('refuses to cancel a shipped order', async () => {
    const product = await createProduct({ stock: 3 });
    const owner = await createUser();
    const { token } = await createAdmin();
    const { order } = (await placeOrder(owner.token, [{ product: product.id, quantity: 1 }]).expect(201)).body;
    for (const status of ['processing', 'shipped']) {
      await api().put(`/api/orders/${order._id}/status`).set(bearer(token)).send({ status }).expect(200);
    }
    await api().put(`/api/orders/${order._id}/cancel`).set(bearer(owner.token)).expect(409);
  });
});

describe('DELETE /api/orders/:id', () => {
  it('is admin only and returns the units of an open order to stock', async () => {
    const product = await createProduct({ stock: 5 });
    const shopper = await createUser();
    const { token } = await createAdmin();
    const { order } = (await placeOrder(shopper.token, [{ product: product.id, quantity: 2 }]).expect(201)).body;

    await api().delete(`/api/orders/${order._id}`).set(bearer(shopper.token)).expect(403);
    await api().delete(`/api/orders/${order._id}`).set(bearer(token)).expect(200);
    assert.equal(await stockOf(product), 5);
    await api().get(`/api/orders/${order._id}`).set(bearer(token)).expect(404);
  });
});
