import { mongoose, useTestDatabase } from './helpers/testApp.js';
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it } from 'node:test';
import env from '../config/env.js';
import Interaction, { EVENT_WEIGHTS } from '../models/interaction.js';
import Product from '../models/product.js';
import User from '../models/user.js';
import {
  getEngineStatus,
  invalidateRecommendationCache,
  recommendForUser,
  recommendSimilar,
  recommendTrending,
} from '../services/recommendationEngine.js';
import { clearImportedSimilarities, importSimilarityCsv } from '../services/similarityImport.js';

useTestDatabase('recoEngine');

/*
 * Catalogue: smartphones P1-P4, laptops L1-L3, groceries G1-G3 (G3 out of stock).
 * The shopper viewed P1 and bought P2. With the other shoppers' interactions the built-in
 * cosine model gives (hand-checked):
 *   score(P4) = 5 * sim(P2,P4) = 5 * 0.5774                     = 2.8868 -> 1      (via P2, bought)
 *   score(P3) = 1 * sim(P1,P3) + 5 * sim(P2,P3) = 0.7303 + 0.9129 = 1.6432 -> 0.5692 (strongest: P2)
 *   score(L1) = 1 * sim(P1,L1) = 0.4082                          -> 0.1414 (via P1, viewed)
 */
const PRODUCTS = [
  ['P1', 'smartphones', 300],
  ['P2', 'smartphones', 500],
  ['P3', 'smartphones', 40],
  ['P4', 'smartphones', 30],
  ['L1', 'laptops', 200],
  ['L2', 'laptops', 20],
  ['L3', 'laptops', 10],
  ['G1', 'groceries', 5],
  ['G2', 'groceries', 0],
  ['G3', 'groceries', 900, 0],
];

const ids = {};
const users = {};

const interact = (user, key, event) => ({ user: users[user]._id, product: ids[key], event, weight: EVENT_WEIGHTS[event] });
const idsOf = (payload) => payload.products.map((product) => String(product._id));
const keyOf = (id) => Object.keys(ids).find((key) => String(ids[key]) === id);

before(async () => {
  const products = await Product.create(
    PRODUCTS.map(([name, category, soldCount, stock = 25]) => ({
      name: `Product ${name}`,
      description: `Test product ${name} for the recommendation engine`,
      price: 999,
      category,
      stock,
      soldCount,
    })),
  );
  products.forEach((product, index) => {
    ids[PRODUCTS[index][0]] = product._id;
  });

  for (const name of ['shopper', 'u1', 'u2', 'u3', 'u4', 'newbie', 'collector']) {
    users[name] = await User.create({ name: `User ${name}`, email: `${name}@reco.test`, password: 'Password1' });
  }

  await Interaction.insertMany([
    interact('shopper', 'P1', 'view'),
    interact('shopper', 'P2', 'purchase'),
    interact('u1', 'P1', 'view'),
    interact('u1', 'P3', 'view'),
    interact('u1', 'P2', 'purchase'),
    interact('u2', 'P1', 'view'),
    interact('u2', 'P3', 'cart_add'),
    interact('u2', 'L1', 'view'),
    interact('u3', 'P2', 'purchase'),
    interact('u3', 'P4', 'view'),
    interact('u4', 'L1', 'view'),
    interact('u4', 'L2', 'view'),
    interact('u4', 'G1', 'view'),
  ]);
});

beforeEach(() => invalidateRecommendationCache());

const assertWellFormed = (payload, limit) => {
  const list = idsOf(payload);
  assert.equal(list.length, limit, 'list is filled to the limit');
  assert.equal(new Set(list).size, list.length, 'no duplicates');
  assert.ok(!list.includes(String(ids.G3)), 'out-of-stock products are skipped');
  for (const [index, product] of payload.products.entries()) {
    assert.ok(product.score > 0 && product.score <= 1, 'scores are normalised to 0-1');
    if (index) assert.ok(product.score <= payload.products[index - 1].score, 'scores never increase');
    assert.equal(typeof product.reason, 'string');
    assert.equal(product.reviews, undefined);
  }
  assert.ok(!Number.isNaN(Date.parse(payload.generatedAt)));
};

