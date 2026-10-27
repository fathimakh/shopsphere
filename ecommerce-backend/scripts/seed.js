/**
 * Seeds the ShopSphere database (npm run seed).
 *
 * Wipes every collection and recreates a realistic, reproducible store:
 *  - the 60-product catalogue from scripts/data/products.json (no network needed),
 *  - an admin, the demo shopper and 15 synthetic shoppers with category "personas",
 *  - their browsing behaviour (views, cart adds), verified reviews and orders in every
 *    status, spread over the last 60 days, so the recommendation engine and the RapidMiner
 *    export have real signal from the first run,
 *  - a few contact messages for the admin inbox.
 * Stock, soldCount, ratings and order totals are kept consistent with the generated orders.
 * A fixed PRNG seed makes every run produce the same data.
 */
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import env from '../config/env.js';
import { connectDB, disconnectDB } from '../config/dbConnection.js';
import ContactMessage from '../models/contactMessage.js';
import Interaction, { EVENT_WEIGHTS } from '../models/interaction.js';
import Order, { NEXT_STATUS, calculateOrderPrices } from '../models/order.js';
import Product from '../models/product.js';
import ProductSimilarity from '../models/productSimilarity.js';
import User from '../models/user.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const NOW = Date.now();

export const DEMO_SHOPPER = { name: 'Demo Shopper', email: 'demo@shopsphere.dev', password: 'Demo@1234' };
export const SHOPPER_PASSWORD = 'Shopper@123';

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

/** mulberry32: tiny, fast, seedable PRNG returning floats in [0, 1). */
const createRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const random = createRandom(20261027);
const randomInt = (min, max) => min + Math.floor(random() * (max - min + 1));
const chance = (probability) => random() < probability;
const pick = (items) => items[Math.floor(random() * items.length)];
const sample = (items, count) => {
  const pool = [...items];
  const picked = [];
  while (pool.length && picked.length < count) picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return picked;
};
/**
 * Fixed ObjectIds for seeded users and products, so every seed produces the same ids. The
 * committed RapidMiner exports (rapidminer/data/) and any similarity model RapidMiner builds
 * from them therefore stay valid for every freshly seeded store, local or deployed.
 */
const ID_KIND = { user: '01', product: '02' };
const seedObjectId = (kind, n) => new mongoose.Types.ObjectId(`66f1a000${ID_KIND[kind]}${n.toString(16).padStart(14, '0')}`);

const daysAgo = (days) => new Date(NOW - days * DAY_MS - randomInt(0, 20) * HOUR_MS);

// ---------------------------------------------------------------------------
// Shoppers and their tastes
// ---------------------------------------------------------------------------

const PERSONAS = {
  techie: ['smartphones', 'laptops', 'tablets', 'mobile-accessories'],
  fashionista: ['womens-bags', 'fragrances', 'sunglasses'],
  gentleman: ['mens-watches', 'mens-shirts', 'fragrances', 'sunglasses'],
  homemaker: ['kitchen-accessories', 'home-decoration'],
  athlete: ['sports-accessories', 'mens-shirts', 'mobile-accessories'],
  gifter: ['mobile-accessories', 'mens-watches', 'womens-bags', 'home-decoration'],
};

const SHOPPERS = [
  ['Aarav Sharma', 'techie', 'Bengaluru', 'Karnataka', '560001'],
  ['Diya Menon', 'fashionista', 'Kochi', 'Kerala', '682001'],
  ['Rohan Gupta', 'gentleman', 'New Delhi', 'Delhi', '110001'],
  ['Ananya Iyer', 'homemaker', 'Chennai', 'Tamil Nadu', '600001'],
  ['Kabir Singh', 'athlete', 'Chandigarh', 'Punjab', '160017'],
  ['Meera Nair', 'gifter', 'Thiruvananthapuram', 'Kerala', '695001'],
  ['Arjun Reddy', 'techie', 'Hyderabad', 'Telangana', '500001'],
  ['Ishita Kapoor', 'fashionista', 'Mumbai', 'Maharashtra', '400001'],
  ['Vikram Joshi', 'gentleman', 'Pune', 'Maharashtra', '411001'],
  ['Sneha Pillai', 'homemaker', 'Kozhikode', 'Kerala', '673001'],
  ['Aditya Verma', 'athlete', 'Lucknow', 'Uttar Pradesh', '226001'],
  ['Fatima Khan', 'gifter', 'Bhopal', 'Madhya Pradesh', '462001'],
  ['Nikhil Rao', 'techie', 'Mysuru', 'Karnataka', '570001'],
  ['Priya Das', 'fashionista', 'Kolkata', 'West Bengal', '700001'],
  ['Sameer Ali', 'homemaker', 'Ahmedabad', 'Gujarat', '380001'],
];

