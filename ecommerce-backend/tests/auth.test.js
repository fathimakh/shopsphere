import { api, bearer, createAdmin, createProduct, createUser, useTestDatabase } from './helpers/testApp.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import User from '../models/user.js';

useTestDatabase('auth');

const assertPublicUser = (user) => {
  assert.ok(user._id);
  assert.equal(user.password, undefined);
  assert.equal(user.tokenVersion, undefined);
  assert.equal(user.cart, undefined);
};

describe('POST /api/auth/register', () => {
  it('creates a shopper, normalises the email and ignores a requested role', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: '  Asha Nair ', email: '  Asha@Example.COM ', password: 'Secret123', role: 'admin' })
      .expect(201);

    assert.equal(res.body.success, true);
    assert.equal(typeof res.body.token, 'string');
    assert.equal(res.body.user.name, 'Asha Nair');
    assert.equal(res.body.user.email, 'asha@example.com');
    assert.equal(res.body.user.role, 'user');
    assertPublicUser(res.body.user);

    const stored = await User.findOne({ email: 'asha@example.com' }).select('+password');
    assert.notEqual(stored.password, 'Secret123');
    assert.match(stored.password, /^\$2[aby]\$/);
  });

  it('rejects a duplicate email (case-insensitive) with 409', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Asha Again', email: 'ASHA@example.com', password: 'Secret123' })
      .expect(409);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /already exists/);
  });

  it('returns field errors for invalid input', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'A', email: 'not-an-email', password: 'password' }).expect(400);
    assert.equal(res.body.code, 'VALIDATION_ERROR');
    const fields = res.body.errors.map((error) => error.field).sort();
    assert.deepEqual(fields, ['email', 'name', 'password']);
    assert.match(res.body.errors.find((error) => error.field === 'password').message, /letter and one number/);
  });

  it('requires every field', async () => {
    const res = await api().post('/api/auth/register').send({}).expect(400);
    assert.equal(res.body.errors.length, 3);
  });
});

describe('POST /api/auth/login', () => {
  before(() => createUser({ email: 'login@test.dev', password: 'Secret123' }));

  it('returns a token and the user for valid credentials', async () => {
    const res = await api().post('/api/auth/login').send({ email: ' LOGIN@test.dev', password: 'Secret123' }).expect(200);
    const payload = jwt.decode(res.body.token);
    assert.equal(payload.id, res.body.user._id);
    assert.equal(payload.role, 'user');
    assert.equal(payload.tv, 0);
    assert.ok(payload.exp > payload.iat);
    assertPublicUser(res.body.user);
  });

  it('answers 401 INVALID_CREDENTIALS for a wrong password or an unknown email', async () => {
    for (const body of [
      { email: 'login@test.dev', password: 'Wrong1234' },
      { email: 'nobody@test.dev', password: 'Secret123' },
    ]) {
      const res = await api().post('/api/auth/login').send(body).expect(401);
      assert.equal(res.body.code, 'INVALID_CREDENTIALS');
      assert.equal(res.body.message, 'Invalid email or password');
    }
  });

  it('validates the body', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'bad' }).expect(400);
    assert.deepEqual(res.body.errors.map((error) => error.field).sort(), ['email', 'password']);
  });
});

describe('GET /api/auth/me and token validation', () => {
  it('returns the current user', async () => {
    const { user, token } = await createUser();
    const res = await api().get('/api/auth/me').set(bearer(token)).expect(200);
    assert.equal(res.body.user._id, user.id);
    assertPublicUser(res.body.user);
  });

  it('distinguishes the 401 reasons with codes', async () => {
    const { user, token } = await createUser();
    const secret = process.env.JWT_SECRET;
    const cases = [
      [{}, 'NO_TOKEN'],
      [{ Authorization: 'Basic abc' }, 'NO_TOKEN'],
      [bearer('not.a.jwt'), 'TOKEN_INVALID'],
      [bearer(jwt.sign({ id: user.id, role: 'user', tv: 0 }, 'some-other-secret')), 'TOKEN_INVALID'],
      [bearer(jwt.sign({ id: user.id, role: 'user' }, secret)), 'TOKEN_INVALID'],
      [bearer(jwt.sign({ id: user.id, role: 'user', tv: 0, exp: Math.floor(Date.now() / 1000) - 60 }, secret)), 'TOKEN_EXPIRED'],
    ];
    for (const [headers, code] of cases) {
      const res = await api().get('/api/auth/me').set(headers).expect(401);
      assert.equal(res.body.code, code, `expected ${code} for ${JSON.stringify(headers)}`);
    }

    await User.deleteOne({ _id: user._id });
    const res = await api().get('/api/auth/me').set(bearer(token)).expect(401);
    assert.equal(res.body.code, 'USER_NOT_FOUND');
  });

  it('rejects an unsigned ("alg: none") token', async () => {
    const { user } = await createUser();
    const unsigned = jwt.sign({ id: user.id, role: 'admin', tv: 0 }, null, { algorithm: 'none' });
    const res = await api().get('/api/auth/me').set(bearer(unsigned)).expect(401);
    assert.equal(res.body.code, 'TOKEN_INVALID');
  });
});

