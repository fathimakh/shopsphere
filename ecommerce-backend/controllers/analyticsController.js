import Interaction, { INTERACTION_EVENTS } from '../models/interaction.js';
import Order, { ORDER_STATUSES } from '../models/order.js';
import Product from '../models/product.js';
import User from '../models/user.js';
import { buildInteractionsCsv, buildProductsCsv, buildRatingMatrixCsv } from '../services/analyticsExport.js';
import { recordInteraction } from '../services/interactionService.js';
import {
  getEngineStatus,
  invalidateRecommendationCache,
  recommendForUser,
  recommendSimilar,
  recommendTrending,
} from '../services/recommendationEngine.js';
import { clearImportedSimilarities, importSimilarityCsv } from '../services/similarityImport.js';
import ApiError from '../utils/ApiError.js';
import { createQueryReader } from '../utils/queryReader.js';

const MAX_RECOMMENDATIONS = 24;
const LOW_STOCK_THRESHOLD = 10;
const DASHBOARD_LIST_SIZE = 5;

/** ?limit=n (positive integer, silently capped at MAX_RECOMMENDATIONS). */
const readLimit = (query, fallback) => {
  const reader = createQueryReader(query);
  const limit = reader.number('limit', { min: 1, integer: true });
  reader.assertValid();
  return Math.min(limit ?? fallback, MAX_RECOMMENDATIONS);
};

const sendCsv = (res, filename, csv) => {
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  });
  res.send(csv);
};

/**
 * POST /api/analytics/track — browsing signals (view / cart_add) from the shopper's UI.
 * Repeats within 30 minutes are ignored by the service but still answered with 201.
 */
export const trackInteraction = async (req, res) => {
  const { productId, event } = req.body;
  if (!(await Product.exists({ _id: productId }))) throw ApiError.notFound('Product not found');

  await recordInteraction({ userId: req.user._id, productId, event });
  res.status(201).json({ success: true });
};

/** GET /api/analytics/recommendations — personalised when logged in, trending for guests. */
export const getRecommendations = async (req, res) => {
  const limit = readLimit(req.query, 8);
  const payload = req.user ? await recommendForUser(req.user._id, { limit }) : await recommendTrending({ limit });
  res.json({ success: true, ...payload });
};

/** GET /api/analytics/recommendations/product/:id — "You may also like". */
export const getProductRecommendations = async (req, res) => {
  const limit = readLimit(req.query, 6);
  const payload = await recommendSimilar(req.params.id, { limit });
  res.json({ success: true, ...payload });
};

/** GET /api/analytics/export/rating-matrix.csv — input of the RapidMiner similarity process. */
export const exportRatingMatrix = async (_req, res) => {
  sendCsv(res, 'rating-matrix.csv', await buildRatingMatrixCsv());
};

/** GET /api/analytics/export/interactions.csv */
export const exportInteractions = async (_req, res) => {
  sendCsv(res, 'interactions.csv', await buildInteractionsCsv());
};

/** GET /api/analytics/export/products.csv */
export const exportProducts = async (_req, res) => {
  sendCsv(res, 'products.csv', await buildProductsCsv());
};

/**
 * POST /api/analytics/import — RapidMiner's scored output, sent either as a raw
 * text/csv body or as JSON { csv: "<file contents>" }. Replaces the previous import.
 */
export const importSimilarities = async (req, res) => {
  const csv = typeof req.body === 'string' ? req.body : req.body?.csv;
  if (typeof csv !== 'string' || !csv.trim()) {
    throw ApiError.badRequest('Send the RapidMiner output as a text/csv body or as JSON { "csv": "<file contents>" }', {
      code: 'CSV_REQUIRED',
    });
  }

  const result = await importSimilarityCsv(csv);
  invalidateRecommendationCache();
  res.json({ success: true, ...result });
};

/** DELETE /api/analytics/import — the engine falls back to the built-in model. */
export const clearImportedModel = async (_req, res) => {
  const removed = await clearImportedSimilarities();
  invalidateRecommendationCache();
  res.json({
    success: true,
    message: removed
      ? `Imported RapidMiner model removed (${removed} products). Recommendations now use the built-in model.`
      : 'There was no imported RapidMiner model to remove.',
  });
};

/** GET /api/analytics/status — which recommendation source is active and how much data it has. */
export const getStatus = async (_req, res) => {
  const [engine, eventCounts] = await Promise.all([
    getEngineStatus(),
    Interaction.aggregate([{ $group: { _id: '$event', count: { $sum: 1 } } }]),
  ]);

  const byEvent = Object.fromEntries(INTERACTION_EVENTS.map((event) => [event, 0]));
  for (const { _id, count } of eventCounts) byEvent[_id] = count;
  const total = Object.values(byEvent).reduce((sum, count) => sum + count, 0);

  res.json({ success: true, ...engine, interactions: { total, byEvent } });
};

/** GET /api/analytics/summary — admin dashboard figures. */
export const getSummary = async (_req, res) => {
  const [users, products, orders, [revenue], statusCounts, lowStock, bestSellers, recentOrders] = await Promise.all([
    User.countDocuments(),
    Product.countDocuments(),
    Order.countDocuments(),
    Order.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$totalPrice' } } }]),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Product.find({ stock: { $lte: LOW_STOCK_THRESHOLD } })
      .select('-reviews')
      .sort({ stock: 1, name: 1 })
      .limit(DASHBOARD_LIST_SIZE),
    Product.find({ soldCount: { $gt: 0 } })
      .select('-reviews')
      .sort({ soldCount: -1, name: 1 })
      .limit(DASHBOARD_LIST_SIZE),
    Order.find().sort({ createdAt: -1, _id: -1 }).limit(DASHBOARD_LIST_SIZE).populate('user', 'name email'),
  ]);

  const ordersByStatus = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0]));
  for (const { _id, count } of statusCounts) ordersByStatus[_id] = count;

  res.json({
    success: true,
    totals: { users, products, orders, revenue: Math.round((revenue?.total ?? 0) * 100) / 100 },
    ordersByStatus,
    lowStock,
    topProducts: bestSellers.map((product) => ({ product, soldCount: product.soldCount })),
    recentOrders,
  });
};
