import { api, bearer, createAdmin, createUser, useTestDatabase } from './helpers/testApp.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ContactMessage from '../models/contactMessage.js';

useTestDatabase('contact_security');

const message = {
  name: 'Asha Nair',
  email: 'asha@example.com',
  subject: 'Delivery question',
  message: 'When will my order reach Kochi?',
};

describe('contact form', () => {
  it('accepts a valid message from a guest and links it to a signed-in sender', async () => {
    const res = await api().post('/api/contact').send(message).expect(201);
    assert.match(res.body.message, /^Thanks Asha!/);

    const { user, token } = await createUser();
    await api().post('/api/contact').set(bearer(token)).send(message).expect(201);
    assert.equal(await ContactMessage.countDocuments({ user: user._id }), 1);
  });

  it('returns a field error for every invalid field', async () => {
    const res = await api().post('/api/contact').send({ name: 'A', email: 'not-an-email', subject: 'Hi', message: 'short' }).expect(400);
    assert.deepEqual(res.body.errors.map((error) => error.field).sort(), ['email', 'message', 'name', 'subject']);
  });

  it('lets only admins read, update and delete messages', async () => {
    const shopper = await createUser();
    const { token } = await createAdmin();
    await api().get('/api/contact').expect(401);
    await api().get('/api/contact').set(bearer(shopper.token)).expect(403);

    const list = await api().get('/api/contact?status=new').set(bearer(token)).expect(200);
    assert.ok(list.body.messages.length >= 2);
    const id = list.body.messages[0]._id;

    const updated = await api().patch(`/api/contact/${id}`).set(bearer(token)).send({ status: 'resolved' }).expect(200);
    assert.equal(updated.body.contactMessage.status, 'resolved');
    await api().patch(`/api/contact/${id}`).set(bearer(token)).send({ status: 'archived' }).expect(400);
    await api().delete(`/api/contact/${id}`).set(bearer(token)).expect(200);
    await api().delete(`/api/contact/${id}`).set(bearer(token)).expect(404);
  });
});

describe('security and error handling', () => {
  it('strips MongoDB operators from request bodies (NoSQL injection)', async () => {
    const { user } = await createUser();
    const res = await api().post('/api/auth/login').send({ email: { $gt: '' }, password: { $ne: null } }).expect(400);
    assert.equal(res.body.code, 'VALIDATION_ERROR');
    await api().post('/api/auth/login').send({ email: user.email, password: { $ne: null } }).expect(400);
  });

  it('answers malformed JSON with 400 and unknown routes with 404', async () => {
    const bad = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":').expect(400);
    assert.equal(bad.body.code, 'INVALID_JSON');
    const missing = await api().get('/api/nope').expect(404);
    assert.deepEqual(missing.body, { success: false, message: 'Route not found: GET /api/nope', code: 'ROUTE_NOT_FOUND' });
  });

  it('allows the configured frontend origin and blocks other origins', async () => {
    const allowed = await api().get('/api/health').set('Origin', 'http://localhost:5175').expect(200);
    assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:5175');

    const blocked = await api().get('/api/health').set('Origin', 'https://evil.example').expect(403);
    assert.equal(blocked.headers['access-control-allow-origin'], undefined);
    assert.equal(blocked.body.code, 'CORS_ORIGIN_DENIED');
  });

  it('reports health and sends security headers', async () => {
    const res = await api().get('/api/health').expect(200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.db, 'connected');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-powered-by'], undefined);
  });
});
