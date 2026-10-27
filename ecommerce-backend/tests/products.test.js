import { api, bearer, createAdmin, createProduct, createUser, useTestDatabase, waitFor } from './helpers/testApp.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import Interaction from '../models/interaction.js';
import Product from '../models/product.js';

useTestDatabase('products');

const names = (res) => res.body.products.map((product) => product.name);

describe('GET /api/products (filtering, sorting, search, pagination)', () => {
  before(async () => {
    await Product.deleteMany({});
    await createProduct({ name: 'Galaxy Phone', brand: 'Samsung', category: 'smartphones', price: 30000, rating: 4.5, soldCount: 40, stock: 5 });
    await createProduct({ name: 'iPhone Mini', brand: 'Apple', category: 'smartphones', price: 60000, rating: 4.8, soldCount: 10, stock: 0 });
    await createProduct({ name: 'Apple Watch', brand: 'Apple', category: 'mens-watches', price: 25000, rating: 4.1, soldCount: 70, stock: 8, tags: ['wearable'] });
    await createProduct({ name: 'Cotton Shirt', brand: 'Generic', category: 'mens-shirts', price: 999, rating: 3.2, soldCount: 5, stock: 30, isFeatured: true });
  });

  it('lists products with the pagination block, without reviews', async () => {
    const res = await api().get('/api/products').expect(200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.pagination, { page: 1, limit: 12, total: 4, pages: 1 });
    assert.equal(res.body.products[0].reviews, undefined);
  });

  it('searches name, brand, tags and description, word by word', async () => {
    assert.deepEqual(names(await api().get('/api/products?search=apple watch').expect(200)), ['Apple Watch']);
    assert.deepEqual(names(await api().get('/api/products?search=WEARABLE').expect(200)), ['Apple Watch']);
    // Regex metacharacters are matched literally instead of breaking the query.
    assert.equal((await api().get('/api/products?search=.*(').expect(200)).body.pagination.total, 0);
  });

  it('filters by category list, brand, price range, rating, stock and featured', async () => {
    assert.equal((await api().get('/api/products?category=smartphones,mens-shirts').expect(200)).body.pagination.total, 3);
    assert.equal((await api().get('/api/products?brand=apple').expect(200)).body.pagination.total, 2);
    assert.deepEqual(names(await api().get('/api/products?minPrice=20000&maxPrice=30000&sort=price_asc').expect(200)), ['Apple Watch', 'Galaxy Phone']);
    assert.equal((await api().get('/api/products?minRating=4.5').expect(200)).body.pagination.total, 2);
    assert.ok(!names(await api().get('/api/products?inStock=true').expect(200)).includes('iPhone Mini'));
    assert.deepEqual(names(await api().get('/api/products?featured=true').expect(200)), ['Cotton Shirt']);
  });

  it('sorts by price, rating, popularity and name', async () => {
    assert.deepEqual(names(await api().get('/api/products?sort=price_desc').expect(200))[0], 'iPhone Mini');
    assert.deepEqual(names(await api().get('/api/products?sort=rating').expect(200))[0], 'iPhone Mini');
    assert.deepEqual(names(await api().get('/api/products?sort=popular').expect(200))[0], 'Apple Watch');
    assert.deepEqual(names(await api().get('/api/products?sort=name_asc').expect(200)), ['Apple Watch', 'Cotton Shirt', 'Galaxy Phone', 'iPhone Mini']);
  });

  it('paginates', async () => {
    const res = await api().get('/api/products?sort=name_asc&page=2&limit=3').expect(200);
    assert.deepEqual(names(res), ['iPhone Mini']);
    assert.deepEqual(res.body.pagination, { page: 2, limit: 3, total: 4, pages: 2 });
  });

  it('rejects invalid query parameters with field errors', async () => {
    for (const query of ['sort=cheapest', 'minPrice=abc', 'minPrice=500&maxPrice=100', 'minRating=7', 'page=0', 'inStock=maybe']) {
      const res = await api().get(`/api/products?${query}`).expect(400);
      assert.equal(res.body.code, 'VALIDATION_ERROR', query);
      assert.ok(res.body.errors.length > 0, query);
    }
  });

  it('lists categories with counts, sorted by name', async () => {
    const res = await api().get('/api/products/categories').expect(200);
    assert.deepEqual(res.body.categories, [
      { name: 'mens-shirts', count: 1 },
      { name: 'mens-watches', count: 1 },
      { name: 'smartphones', count: 2 },
    ]);
  });
});

