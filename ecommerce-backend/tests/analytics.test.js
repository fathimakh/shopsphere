import { api, bearer, createAdmin, createProduct, createUser, useTestDatabase, validShippingAddress } from './helpers/testApp.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import Interaction, { EVENT_WEIGHTS } from '../models/interaction.js';
import Order from '../models/order.js';
import ProductSimilarity from '../models/productSimilarity.js';
import { parseCsv, toCsv } from '../services/csv.js';
import { invalidateRecommendationCache } from '../services/recommendationEngine.js';

useTestDatabase('analytics');

const ADMIN_ROUTES = [
  ['get', '/api/analytics/export/rating-matrix.csv'],
  ['get', '/api/analytics/export/interactions.csv'],
  ['get', '/api/analytics/export/products.csv'],
  ['post', '/api/analytics/import'],
  ['delete', '/api/analytics/import'],
  ['get', '/api/analytics/status'],
  ['get', '/api/analytics/summary'],
];

let admin;
let shopper;
let others;
const products = {};

const event = (user, product, type) => ({ user: user._id, product: product._id, event: type, weight: EVENT_WEIGHTS[type] });

const placeOrder = (user, product, status, totalPrice) =>
  Order.create({
    user: user._id,
    orderItems: [{ product: product._id, name: product.name, price: totalPrice, quantity: 1 }],
    shippingAddress: validShippingAddress(),
    paymentMethod: 'COD',
    itemsPrice: totalPrice,
    shippingPrice: 0,
    totalPrice,
    status,
  });

before(async () => {
  admin = await createAdmin();
  shopper = await createUser();
  others = await Promise.all([createUser(), createUser(), createUser()]);

  const catalogue = {
    phone: { name: 'Galaxy Phone', category: 'smartphones', stock: 20, soldCount: 30 },
    earbuds: { name: 'Wireless Earbuds', category: 'smartphones', stock: 4, soldCount: 12 },
    charger: { name: 'Fast Charger', category: 'smartphones', stock: 8, soldCount: 8 },
    laptop: { name: 'Ultrabook 14', category: 'laptops', stock: 15, soldCount: 5 },
    risky: { name: '=SUM(A1:A2), "quoted"', category: 'laptops', stock: 0, soldCount: 0 },
    mouse: { name: 'Silent Mouse', category: 'laptops', stock: 50, soldCount: 1 },
  };
  for (const [key, fields] of Object.entries(catalogue)) products[key] = await createProduct(fields);

  const [a, b, c] = others.map(({ user }) => user);
  await Interaction.insertMany([
    event(shopper.user, products.phone, 'view'),
    event(a, products.phone, 'view'),
    event(a, products.earbuds, 'cart_add'),
    event(b, products.phone, 'purchase'),
    event(b, products.earbuds, 'purchase'),
    event(b, products.earbuds, 'purchase'),
    event(b, products.earbuds, 'purchase'),
    event(c, products.laptop, 'view'),
    event(c, products.mouse, 'review'),
  ]);

  await placeOrder(b, products.phone, 'delivered', 1500);
  await placeOrder(a, products.earbuds, 'pending', 999.5);
  await placeOrder(a, products.charger, 'cancelled', 400);
  invalidateRecommendationCache();
});

describe('analytics RBAC', () => {
  for (const [method, path] of ADMIN_ROUTES) {
    it(`${method.toUpperCase()} ${path} needs a token (401) and the admin role (403)`, async () => {
      const anonymous = await api()[method](path).expect(401);
      assert.equal(anonymous.body.code, 'NO_TOKEN');

      const forbidden = await api()[method](path).set(bearer(shopper.token)).expect(403);
      assert.equal(forbidden.body.code, 'FORBIDDEN');
    });
  }
});

describe('POST /api/analytics/track', () => {
  it('requires a logged-in user', async () => {
    const res = await api().post('/api/analytics/track').send({ productId: String(products.phone._id), event: 'view' }).expect(401);
    assert.equal(res.body.code, 'NO_TOKEN');
  });

  it('validates the product id and the event type', async () => {
    const res = await api()
      .post('/api/analytics/track')
      .set(bearer(shopper.token))
      .send({ productId: 'nope', event: 'purchase' })
      .expect(400);
    assert.equal(res.body.code, 'VALIDATION_ERROR');
    assert.deepEqual(res.body.errors.map(({ field }) => field).sort(), ['event', 'productId']);
  });

  it('returns 404 for an unknown product', async () => {
    await api()
      .post('/api/analytics/track')
      .set(bearer(shopper.token))
      .send({ productId: '0123456789abcdef01234567', event: 'view' })
      .expect(404);
  });

  it('records a cart_add once per 30 minutes but always answers 201', async () => {
    const body = { productId: String(products.laptop._id), event: 'cart_add' };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await api().post('/api/analytics/track').set(bearer(shopper.token)).send(body).expect(201);
      assert.deepEqual(res.body, { success: true });
    }
    const stored = await Interaction.find({ user: shopper.user._id, product: products.laptop._id, event: 'cart_add' });
    assert.equal(stored.length, 1);
    assert.equal(stored[0].weight, EVENT_WEIGHTS.cart_add);
    await Interaction.deleteMany({ _id: stored[0]._id });
  });
});