const STREETS = ['MG Road', 'Station Road', 'Park Street', 'Lake View Avenue', 'Temple Street', 'Gandhi Nagar'];

const REVIEW_COMMENTS = {
  5: ['Excellent quality, exactly as described.', 'Absolutely love it - worth every rupee!', 'Fast delivery and a superb product.'],
  4: ['Very good overall, minor nitpicks only.', 'Good value for money. Would recommend.', 'Works well, packaging could be better.'],
  3: ['Decent, but I expected a little more.', 'Average product, does the job.', 'Okay for the price.'],
};

const CONTACT_MESSAGES = [
  ['Rahul Mehta', 'rahul.mehta@example.com', 'Bulk order enquiry', 'Hi, we would like to order 25 units of the stainless steel water bottle for our office. Do you offer a bulk discount?', 'new'],
  ['Neha Bose', 'neha.bose@example.com', 'Delivery time to Guwahati', 'How many days does delivery usually take to Guwahati, Assam? I want to send a gift for a birthday next week.', 'read'],
  ['Joseph Mathew', 'joseph.m@example.com', 'Return policy', 'Can I return sunglasses if they do not fit well? Please share the return window and process.', 'resolved'],
];

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const addressFor = (city, state, postalCode) => ({
  street: `${randomInt(4, 220)}, ${pick(STREETS)}`,
  city,
  state,
  postalCode,
  country: 'India',
});

const phoneNumber = () => `+91 9${randomInt(100, 999)}${randomInt(10, 99)} ${randomInt(10000, 99999)}`;

/** Status path of an order placed `ageDays` ago: older orders have progressed further. */
const pickFinalStatus = (ageDays) => {
  if (chance(0.1)) return 'cancelled';
  if (ageDays > 12) return 'delivered';
  if (ageDays > 6) return pick(['shipped', 'delivered']);
  if (ageDays > 2) return pick(['processing', 'shipped']);
  return pick(['pending', 'processing']);
};

const STATUS_NOTES = {
  pending: (paymentMethod) => (paymentMethod === 'CARD' ? 'Order placed and paid by card (simulated)' : 'Order placed (cash on delivery)'),
  processing: () => 'Order confirmed and being prepared',
  shipped: () => 'Order shipped',
  delivered: () => 'Order delivered',
  cancelled: () => 'Cancelled by customer',
};

/** Builds an order document (status history, payment and delivery fields) for `finalStatus`. */
const buildOrder = ({ user, items, placedAt, finalStatus }) => {
  const paymentMethod = chance(0.55) ? 'CARD' : 'COD';
  const statusHistory = [{ status: 'pending', note: STATUS_NOTES.pending(paymentMethod), at: placedAt }];
  let at = placedAt;
  let status = 'pending';

  const advance = (next) => {
    at = new Date(Math.min(at.getTime() + randomInt(10, 40) * HOUR_MS, NOW - HOUR_MS));
    statusHistory.push({ status: next, note: STATUS_NOTES[next](paymentMethod), at });
    status = next;
  };
  if (finalStatus === 'cancelled') {
    if (chance(0.5)) advance('processing');
    advance('cancelled');
  } else {
    while (status !== finalStatus) advance(NEXT_STATUS[status]);
  }

  const paidByCard = paymentMethod === 'CARD';
  const delivered = finalStatus === 'delivered';
  return {
    user: user._id,
    orderItems: items,
    shippingAddress: { fullName: user.name, phone: user.phone, ...user.address },
    paymentMethod,
    paymentResult: paidByCard ? { status: 'simulated-success', reference: `SIM-SEED-${randomInt(100000, 999999)}` } : null,
    ...calculateOrderPrices(items),
    isPaid: paidByCard || delivered,
    paidAt: paidByCard ? placedAt : delivered ? at : null,
    status: finalStatus,
    statusHistory,
    deliveredAt: delivered ? at : null,
    cancelledAt: finalStatus === 'cancelled' ? at : null,
    createdAt: placedAt,
    updatedAt: at,
  };
};

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const loadCatalogue = async () => {
  const snapshot = JSON.parse(await readFile(new URL('./data/products.json', import.meta.url), 'utf8'));
  return snapshot.products;
};