describe('GET /api/products/:id', () => {
  it('returns the product, and records a view only for signed-in shoppers', async () => {
    const product = await createProduct();
    const { user, token } = await createUser();

    await api().get(`/api/products/${product.id}`).expect(200);
    const res = await api().get(`/api/products/${product.id}`).set(bearer(token)).expect(200);
    assert.equal(res.body.product.name, product.name);
    assert.deepEqual(res.body.product.reviews, []);

    const view = await waitFor(() => Interaction.findOne({ product: product._id, event: 'view' }));
    assert.equal(String(view.user), user.id);
    assert.equal(await Interaction.countDocuments({ product: product._id }), 1);
  });

  it('answers 400 for a malformed id and 404 for an unknown one', async () => {
    assert.equal((await api().get('/api/products/not-an-id').expect(400)).body.message, 'Invalid product id');
    await api().get('/api/products/507f1f77bcf86cd799439011').expect(404);
  });
});

describe('product CRUD (admin only)', () => {
  const body = {
    name: 'Trail Running Shoes',
    description: 'Lightweight shoes with a grippy sole for trail runs.',
    price: 2499,
    mrp: 3299,
    category: 'Sports Accessories',
    stock: 12,
    images: ['https://cdn.example.com/shoes/1.webp', 'https://cdn.example.com/shoes/2.webp'],
    rating: 5,
    soldCount: 999,
  };

  it('lets an admin create, update and delete a product', async () => {
    const { token } = await createAdmin();

    const created = await api().post('/api/products').set(bearer(token)).send(body).expect(201);
    const product = created.body.product;
    assert.equal(product.category, 'sports-accessories');
    assert.equal(product.slug, 'trail-running-shoes');
    assert.equal(product.thumbnail, body.images[0]);
    // Server-managed fields cannot be set by the client.
    assert.equal(product.rating, 0);
    assert.equal(product.soldCount, 0);

    const updated = await api().put(`/api/products/${product._id}`).set(bearer(token)).send({ price: 1999, stock: 3 }).expect(200);
    assert.equal(updated.body.product.price, 1999);
    assert.equal(updated.body.product.stock, 3);

    await api().delete(`/api/products/${product._id}`).set(bearer(token)).expect(200);
    await api().get(`/api/products/${product._id}`).expect(404);
  });

  it('validates the product body', async () => {
    const { token } = await createAdmin();
    const res = await api()
      .post('/api/products')
      .set(bearer(token))
      .send({ name: 'X', description: 'short', price: -1, category: '', stock: 1.5, images: ['ftp://bad'] })
      .expect(400);
    const fields = res.body.errors.map((error) => error.field);
    for (const field of ['name', 'description', 'price', 'category', 'stock', 'images']) assert.ok(fields.includes(field), field);

    const product = await createProduct({ price: 1000, mrp: 1200 });
    const mrp = await api().put(`/api/products/${product.id}`).set(bearer(token)).send({ price: 1500 }).expect(400);
    assert.match(mrp.body.errors[0].message, /MRP/);
    await api().put(`/api/products/${product.id}`).set(bearer(token)).send({}).expect(400);
  });

  it('refuses guests (401) and shoppers (403)', async () => {
    const { token } = await createUser();
    const product = await createProduct();
    await api().post('/api/products').send(body).expect(401);
    assert.equal((await api().post('/api/products').set(bearer(token)).send(body).expect(403)).body.code, 'FORBIDDEN');
    await api().put(`/api/products/${product.id}`).set(bearer(token)).send({ price: 1 }).expect(403);
    await api().delete(`/api/products/${product.id}`).set(bearer(token)).expect(403);
  });
});

describe('POST /api/products/:id/reviews', () => {
  it('creates one review per shopper, updates it on resubmission and recalculates the rating', async () => {
    const product = await createProduct();
    const first = await createUser({ name: 'Asha Nair' });
    const second = await createUser({ name: 'Ravi Kumar' });

    await api().post(`/api/products/${product.id}/reviews`).set(bearer(first.token)).send({ rating: 5, comment: 'Great' }).expect(201);
    await api().post(`/api/products/${product.id}/reviews`).set(bearer(second.token)).send({ rating: 2 }).expect(201);
    const res = await api()
      .post(`/api/products/${product.id}/reviews`)
      .set(bearer(first.token))
      .send({ rating: 4, comment: 'Still good' })
      .expect(201);

    assert.equal(res.body.product.numReviews, 2);
    assert.equal(res.body.product.rating, 3);
    assert.equal(res.body.product.reviews.find((review) => review.name === 'Asha Nair').comment, 'Still good');
  });

  it('needs a token and a 1-5 rating', async () => {
    const product = await createProduct();
    const { token } = await createUser();
    await api().post(`/api/products/${product.id}/reviews`).send({ rating: 5 }).expect(401);
    await api().post(`/api/products/${product.id}/reviews`).set(bearer(token)).send({ rating: 6 }).expect(400);
  });
});