describe('GET /api/analytics/recommendations', () => {
  it('serves trending products to guests', async () => {
    const res = await api().get('/api/analytics/recommendations?limit=3').expect(200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.source, 'popular');
    assert.equal(res.body.strategy, 'trending');
    assert.equal(res.body.products.length, 3);
    assert.ok(res.body.products.every((product) => product.stock > 0 && typeof product.score === 'number'));
  });

  it('personalises for a logged-in shopper', async () => {
    const res = await api().get('/api/analytics/recommendations').set(bearer(shopper.token)).expect(200);
    assert.equal(res.body.source, 'builtin-cf');
    assert.equal(res.body.strategy, 'personalized');
    assert.equal(res.body.products[0].name, 'Wireless Earbuds');
    assert.equal(res.body.products[0].reason, 'Because you viewed Galaxy Phone');
    // Five products are in stock; the viewed phone fills the list last.
    assert.equal(res.body.products.length, 5);
  });

  it('treats an invalid token like a guest', async () => {
    const res = await api().get('/api/analytics/recommendations').set(bearer('not-a-jwt')).expect(200);
    assert.equal(res.body.source, 'popular');
  });

  it('validates the limit', async () => {
    const res = await api().get('/api/analytics/recommendations?limit=abc').expect(400);
    assert.equal(res.body.code, 'VALIDATION_ERROR');
    await api().get('/api/analytics/recommendations?limit=0').expect(400);
    const capped = await api().get('/api/analytics/recommendations?limit=500').expect(200);
    assert.equal(capped.body.products.length, 5);
  });
});

describe('GET /api/analytics/recommendations/product/:id', () => {
  it('returns similar items for a product', async () => {
    const res = await api().get(`/api/analytics/recommendations/product/${products.phone._id}?limit=2`).expect(200);
    assert.equal(res.body.strategy, 'similar-items');
    assert.equal(res.body.source, 'builtin-cf');
    assert.equal(res.body.products.length, 2);
    assert.equal(res.body.products[0].name, 'Wireless Earbuds');
    assert.ok(res.body.products.every((product) => product._id !== String(products.phone._id)));
  });

  it('rejects malformed (400) and unknown (404) product ids', async () => {
    const invalid = await api().get('/api/analytics/recommendations/product/abc').expect(400);
    assert.equal(invalid.body.message, 'Invalid product id');
    await api().get('/api/analytics/recommendations/product/0123456789abcdef01234567').expect(404);
  });
});

describe('CSV exports', () => {
  const download = (path) => api().get(`/api/analytics/export/${path}`).set(bearer(admin.token)).expect(200);

  const assertCsvHeaders = (res, filename) => {
    assert.equal(res.headers['content-type'], 'text/csv; charset=utf-8');
    assert.equal(res.headers['content-disposition'], `attachment; filename="${filename}"`);
  };

  it('exports the capped product x user rating matrix', async () => {
    const res = await download('rating-matrix.csv');
    assertCsvHeaders(res, 'rating-matrix.csv');

    const [header, ...rows] = parseCsv(res.text);
    assert.equal(header[0], 'product_id');
    const users = [shopper, ...others].map(({ user }) => `u_${user._id}`).sort();
    assert.deepEqual(header.slice(1), users);
    // Only products with interactions get a row.
    assert.equal(rows.length, 4);

    const cell = (product, { user }) => Number(rows.find(([id]) => id === String(product._id))[header.indexOf(`u_${user._id}`)]);
    assert.equal(cell(products.earbuds, others[1]), 10, 'three purchases (15) are capped at 10');
    assert.equal(cell(products.earbuds, others[0]), 3);
    assert.equal(cell(products.phone, shopper), 1);
    assert.equal(cell(products.laptop, shopper), 0);
  });

  it('exports the interactions in long format', async () => {
    const res = await download('interactions.csv');
    assertCsvHeaders(res, 'interactions.csv');
    const [header, ...rows] = parseCsv(res.text);
    assert.deepEqual(header, ['user_id', 'product_id', 'event', 'weight', 'timestamp']);
    assert.equal(rows.length, await Interaction.countDocuments());
    const review = rows.find((row) => row[2] === 'review');
    assert.equal(review[3], '4');
    assert.ok(!Number.isNaN(Date.parse(review[4])));
  });

  it('exports products with quoted, formula-safe names', async () => {
    const res = await download('products.csv');
    assertCsvHeaders(res, 'products.csv');
    assert.match(res.text, /"'=SUM\(A1:A2\), ""quoted"""/);

    const [header, ...rows] = parseCsv(res.text);
    assert.deepEqual(header, ['product_id', 'name', 'category', 'brand', 'price', 'rating']);
    assert.equal(rows.length, Object.keys(products).length);
  });
});

