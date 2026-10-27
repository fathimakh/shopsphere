import { mongoose, useTestDatabase } from './helpers/testApp.js';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, beforeEach, describe, it } from 'node:test';
import env from '../config/env.js';
import Interaction, { EVENT_WEIGHTS } from '../models/interaction.js';
import Product from '../models/product.js';
import User from '../models/user.js';
import { RapidMinerError, buildScoringRequest, fetchLiveScores, isLiveScoringConfigured } from '../services/rapidminerClient.js';
import { invalidateRecommendationCache, recommendForUser } from '../services/recommendationEngine.js';

useTestDatabase('rapidminerClient');

/*
 * Mock of a RapidMiner AI Hub real-time scoring deployment. Each test installs the
 * behaviour it needs in `mockAiHub.respond`; the last request is kept for assertions.
 */
const mockAiHub = {
  respond: (_request, res) => res.writeHead(404).end(),
  lastRequest: null,
};
const aiHubServer = createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    mockAiHub.lastRequest = { method: req.method, url: req.url, headers: req.headers, body: body ? JSON.parse(body) : null };
    mockAiHub.respond(mockAiHub.lastRequest, res);
  });
});
const SCORING_PATH = '/rts/api/v1/services/shopsphere-reco/recommend';

const sendJson = (res, payload, status = 200) => {
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(payload));
};

const ids = {};
let shopper;
const originalSettings = { ...env.rapidminer };

before(async () => {
  await new Promise((resolve) => {
    aiHubServer.listen(0, '127.0.0.1', resolve);
  });
  const products = await Product.create(
    ['Earbuds', 'Phone', 'Charger', 'Case', 'Watch'].map((name) => ({
      name,
      description: `${name} used by the live scoring tests`,
      price: 499,
      category: 'electronics',
      stock: 10,
    })),
  );
  for (const product of products) ids[product.name] = product._id;

  shopper = await User.create({ name: 'Live Shopper', email: 'live@reco.test', password: 'Password1' });
  const other = await User.create({ name: 'Other Shopper', email: 'other@reco.test', password: 'Password1' });
  const event = (user, name, type) => ({ user: user._id, product: ids[name], event: type, weight: EVENT_WEIGHTS[type] });
  await Interaction.insertMany([
    event(shopper, 'Earbuds', 'view'),
    event(shopper, 'Phone', 'purchase'),
    event(other, 'Earbuds', 'view'),
    event(other, 'Charger', 'cart_add'),
    event(other, 'Phone', 'purchase'),
  ]);
});

beforeEach(() => {
  Object.assign(env.rapidminer, {
    scoringUrl: `http://127.0.0.1:${aiHubServer.address().port}${SCORING_PATH}`,
    authToken: 'test-token',
    username: '',
    password: '',
    timeoutMs: 1000,
  });
  mockAiHub.lastRequest = null;
  invalidateRecommendationCache();
});

after(async () => {
  Object.assign(env.rapidminer, originalSettings);
  aiHubServer.closeAllConnections();
  aiHubServer.close();
});

const ITEMS = [{ productId: 'a'.repeat(24), weight: 5 }];