describe('POST /api/auth/logout', () => {
  it('keeps the token valid for a normal logout (the client discards it)', async () => {
    const { token } = await createUser();
    const res = await api().post('/api/auth/logout').set(bearer(token)).expect(200);
    assert.equal(res.body.message, 'Logged out successfully');
    await api().get('/api/auth/me').set(bearer(token)).expect(200);
  });

  it('revokes every existing token with allDevices: true', async () => {
    const { user, token } = await createUser();
    const otherDevice = (await api().post('/api/auth/login').send({ email: user.email, password: 'Passw0rd!' })).body.token;

    await api().post('/api/auth/logout').set(bearer(token)).send({ allDevices: true }).expect(200);

    for (const revoked of [token, otherDevice]) {
      const res = await api().get('/api/auth/me').set(bearer(revoked)).expect(401);
      assert.equal(res.body.code, 'TOKEN_REVOKED');
    }
    const fresh = (await api().post('/api/auth/login').send({ email: user.email, password: 'Passw0rd!' }).expect(200)).body.token;
    await api().get('/api/auth/me').set(bearer(fresh)).expect(200);
  });

  it('requires authentication and validates allDevices', async () => {
    await api().post('/api/auth/logout').expect(401);
    const { token } = await createUser();
    await api().post('/api/auth/logout').set(bearer(token)).send({ allDevices: 'yes' }).expect(400);
  });
});

describe('Role-based access control', () => {
  let userToken;
  let adminToken;
  let productId;

  before(async () => {
    ({ token: userToken } = await createUser());
    ({ token: adminToken } = await createAdmin());
    productId = (await createProduct()).id;
  });

  // Admin-only endpoints that are safe to call repeatedly: [method, path, body, expected admin status].
  const adminEndpoints = () => [
    ['get', '/api/users', undefined, 200],
    ['get', '/api/orders', undefined, 200],
    ['get', '/api/contact', undefined, 200],
    ['post', '/api/products', { name: 'RBAC Phone', description: 'Created by the RBAC test.', price: 10, category: 'rbac', stock: 1 }, 201],
    ['put', `/api/products/${productId}`, { stock: 7 }, 200],
  ];

  it('answers 401 NO_TOKEN to guests', async () => {
    for (const [method, path, body] of adminEndpoints()) {
      const res = await api()[method](path).send(body);
      assert.equal(res.status, 401, `${method.toUpperCase()} ${path}`);
      assert.equal(res.body.code, 'NO_TOKEN');
    }
  });

  it('answers 403 FORBIDDEN to shoppers', async () => {
    for (const [method, path, body] of adminEndpoints()) {
      const res = await api()[method](path).set(bearer(userToken)).send(body);
      assert.equal(res.status, 403, `${method.toUpperCase()} ${path}`);
      assert.equal(res.body.code, 'FORBIDDEN');
    }
  });

  it('lets admins through', async () => {
    for (const [method, path, body, status] of adminEndpoints()) {
      const res = await api()[method](path).set(bearer(adminToken)).send(body);
      assert.equal(res.status, status, `${method.toUpperCase()} ${path}: ${res.body.message}`);
    }
  });

  it('uses the role stored in the database, not the one inside the token', async () => {
    const { user } = await createUser();
    const forged = jwt.sign({ id: user.id, role: 'admin', tv: 0 }, process.env.JWT_SECRET);
    const res = await api().get('/api/users').set(bearer(forged)).expect(403);
    assert.equal(res.body.code, 'FORBIDDEN');
  });
});