describe('POST /api/analytics/import', () => {
  const importCsv = (body, type = 'text/csv') =>
    api().post('/api/analytics/import').set(bearer(admin.token)).set('Content-Type', type).send(body);

  it('requires a CSV body', async () => {
    const res = await api().post('/api/analytics/import').set(bearer(admin.token)).send({}).expect(400);
    assert.equal(res.body.code, 'CSV_REQUIRED');
  });

  it('rejects an unrecognised header', async () => {
    const res = await importCsv('a,b,c\n1,2,3\n').expect(400);
    assert.equal(res.body.code, 'INVALID_CSV_HEADER');
    assert.match(res.body.message, /FIRST_ID,SECOND_ID,SIMILARITY/);
  });

  it('rejects a file without a single valid row', async () => {
    const { phone } = products;
    const csv = toCsv(
      ['FIRST_ID', 'SECOND_ID', 'SIMILARITY'],
      [
        [String(phone._id), '0123456789abcdef01234567', 0.5],
        [String(phone._id), String(phone._id), 1],
        [String(phone._id), String(products.mouse._id), 0],
        [String(phone._id), String(products.mouse._id), 'n/a'],
      ],
    );
    const res = await importCsv(csv).expect(400);
    assert.equal(res.body.code, 'NOTHING_IMPORTED');
    assert.match(res.body.message, /4 row\(s\) skipped/);
  });

  it('imports a raw text/csv body, stores both directions and skips bad rows', async () => {
    const { phone, laptop, mouse } = products;
    const csv = [
      'first_id,second_id,similarity',
      `${phone._id},${laptop._id},0.8`,
      `${laptop._id},${phone._id},0.8`,
      `${phone._id},${mouse._id},0.25`,
      `${mouse._id},${mouse._id},1`,
      `${mouse._id},0123456789abcdef01234567,0.5`,
    ].join('\r\n');

    const res = await importCsv(csv).expect(200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.imported, 3);
    assert.equal(res.body.skipped, 2);
    assert.equal(res.body.products, 3);
    assert.match(res.body.batchId, /^[0-9a-f-]{36}$/);

    const stored = await ProductSimilarity.findOne({ product: mouse._id }).lean();
    assert.deepEqual(stored.neighbors.map(({ product, score }) => [String(product), score]), [[String(phone._id), 0.25]]);
  });

  it('accepts JSON { csv } with the alternative header and semicolons, replacing the previous import', async () => {
    const previous = await api().get('/api/analytics/status').set(bearer(admin.token)).expect(200);
    const csv = `"product_id";"similar_product_id";"score"\n"${products.earbuds._id}";"${products.charger._id}";0.6\n`;

    const res = await importCsv(JSON.stringify({ csv }), 'application/json').expect(200);
    assert.equal(res.body.imported, 1);
    assert.notEqual(res.body.batchId, previous.body.rapidminer.lastImport.batchId);
    assert.equal(await ProductSimilarity.countDocuments(), 2, 'documents of the old batch were removed');
    assert.equal(await ProductSimilarity.countDocuments({ batchId: res.body.batchId }), 2);
  });

  it('accepts un-renamed Cross Distances output (request, document, distance)', async () => {
    const csv = `request,document,distance\n${products.earbuds._id},${products.charger._id},0.5\n`;
    const res = await importCsv(csv).expect(200);
    assert.equal(res.body.imported, 1);
  });

  it('DELETE removes the imported model', async () => {
    const res = await api().delete('/api/analytics/import').set(bearer(admin.token)).expect(200);
    assert.match(res.body.message, /removed/);
    assert.equal(await ProductSimilarity.countDocuments(), 0);

    const again = await api().delete('/api/analytics/import').set(bearer(admin.token)).expect(200);
    assert.match(again.body.message, /no imported/i);
  });
});