const createProducts = async (catalogue) => {
  // Staggered creation dates make "Newest" sorting meaningful.
  const docs = catalogue.map(({ sourceId, ...product }, index) => {
    const createdAt = daysAgo(90 - index);
    return { _id: seedObjectId('product', index + 1), ...product, createdAt, updatedAt: createdAt };
  });
  return Product.insertMany(docs);
};

const createUsers = async () => {
  const admin = await User.create({
    _id: seedObjectId('user', 1),
    name: 'Store Admin',
    email: env.seedAdminEmail,
    password: env.seedAdminPassword,
    role: 'admin',
    phone: '+91 98470 12345',
    address: addressFor('Kochi', 'Kerala', '682016'),
  });
  const demo = await User.create({
    _id: seedObjectId('user', 2),
    ...DEMO_SHOPPER,
    phone: '+91 98765 43210',
    address: { street: '12, Marine Drive', city: 'Kochi', state: 'Kerala', postalCode: '682031', country: 'India' },
  });
  const shoppers = [];
  for (const [index, [name, persona, city, state, postalCode]] of SHOPPERS.entries()) {
    const email = `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`;
    const user = await User.create({
      _id: seedObjectId('user', index + 3),
      name,
      email,
      password: SHOPPER_PASSWORD,
      phone: phoneNumber(),
      address: addressFor(city, state, postalCode),
    });
    shoppers.push({ user, persona });
  }
  return { admin, demo, shoppers };
};

/**
 * Simulates one shopper's last 60 days: browsing mostly inside their persona's categories,
 * adding some products to the cart, buying a few and reviewing delivered purchases.
 */
const simulateShopper = ({ user, categories, products, stock, interactions, orders, reviews, plan }) => {
  const inPersona = products.filter((product) => categories.includes(product.category));
  const viewed = new Set();
  const viewCount = plan?.views ?? randomInt(8, 16);

  for (let i = 0; i < viewCount; i += 1) {
    const product = chance(0.85) ? pick(inPersona) : pick(products);
    viewed.add(product);
    interactions.push({ user: user._id, product: product._id, event: 'view', createdAt: daysAgo(randomInt(1, 60)) });
  }

  const carted = [...viewed].filter(() => chance(plan?.cartRate ?? 0.4));
  for (const product of carted) {
    interactions.push({ user: user._id, product: product._id, event: 'cart_add', createdAt: daysAgo(randomInt(1, 50)) });
  }

  const orderCount = plan?.orders ?? randomInt(1, 3);
  const candidates = carted.length ? carted : [...viewed];
  for (let i = 0; i < orderCount; i += 1) {
    // A shopper's latest order is often only days old, so open orders exist in every status.
    const recent = i === orderCount - 1 && chance(0.45);
    const ageDays = plan?.orderAgeDays ?? (recent ? randomInt(0, 3) : randomInt(4, 45));
    const items = sample(candidates, randomInt(1, Math.min(3, candidates.length)))
      .map((product) => ({ product, quantity: product.price > 20000 ? 1 : randomInt(1, 2) }))
      .filter(({ product, quantity }) => stock.get(product.id) >= quantity);
    if (!items.length) continue;

    const finalStatus = plan?.status ?? pickFinalStatus(ageDays);
    const placedAt = daysAgo(ageDays);
    const order = buildOrder({
      user,
      placedAt,
      finalStatus,
      items: items.map(({ product, quantity }) => ({
        product: product._id,
        name: product.name,
        image: product.thumbnail || product.images[0] || '',
        price: product.price,
        quantity,
      })),
    });
    orders.push(order);
    if (finalStatus === 'cancelled') continue;

    for (const { product, quantity } of items) {
      stock.set(product.id, stock.get(product.id) - quantity);
      interactions.push({ user: user._id, product: product._id, event: 'purchase', createdAt: placedAt, quantity });

      // Verified reviews: only for delivered purchases, mostly positive inside the persona.
      if (finalStatus === 'delivered' && chance(plan?.reviewRate ?? 0.65)) {
        const rating = categories.includes(product.category) ? pick([4, 5, 5]) : pick([3, 4]);
        const reviewedAt = new Date(order.deliveredAt.getTime() + randomInt(1, 3) * DAY_MS);
        reviews.push({ product, user, rating, comment: pick(REVIEW_COMMENTS[rating]), at: new Date(Math.min(reviewedAt, NOW)) });
        interactions.push({ user: user._id, product: product._id, event: 'review', createdAt: reviews.at(-1).at });
      }
    }
  }
};