describe('recommendation engine', () => {
  it('uses popularity for guests (source popular, strategy trending)', async () => {
    const payload = await recommendTrending({ limit: 5 });

    assert.equal(payload.source, 'popular');
    assert.equal(payload.strategy, 'trending');
    assertWellFormed(payload, 5);
    assert.equal(keyOf(idsOf(payload)[0]), 'P2', 'best seller with the most engagement comes first');
    assert.equal(payload.products[0].score, 1);
    assert.ok(payload.products.every((product) => product.reason === 'Trending now'));
  });

  it('falls back to the built-in CF model when nothing was imported', async () => {
    const payload = await recommendForUser(users.shopper._id, { limit: 8 });

    assert.equal(payload.source, 'builtin-cf');
    assert.equal(payload.strategy, 'personalized');
    assertWellFormed(payload, 8);

    const keys = idsOf(payload).map(keyOf);
    assert.deepEqual(keys.slice(0, 3), ['P4', 'P3', 'L1']);
    assert.deepEqual(
      payload.products.slice(0, 3).map(({ score }) => score),
      [1, 0.5692, 0.1414],
    );
    assert.equal(payload.products[0].reason, 'Because you bought Product P2');
    assert.equal(payload.products[1].reason, 'Because you bought Product P2');
    assert.equal(payload.products[2].reason, 'Because you viewed Product P1');
    assert.ok(!keys.includes('P2'), 'purchased products are excluded');
    // Unseen popular products top the list up first; the viewed P1 only fills the last slot.
    assert.equal(keys.at(-1), 'P1');
    assert.equal(payload.products.at(-1).reason, 'Popular in Smartphones');
  });

  it('prefers the imported RapidMiner model over the built-in one', async () => {
    const csv = ['FIRST_ID,SECOND_ID,SIMILARITY', `${ids.P1},${ids.L3},0.9`, `${ids.P2},${ids.G1},0.8`].join('\n');
    await importSimilarityCsv(csv);
    try {
      const payload = await recommendForUser(users.shopper._id, { limit: 4 });
      assert.equal(payload.source, 'rapidminer');
      assert.equal(payload.strategy, 'personalized');
      assertWellFormed(payload, 4);
      // score(G1) = 5 * 0.8 = 4 (via the purchase), score(L3) = 1 * 0.9 = 0.9 -> 0.225 after normalising.
      assert.deepEqual(idsOf(payload).slice(0, 2).map(keyOf), ['G1', 'L3']);
      assert.deepEqual(payload.products.slice(0, 2).map(({ score }) => score), [1, 0.225]);
      assert.equal(payload.products[0].reason, 'Because you bought Product P2');

      const status = await getEngineStatus();
      assert.equal(status.activeSource, 'rapidminer');
      assert.equal(status.rapidminer.lastImport.pairs, 4);
    } finally {
      await clearImportedSimilarities();
    }
    const afterClear = await recommendForUser(users.shopper._id, { limit: 4 });
    assert.equal(afterClear.source, 'builtin-cf');
  });

  it('answers a shopper without history with trending products', async () => {
    const payload = await recommendForUser(users.newbie._id, { limit: 6 });
    assert.equal(payload.source, 'popular');
    assert.equal(payload.strategy, 'trending');
    assertWellFormed(payload, 6);
  });

  it('never returns an empty list, even when the shopper bought everything in stock', async () => {
    const inStock = PRODUCTS.filter(([, , , stock]) => stock !== 0).map(([key]) => key);
    const purchases = await Interaction.insertMany(inStock.map((key) => interact('collector', key, 'purchase')));
    invalidateRecommendationCache();
    try {
      const payload = await recommendForUser(users.collector._id, { limit: 4 });
      assertWellFormed(payload, 4);
    } finally {
      await Interaction.deleteMany({ _id: { $in: purchases.map(({ _id }) => _id) } });
    }
  });

  it('caps the list at the in-stock catalogue size without duplicates', async () => {
    const payload = await recommendTrending({ limit: 24 });
    assertWellFormed(payload, PRODUCTS.length - 1);
  });

  it('lists similar items first, then more from the same category, never the product itself', async () => {
    const payload = await recommendSimilar(ids.P1, { limit: 6 });

    assert.equal(payload.source, 'builtin-cf');
    assert.equal(payload.strategy, 'similar-items');
    assertWellFormed(payload, 6);
    const keys = idsOf(payload).map(keyOf);
    // sim(P1,P3) = 4/sqrt(30) = 0.7303, sim(P1,P2) = 10/15 = 0.6667, sim(P1,L1) = 1/sqrt(6) = 0.4082
    assert.deepEqual(keys.slice(0, 3), ['P3', 'P2', 'L1']);
    assert.deepEqual(payload.products.slice(0, 3).map(({ score }) => score), [0.7303, 0.6667, 0.4082]);
    assert.equal(payload.products[0].reason, 'Customers who viewed this also viewed');
    assert.equal(keys[3], 'P4');
    assert.equal(payload.products[3].reason, 'More in Smartphones');
    assert.ok(!keys.includes('P1'));
  });

  it('uses imported neighbours for similar items when they exist', async () => {
    await importSimilarityCsv(`product_id,similar_product_id,score\n${ids.L2},${ids.G2},0.42\n`);
    try {
      const payload = await recommendSimilar(ids.L2, { limit: 3 });
      assert.equal(payload.source, 'rapidminer');
      assert.equal(keyOf(idsOf(payload)[0]), 'G2');
      assert.equal(payload.products[0].score, 0.42);
      assert.deepEqual(payload.products.slice(1).map(({ reason }) => reason), ['More in Laptops', 'More in Laptops']);
    } finally {
      await clearImportedSimilarities();
    }
  });

  it('falls back to same-category popularity for a product without neighbours', async () => {
    const payload = await recommendSimilar(ids.G2, { limit: 3 });
    assert.equal(payload.source, 'popular');
    assert.equal(payload.strategy, 'similar-items');
    assert.equal(keyOf(idsOf(payload)[0]), 'G1', 'the only other in-stock grocery comes first');
    assert.equal(payload.products[0].reason, 'More in Groceries');
  });

  it('rejects unknown products with 404', async () => {
    await assert.rejects(recommendSimilar(new mongoose.Types.ObjectId(), { limit: 3 }), { statusCode: 404 });
  });

  it('caches the built-in model for RECO_CACHE_TTL_SECONDS', async () => {
    const previousTtl = env.recoCacheTtlSeconds;
    env.recoCacheTtlSeconds = 300;
    try {
      const first = await getEngineStatus();
      const extra = await Interaction.create(interact('u4', 'G2', 'view'));
      const cached = await getEngineStatus();
      assert.equal(cached.builtin.computedAt, first.builtin.computedAt);
      invalidateRecommendationCache();
      const fresh = await getEngineStatus();
      assert.ok(fresh.builtin.pairs > first.builtin.pairs);
      await extra.deleteOne();
    } finally {
      env.recoCacheTtlSeconds = previousTtl;
    }
  });
});