describe('export -> RapidMiner -> import round trip', () => {
  /** Independent re-implementation of RapidMiner's Data to Similarity (cosine) + Similarity to Data. */
  const simulateRapidMiner = (ratingMatrixCsv) => {
    const [, ...rows] = parseCsv(ratingMatrixCsv);
    const vectors = rows.map(([id, ...cells]) => ({ id, values: cells.map(Number) }));
    const norm = (values) => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
    const output = [];
    for (const a of vectors) {
      for (const b of vectors) {
        if (a.id === b.id) continue;
        const dot = a.values.reduce((sum, value, index) => sum + value * b.values[index], 0);
        output.push([a.id, b.id, dot / (norm(a.values) * norm(b.values))]);
      }
    }
    return toCsv(['FIRST_ID', 'SECOND_ID', 'SIMILARITY'], output);
  };

  it('produces the same neighbours as the built-in model and switches the active source', async () => {
    const adminGet = (path) => api().get(path).set(bearer(admin.token)).expect(200);
    const builtin = await adminGet(`/api/analytics/recommendations/product/${products.phone._id}?limit=3`);
    assert.equal(builtin.body.source, 'builtin-cf');

    const matrix = await api().get('/api/analytics/export/rating-matrix.csv').set(bearer(admin.token)).expect(200);
    const scored = simulateRapidMiner(matrix.text);
    const imported = await api()
      .post('/api/analytics/import')
      .set(bearer(admin.token))
      .set('Content-Type', 'text/csv')
      .send(scored)
      .expect(200);
    assert.ok(imported.body.imported > 0);
    assert.ok(imported.body.skipped > 0, 'zero similarities are skipped');

    const fromImport = await adminGet(`/api/analytics/recommendations/product/${products.phone._id}?limit=3`);
    assert.equal(fromImport.body.source, 'rapidminer');
    assert.deepEqual(
      fromImport.body.products.map(({ _id, score, reason }) => [_id, score, reason]),
      builtin.body.products.map(({ _id, score, reason }) => [_id, score, reason]),
    );

    const personal = await api().get('/api/analytics/recommendations').set(bearer(shopper.token)).expect(200);
    assert.equal(personal.body.source, 'rapidminer');

    const status = await adminGet('/api/analytics/status');
    assert.equal(status.body.activeSource, 'rapidminer');
    assert.equal(status.body.rapidminer.lastImport.batchId, imported.body.batchId);

    await api().delete('/api/analytics/import').set(bearer(admin.token)).expect(200);
  });
});

describe('GET /api/analytics/status', () => {
  it('reports the active source, the models and interaction counts', async () => {
    const res = await api().get('/api/analytics/status').set(bearer(admin.token)).expect(200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.activeSource, 'builtin-cf');
    assert.deepEqual(res.body.rapidminer, { liveConfigured: false, lastImport: null });
    assert.deepEqual(res.body.interactions, { total: 9, byEvent: { view: 3, cart_add: 1, review: 1, purchase: 4 } });
    assert.ok(res.body.builtin.pairs > 0);
    assert.ok(res.body.builtin.products > 0);
    assert.ok(!Number.isNaN(Date.parse(res.body.builtin.computedAt)));
  });
});

describe('GET /api/analytics/summary', () => {
  it('returns dashboard totals, order counts per status and product lists', async () => {
    const res = await api().get('/api/analytics/summary').set(bearer(admin.token)).expect(200);
    const { totals, ordersByStatus, lowStock, topProducts, recentOrders } = res.body;

    assert.deepEqual(totals, { users: 5, products: 6, orders: 3, revenue: 2499.5 });
    assert.deepEqual(ordersByStatus, { pending: 1, processing: 0, shipped: 0, delivered: 1, cancelled: 1 });
    assert.deepEqual(
      lowStock.map(({ name, stock }) => [name, stock]),
      [
        ['=SUM(A1:A2), "quoted"', 0],
        ['Wireless Earbuds', 4],
        ['Fast Charger', 8],
      ],
    );
    assert.equal(lowStock[0].reviews, undefined);
    assert.deepEqual(
      topProducts.map(({ product, soldCount }) => [product.name, soldCount]),
      [
        ['Galaxy Phone', 30],
        ['Wireless Earbuds', 12],
        ['Fast Charger', 8],
        ['Ultrabook 14', 5],
        ['Silent Mouse', 1],
      ],
    );
    assert.equal(recentOrders.length, 3);
    assert.equal(recentOrders[0].status, 'cancelled', 'newest first');
    assert.deepEqual(Object.keys(recentOrders[0].user).sort(), ['_id', 'email', 'name']);
  });
});