describe('RapidMiner live client (against a mock AI Hub endpoint)', () => {
  it('is only enabled when RAPIDMINER_SCORING_URL is set', () => {
    assert.equal(isLiveScoringConfigured(), true);
    env.rapidminer.scoringUrl = '';
    assert.equal(isLiveScoringConfigured(), false);
  });

  it('builds a request body that suits AI Hub and a custom adapter', () => {
    assert.deepEqual(buildScoringRequest({ userId: 'u1', items: ITEMS, limit: 8 }), {
      user_id: 'u1',
      limit: 8,
      items: [{ product_id: 'a'.repeat(24), weight: 5 }],
      data: [{ user_id: 'u1', product_id: 'a'.repeat(24), weight: 5 }],
    });
  });

  it('POSTs JSON with a bearer token and normalises the scored rows', async () => {
    const good = 'b'.repeat(24);
    mockAiHub.respond = (_request, res) =>
      sendJson(res, {
        data: [
          { product_id: good, score: 0.9 },
          { SECOND_ID: 'C'.repeat(24), SIMILARITY: '0.5', FIRST_ID: 'a'.repeat(24) },
          { product_id: 'not-an-object-id', score: 0.8 },
          { product_id: 'd'.repeat(24), score: 0 },
          { product_id: 'e'.repeat(24), score: 'n/a' },
          null,
        ],
      });

    const rows = await fetchLiveScores({ userId: 'u1', items: ITEMS, limit: 8 });

    assert.deepEqual(rows, [
      { productId: good, score: 0.9 },
      { productId: 'c'.repeat(24), score: 0.5, sourceId: 'a'.repeat(24) },
    ]);
    assert.equal(mockAiHub.lastRequest.method, 'POST');
    assert.equal(mockAiHub.lastRequest.url, SCORING_PATH);
    assert.equal(mockAiHub.lastRequest.headers.authorization, 'Bearer test-token');
    assert.match(mockAiHub.lastRequest.headers['content-type'], /^application\/json/);
    assert.equal(mockAiHub.lastRequest.body.user_id, 'u1');
    assert.equal(mockAiHub.lastRequest.body.data.length, 1);
  });

  it('uses basic auth when only a username and password are configured', async () => {
    Object.assign(env.rapidminer, { authToken: '', username: 'analyst', password: 's3cret' });
    mockAiHub.respond = (_request, res) => sendJson(res, []);

    await fetchLiveScores({ userId: 'u1', items: ITEMS, limit: 8 });
    assert.equal(mockAiHub.lastRequest.headers.authorization, `Basic ${Buffer.from('analyst:s3cret').toString('base64')}`);
  });

  it('accepts a bare array, { result } and { results } with id / item / confidence / prediction columns', async () => {
    const shapes = [
      [{ id: 'a'.repeat(24), confidence: 0.7 }],
      { result: [{ item: 'a'.repeat(24), prediction: 0.7 }] },
      { results: [{ Product_ID: 'a'.repeat(24), Score: 0.7 }] },
    ];
    for (const shape of shapes) {
      mockAiHub.respond = (_request, res) => sendJson(res, shape);
      assert.deepEqual(await fetchLiveScores({ userId: 'u1', items: ITEMS, limit: 8 }), [{ productId: 'a'.repeat(24), score: 0.7 }]);
    }
  });

  it('rejects on timeout', async () => {
    env.rapidminer.timeoutMs = 100;
    mockAiHub.respond = (_request, res) => setTimeout(() => sendJson(res, []), 600);
    await assert.rejects(fetchLiveScores({ userId: 'u1', items: ITEMS, limit: 8 }), (error) => {
      assert.ok(error instanceof RapidMinerError);
      assert.match(error.message, /timed out after 100 ms/);
      return true;
    });
  });

  it('rejects on HTTP errors, malformed JSON, unexpected shapes and unreachable hosts', async () => {
    const cases = [
      [(_request, res) => sendJson(res, { message: 'boom' }, 500), /HTTP 500/],
      [(_request, res) => res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"data": [1, 2'), /malformed JSON/],
      [(_request, res) => sendJson(res, { status: 'ok' }), /unexpected response shape/],
    ];
    for (const [respond, message] of cases) {
      mockAiHub.respond = respond;
      await assert.rejects(fetchLiveScores({ userId: 'u1', items: ITEMS, limit: 8 }), message);
    }

    env.rapidminer.scoringUrl = 'http://127.0.0.1:1/unreachable';
    await assert.rejects(fetchLiveScores({ userId: 'u1', items: ITEMS, limit: 8 }), /unreachable/);
  });
});

describe('recommendation engine with live scoring', () => {
  it('uses the live scores (source rapidminer-live) and drops unknown, purchased and seen products', async () => {
    const unknownId = new mongoose.Types.ObjectId().toString();
    mockAiHub.respond = (_request, res) =>
      sendJson(res, [
        { product_id: unknownId, score: 0.99 },
        { product_id: String(ids.Phone), score: 0.95 },
        { product_id: String(ids.Earbuds), score: 0.9 },
        { product_id: String(ids.Watch), score: 0.4 },
        { FIRST_ID: String(ids.Earbuds), SECOND_ID: String(ids.Case), SIMILARITY: 0.8 },
      ]);

    const payload = await recommendForUser(shopper._id, { limit: 3 });

    assert.equal(payload.source, 'rapidminer-live');
    assert.equal(payload.strategy, 'personalized');
    const names = payload.products.map(({ name }) => name);
    assert.deepEqual(names, ['Case', 'Watch', 'Charger']);
    assert.deepEqual(
      payload.products.map(({ score }) => score),
      [1, 0.5, 0.5],
    );
    assert.equal(payload.products[0].reason, 'Because you viewed Earbuds');
    assert.equal(payload.products[1].reason, 'Picked for you by RapidMiner');
    assert.equal(payload.products[2].reason, 'Popular in Electronics');

    const sent = mockAiHub.lastRequest.body;
    assert.equal(sent.user_id, String(shopper._id));
    assert.deepEqual(
      sent.items.map(({ product_id: productId }) => productId).sort(),
      [String(ids.Earbuds), String(ids.Phone)].sort(),
    );
  });

  const failures = {
    timeout: (_request, res) => setTimeout(() => sendJson(res, []), 600),
    'HTTP 500': (_request, res) => sendJson(res, { message: 'Internal Server Error' }, 500),
    'malformed JSON': (_request, res) => res.writeHead(200, { 'Content-Type': 'application/json' }).end('not json'),
    'only unknown ids': (_request, res) => sendJson(res, [{ product_id: new mongoose.Types.ObjectId().toString(), score: 1 }]),
  };

  for (const [failure, respond] of Object.entries(failures)) {
    it(`falls back to the next source on ${failure} and warns once`, async (t) => {
      env.rapidminer.timeoutMs = 150;
      mockAiHub.respond = respond;
      const warn = t.mock.method(console, 'warn', () => {});

      const first = await recommendForUser(shopper._id, { limit: 3 });
      const second = await recommendForUser(shopper._id, { limit: 3 });

      for (const payload of [first, second]) {
        assert.equal(payload.source, 'builtin-cf');
        assert.equal(payload.products.length, 3);
        assert.equal(payload.products[0].name, 'Charger');
      }
      assert.equal(warn.mock.callCount(), 1);
      assert.match(warn.mock.calls[0].arguments[0], /RapidMiner live scoring failed/);
    });
  }

  it('is skipped entirely when no scoring URL is configured', async () => {
    env.rapidminer.scoringUrl = '';
    const payload = await recommendForUser(shopper._id, { limit: 3 });
    assert.equal(payload.source, 'builtin-cf');
    assert.equal(mockAiHub.lastRequest, null);
  });
});
