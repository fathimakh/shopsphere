import { api, bearer, createAdmin, createProduct, createUser, useTestDatabase } from './helpers/testApp.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Interaction from '../models/interaction.js';
import User from '../models/user.js';

useTestDatabase('users');

describe('own profile', () => {
  it('reads and partially updates the profile', async () => {
    const { token } = await createUser({ name: 'Asha Nair' });

    const profile = await api().get('/api/users/profile').set(bearer(token)).expect(200);
    assert.equal(profile.body.user.name, 'Asha Nair');
    assert.equal(profile.body.user.password, undefined);

    const res = await api()
      .put('/api/users/profile')
      .set(bearer(token))
      .send({ phone: '+91 98765 43210', address: { city: 'Kochi', postalCode: '682001' }, role: 'admin' })
      .expect(200);
    assert.equal(res.body.user.phone, '+91 98765 43210');
    assert.equal(res.body.user.address.city, 'Kochi');
    assert.equal(res.body.user.address.country, 'India');
    assert.equal(res.body.user.role, 'user', 'role cannot be self-assigned');
  });

  it('validates fields and refuses an email used by another account', async () => {
    const other = await createUser();
    const { token } = await createUser();
    await api().put('/api/users/profile').set(bearer(token)).send({}).expect(400);
    await api().put('/api/users/profile').set(bearer(token)).send({ phone: 'call me' }).expect(400);
    const res = await api().put('/api/users/profile').set(bearer(token)).send({ email: other.user.email.toUpperCase() }).expect(409);
    assert.equal(res.body.code, 'EMAIL_TAKEN');
  });

  it('changes the password, returns a new token and revokes the old one', async () => {
    const { user, token, password } = await createUser();

    await api()
      .put('/api/users/profile/password')
      .set(bearer(token))
      .send({ currentPassword: 'wrong-pass1', newPassword: 'NewPassw0rd' })
      .expect(400);
    const res = await api()
      .put('/api/users/profile/password')
      .set(bearer(token))
      .send({ currentPassword: password, newPassword: 'NewPassw0rd' })
      .expect(200);

    assert.equal((await api().get('/api/auth/me').set(bearer(token)).expect(401)).body.code, 'TOKEN_REVOKED');
    await api().get('/api/auth/me').set(bearer(res.body.token)).expect(200);
    await api().post('/api/auth/login').send({ email: user.email, password: 'NewPassw0rd' }).expect(200);
  });

  it('deletes the account after the password is confirmed', async () => {
    const product = await createProduct();
    const { user, token, password } = await createUser();
    await Interaction.create({ user: user._id, product: product._id, event: 'view', weight: 1 });

    await api().delete('/api/users/profile').set(bearer(token)).send({ password: 'not-it-123' }).expect(400);
    await api().delete('/api/users/profile').set(bearer(token)).send({ password }).expect(200);
    assert.equal(await User.exists({ _id: user._id }), null);
    assert.equal(await Interaction.countDocuments({ user: user._id }), 0);
    assert.equal((await api().get('/api/auth/me').set(bearer(token)).expect(401)).body.code, 'USER_NOT_FOUND');
  });
});

describe('saved cart', () => {
  it('drops unknown and out-of-stock products, merges duplicates and clamps quantities', async () => {
    const lamp = await createProduct({ stock: 3 });
    const soldOut = await createProduct({ stock: 0 });
    const { token } = await createUser();

    const res = await api()
      .put('/api/users/cart')
      .set(bearer(token))
      .send({
        items: [
          { product: lamp.id, quantity: 2 },
          { product: lamp.id, quantity: 4 },
          { product: soldOut.id, quantity: 1 },
          { product: '507f1f77bcf86cd799439011', quantity: 1 },
          { product: 'garbage', quantity: 1 },
        ],
      })
      .expect(200);
    assert.equal(res.body.cart.length, 1);
    assert.equal(res.body.cart[0].quantity, 3);

    const saved = await api().get('/api/users/cart').set(bearer(token)).expect(200);
    assert.equal(saved.body.cart[0].product.name, lamp.name);
    assert.equal(saved.body.cart[0].quantity, 3);

    await api().put('/api/users/cart').set(bearer(token)).send({ items: [] }).expect(200);
    assert.deepEqual((await api().get('/api/users/cart').set(bearer(token)).expect(200)).body.cart, []);
  });
});

describe('admin user management', () => {
  it('lists, searches and filters users', async () => {
    const { token } = await createAdmin();
    await createUser({ name: 'Zoya Findable' });

    const res = await api().get('/api/users?search=findable').set(bearer(token)).expect(200);
    assert.equal(res.body.users.length, 1);
    assert.equal(res.body.users[0].name, 'Zoya Findable');
    assert.ok(res.body.pagination);
    const admins = await api().get('/api/users?role=admin').set(bearer(token)).expect(200);
    assert.ok(admins.body.users.every((user) => user.role === 'admin'));
  });

  it('reads, promotes and deletes another user', async () => {
    const { token } = await createAdmin();
    const { user } = await createUser();

    await api().get(`/api/users/${user.id}`).set(bearer(token)).expect(200);
    const promoted = await api().put(`/api/users/${user.id}`).set(bearer(token)).send({ role: 'admin' }).expect(200);
    assert.equal(promoted.body.user.role, 'admin');
    await api().delete(`/api/users/${user.id}`).set(bearer(token)).expect(200);
    await api().get(`/api/users/${user.id}`).set(bearer(token)).expect(404);
  });

  it('protects admins from demoting or deleting themselves', async () => {
    const { user, token } = await createAdmin();
    assert.equal((await api().put(`/api/users/${user.id}`).set(bearer(token)).send({ role: 'user' }).expect(409)).body.code, 'SELF_ROLE_CHANGE');
    assert.equal((await api().delete(`/api/users/${user.id}`).set(bearer(token)).expect(409)).body.code, 'SELF_DELETE');
    await api().delete('/api/users/profile').set(bearer(token)).send({ password: 'whatever1' }).expect(409);
  });

  it('is closed to shoppers', async () => {
    const { token } = await createUser();
    const { user } = await createUser();
    await api().get('/api/users').set(bearer(token)).expect(403);
    await api().put(`/api/users/${user.id}`).set(bearer(token)).send({ role: 'admin' }).expect(403);
    await api().delete(`/api/users/${user.id}`).set(bearer(token)).expect(403);
  });
});