const seed = async () => {
  await connectDB();
  console.log(`Seeding ${env.mongoUri.replace(/\/\/[^@/]+@/, '//***:***@')} ...`);

  await Promise.all(
    [User, Product, Order, Interaction, ProductSimilarity, ContactMessage].map((model) => model.deleteMany({})),
  );

  const products = await createProducts(await loadCatalogue());
  const { admin, demo, shoppers } = await createUsers();

  const stock = new Map(products.map((product) => [product.id, product.stock]));
  const interactions = [];
  const orders = [];
  const reviews = [];

  for (const { user, persona } of shoppers) {
    simulateShopper({ user, categories: PERSONAS[persona], products, stock, interactions, orders, reviews });
  }
  // The demo shopper likes phones and their accessories and has one delivered order, so
  // "Recommended for you" is personalised right after the first login.
  simulateShopper({
    user: demo,
    categories: ['smartphones', 'mobile-accessories'],
    products,
    stock,
    interactions,
    orders,
    reviews,
    plan: { views: 7, cartRate: 0.3, orders: 1, orderAgeDays: 20, status: 'delivered', reviewRate: 0 },
  });

  // Purchases are always recorded server-side with their weight; quantities only change stock.
  await Interaction.insertMany(
    interactions.map(({ quantity, ...interaction }) => ({ ...interaction, weight: EVENT_WEIGHTS[interaction.event] })),
  );
  await Order.insertMany(orders);

  // Consistent catalogue: stock and soldCount follow the non-cancelled orders, ratings the reviews.
  const sold = new Map();
  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    for (const item of order.orderItems) sold.set(String(item.product), (sold.get(String(item.product)) ?? 0) + item.quantity);
  }
  const reviewsByProduct = new Map();
  for (const review of reviews) {
    reviewsByProduct.set(review.product.id, [...(reviewsByProduct.get(review.product.id) ?? []), review]);
  }
  for (const product of products) {
    product.stock = stock.get(product.id);
    product.soldCount = sold.get(product.id) ?? 0;
    for (const { user, rating, comment, at } of reviewsByProduct.get(product.id) ?? []) {
      product.reviews.push({ user: user._id, name: user.name, rating, comment, createdAt: at, updatedAt: at });
    }
    product.recalculateRating();
    await product.save({ timestamps: false });
  }

  await ContactMessage.insertMany(
    CONTACT_MESSAGES.map(([name, email, subject, message, status], index) => ({
      name,
      email,
      subject,
      message,
      status,
      createdAt: daysAgo(index * 3 + 1),
    })),
  );

  const byStatus = orders.reduce((counts, order) => ({ ...counts, [order.status]: (counts[order.status] ?? 0) + 1 }), {});
  console.log(`
Seed complete:
  products      ${products.length} (${new Set(products.map((product) => product.category)).size} categories)
  users         ${shoppers.length + 2} (1 admin, 1 demo shopper, ${shoppers.length} synthetic shoppers)
  orders        ${orders.length} ${JSON.stringify(byStatus)}
  interactions  ${interactions.length}
  reviews       ${reviews.length}
  messages      ${CONTACT_MESSAGES.length}

Sign in with:
  admin         ${admin.email} / ${env.seedAdminPassword}
  demo shopper  ${demo.email} / ${DEMO_SHOPPER.password}
  shoppers      <first>.<last>@example.com / ${SHOPPER_PASSWORD} (e.g. ${shoppers[0].user.email})
`);
};

seed()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
