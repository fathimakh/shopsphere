/**
 * Shared setup for the API integration tests (node:test + supertest).
 *
 * Import this module FIRST in a test file: the environment below must be in place before
 * config/env.js is evaluated, which is why the app and models are loaded dynamically.
 * Every test file calls useTestDatabase('<file-stem>') to get its own throw-away database.
 */
import { after, before } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-only-jwt-secret-for-shopsphere-api';
process.env.CLIENT_URL ??= 'http://localhost:5175';
// The suite logs in far more often than a real client; keep the brute-force limiter out of the way.
process.env.AUTH_RATE_LIMIT_MAX = '10000';

const MONGO_BASE_URI = process.env.TEST_MONGO_BASE_URI || 'mongodb://127.0.0.1:27035';

const { default: mongoose } = await import('mongoose');
const { default: request } = await import('supertest');
const { default: app } = await import('../../index.js');
const { default: User } = await import('../../models/user.js');
const { default: Product } = await import('../../models/product.js');
const { default: generateToken } = await import('../../utils/generateToken.js');

export { app, mongoose };

/** Fresh supertest agent for the app. */
export const api = () => request(app);

/** Connects to mongodb://.../shopsphere_test_<name>, starting from (and leaving) an empty database. */
export const useTestDatabase = (name) => {
  before(async () => {
    await mongoose.connect(`${MONGO_BASE_URI}/shopsphere_test_${name}`, { serverSelectionTimeoutMS: 5000 });
    await mongoose.connection.dropDatabase();
    // Dropping the database also drops the unique indexes (email, slug) the tests rely on.
    await Promise.all(Object.values(mongoose.models).map((model) => model.createIndexes()));
  });
  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
};

export const bearer = (token) => ({ Authorization: `Bearer ${token}` });

let sequence = 0;
const nextId = () => {
  sequence += 1;
  return sequence;
};

export const DEFAULT_PASSWORD = 'Passw0rd!';

/** Creates a user directly in the database and returns it with a valid token. */
export const createUser = async ({ role = 'user', password = DEFAULT_PASSWORD, ...overrides } = {}) => {
  const id = nextId();
  const user = await User.create({ name: `Test User ${id}`, email: `user${id}@test.dev`, password, role, ...overrides });
  return { user, token: generateToken(user), password };
};

export const createAdmin = (overrides = {}) => createUser({ role: 'admin', ...overrides });

export const createProduct = (overrides = {}) => {
  const id = nextId();
  return Product.create({
    name: `Test Product ${id}`,
    description: 'A product created by the automated test-suite.',
    price: 500,
    category: 'test-gear',
    stock: 10,
    images: [`https://cdn.example.com/products/${id}.webp`],
    ...overrides,
  });
};

export const validShippingAddress = () => ({
  fullName: 'Asha Nair',
  phone: '+91 98765 43210',
  street: '12 MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560001',
});

/** Polls until `check` returns a truthy value (for fire-and-forget side effects such as view tracking). */
export const waitFor = async (check, { timeoutMs = 2000, intervalMs = 25 } = {}) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await check();
    if (result || Date.now() > deadline) return result;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
};
