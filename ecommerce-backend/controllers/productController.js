import Interaction from '../models/interaction.js';
import Product from '../models/product.js';
import User from '../models/user.js';
import { trackSafely } from '../services/interactionService.js';
import ApiError from '../utils/ApiError.js';
import { buildPagination, createQueryReader } from '../utils/queryReader.js';
import { escapeRegex, slugify } from '../utils/strings.js';

// Fields an admin may set; rating, numReviews, soldCount, slug and reviews are server-managed.
const EDITABLE_FIELDS = ['name', 'description', 'price', 'mrp', 'category', 'brand', 'images', 'thumbnail', 'stock', 'tags', 'isFeatured'];
const SEARCH_FIELDS = ['name', 'description', 'brand', 'tags', 'category'];

// Every sort ends with _id so pagination is stable when the primary key ties.
export const SORT_OPTIONS = {
  newest: { createdAt: -1, _id: -1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: -1 },
  rating: { rating: -1, numReviews: -1, _id: 1 },
  popular: { soldCount: -1, rating: -1, _id: 1 },
  name_asc: { name: 1, _id: 1 },
};

const pickEditable = (body) =>
  Object.fromEntries(EDITABLE_FIELDS.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));

const findProductOr404 = async (id) => {
  const product = await Product.findById(id);
  if (!product) throw ApiError.notFound('Product not found');
  return product;
};

/**
 * Turns the query string into a MongoDB filter. Each search word must match at least one of
 * the searchable fields, so "apple watch" finds an Apple-branded watch.
 */
const buildProductFilter = (query) => {
  const search = query.string('search');
  const categories = query.list('category').map(slugify).filter(Boolean);
  const brand = query.string('brand', { maxLength: 60 });
  const minPrice = query.number('minPrice', { min: 0 });
  const maxPrice = query.number('maxPrice', { min: 0 });
  const minRating = query.number('minRating', { min: 0, max: 5 });
  const inStock = query.boolean('inStock');
  const featured = query.boolean('featured');

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    query.errors.push({ field: 'maxPrice', message: 'maxPrice must be greater than or equal to minPrice' });
  }

  const filter = {};
  if (search) {
    const words = search.split(/\s+/).slice(0, 8);
    filter.$and = words.map((word) => {
      const pattern = new RegExp(escapeRegex(word), 'i');
      return { $or: SEARCH_FIELDS.map((field) => ({ [field]: pattern })) };
    });
  }
  if (categories.length) filter.category = categories.length === 1 ? categories[0] : { $in: categories };
  if (brand) filter.brand = new RegExp(`^${escapeRegex(brand)}$`, 'i');
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = minPrice;
    if (maxPrice !== undefined) filter.price.$lte = maxPrice;
  }
  if (minRating !== undefined) filter.rating = { $gte: minRating };
  if (inStock) filter.stock = { $gt: 0 };
  if (featured) filter.isFeatured = true;
  return filter;
};

/** GET /api/products — filtering, sorting, search and pagination (contract §3.4). */
export const listProducts = async (req, res) => {
  const query = createQueryReader(req.query);
  const filter = buildProductFilter(query);
  const sort = query.oneOf('sort', Object.keys(SORT_OPTIONS), 'newest');
  const { page, limit, skip } = query.pagination({ defaultLimit: 12, maxLimit: 50 });
  query.assertValid();

  const finder = Product.find(filter).select('-reviews -__v').sort(SORT_OPTIONS[sort]).skip(skip).limit(limit).lean();
  // Case-insensitive A-Z, so "iPhone 9" sorts among the I's instead of after "Z".
  if (sort === 'name_asc') finder.collation({ locale: 'en', strength: 2 });

  const [products, total] = await Promise.all([finder, Product.countDocuments(filter)]);

  res.json({ success: true, products, pagination: buildPagination(page, limit, total) });
};

/** GET /api/products/categories — every category slug with its product count, sorted by name. */
export const getCategories = async (_req, res) => {
  const categories = await Product.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, name: '$_id', count: 1 } },
  ]);
  res.json({ success: true, categories });
};

/** GET /api/products/:id — full product with reviews (newest first); records a view for signed-in users. */
export const getProduct = async (req, res) => {
  const product = await findProductOr404(req.params.id);
  if (req.user) trackSafely({ userId: req.user._id, productId: product._id, event: 'view' });

  const data = product.toJSON();
  data.reviews.sort((a, b) => b.createdAt - a.createdAt);
  res.json({ success: true, product: data });
};

/** POST /api/products (admin) */
export const createProduct = async (req, res) => {
  const product = await Product.create(pickEditable(req.body));
  res.status(201).json({ success: true, product });
};

/** PUT /api/products/:id (admin) — partial update; document validators (e.g. mrp >= price) still apply. */
export const updateProduct = async (req, res) => {
  const product = await findProductOr404(req.params.id);
  product.set(pickEditable(req.body));
  await product.save();
  res.json({ success: true, product });
};

/** DELETE /api/products/:id (admin) — also removes the product from saved carts and browsing history. */
export const deleteProduct = async (req, res) => {
  const product = await findProductOr404(req.params.id);
  await Promise.all([
    product.deleteOne(),
    User.updateMany({ 'cart.product': product._id }, { $pull: { cart: { product: product._id } } }),
    Interaction.deleteMany({ product: product._id }),
  ]);
  res.json({ success: true, message: `Product "${product.name}" deleted` });
};

/**
 * POST /api/products/:id/reviews — one review per user: a second submission updates it.
 * The product's rating and numReviews are recalculated from the embedded reviews.
 */
export const addReview = async (req, res) => {
  const product = await findProductOr404(req.params.id);
  const rating = Number(req.body.rating);
  const comment = req.body.comment?.trim() ?? '';

  const existing = product.reviews.find((review) => review.user.equals(req.user._id));
  if (existing) {
    existing.set({ rating, comment, name: req.user.name });
  } else {
    product.reviews.push({ user: req.user._id, name: req.user.name, rating, comment });
  }
  product.recalculateRating();
  await product.save();

  trackSafely({ userId: req.user._id, productId: product._id, event: 'review' });
  res.status(201).json({ success: true, product });
};
