import mongoose from 'mongoose';
import env from '../config/env.js';
import Interaction, { EVENT_WEIGHTS, MAX_CELL_WEIGHT } from '../models/interaction.js';
import Order from '../models/order.js';
import Product from '../models/product.js';
import ApiError from '../utils/ApiError.js';
import { prettifySlug } from '../utils/strings.js';
import { RapidMinerError, fetchLiveScores, isLiveScoringConfigured } from './rapidminerClient.js';
import { cosineNeighbours, loadRatingMatrix } from './similarity.js';
import { getImportInfo, getImportedNeighbours } from './similarityImport.js';

/**
 * Recommendation engine. Sources in order of preference:
 *   1. rapidminer-live  live scoring on RapidMiner AI Hub (only when RAPIDMINER_SCORING_URL is set)
 *   2. rapidminer       item-item similarities imported from RapidMiner (POST /api/analytics/import)
 *   3. builtin-cf       the same item-based cosine CF, computed here from the interactions
 *   4. popular          sales + recent engagement + rating (guests, cold start and top-ups)
 * Lists are always filled to the requested size with popular in-stock products.
 */

export const SOURCES = Object.freeze({
  live: 'rapidminer-live',
  imported: 'rapidminer',
  builtin: 'builtin-cf',
  popular: 'popular',
});

const PRODUCT_FIELDS = '-reviews -__v';
const TRENDING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const FAVOURITE_CATEGORY_COUNT = 3;
const MAX_LIVE_ROWS = 50;
// Bayesian prior: products with only a few reviews are pulled towards an average rating.
const PRIOR_RATING = 3;
const PRIOR_REVIEWS = 5;

const BECAUSE = {
  view: (name) => `Because you viewed ${name}`,
  cart_add: (name) => `Because you added ${name} to your cart`,
  review: (name) => `Because you reviewed ${name}`,
  purchase: (name) => `Because you bought ${name}`,
};

const round = (value) => Math.round(value * 10_000) / 10_000;
const ratio = (value, max) => (max > 0 ? value / max : 0);
const maxOf = (items, key) => items.reduce((max, item) => Math.max(max, item[key]), 0);

/* ----------------------------- built-in model ----------------------------- */

let builtinCache = { model: null, expiresAt: 0 };
let pendingBuild = null;
let liveWarningShown = false;

const computeBuiltinModel = async () => {
  const matrix = await loadRatingMatrix();
  const neighbours = cosineNeighbours(matrix);
  let pairs = 0;
  let products = 0;
  for (const list of neighbours.values()) {
    pairs += list.length;
    if (list.length) products += 1;
  }
  return { neighbours, products, users: matrix.users.length, pairs, computedAt: new Date() };
};

/** The built-in item-item model, recomputed at most every RECO_CACHE_TTL_SECONDS. */
export const getBuiltinModel = () => {
  if (builtinCache.model && builtinCache.expiresAt > Date.now()) return Promise.resolve(builtinCache.model);
  if (!pendingBuild) {
    const build = computeBuiltinModel()
      .then((model) => {
        if (pendingBuild === build) builtinCache = { model, expiresAt: Date.now() + env.recoCacheTtlSeconds * 1000 };
        return model;
      })
      .finally(() => {
        if (pendingBuild === build) pendingBuild = null;
      });
    pendingBuild = build;
  }
  return pendingBuild;
};

/** Forgets cached engine state (built-in model, live-failure warning), e.g. after an import. */
export const invalidateRecommendationCache = () => {
  builtinCache = { model: null, expiresAt: 0 };
  pendingBuild = null;
  liveWarningShown = false;
};

/* ------------------------------- popularity ------------------------------- */

/**
 * In-stock catalogue ranked by popularity: 50% sales, 30% engagement in the last 30 days,
 * 20% Bayesian-damped rating. `trend` is the popularity normalised to 0-1.
 */
const loadCatalogue = async () => {
  const since = new Date(Date.now() - TRENDING_WINDOW_MS);
  const [products, recent] = await Promise.all([
    Product.find({ stock: { $gt: 0 } }).select(PRODUCT_FIELDS).lean(),
    Interaction.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$product', weight: { $sum: '$weight' } } },
    ]),
  ]);
  const recentWeight = new Map(recent.map(({ _id, weight }) => [String(_id), weight]));

  const signals = products.map((product) => {
    const id = String(product._id);
    const reviews = product.numReviews ?? 0;
    return {
      id,
      product,
      sales: Math.log1p(product.soldCount ?? 0),
      engagement: Math.log1p(recentWeight.get(id) ?? 0),
      rating: ((product.rating ?? 0) * reviews + PRIOR_RATING * PRIOR_REVIEWS) / (reviews + PRIOR_REVIEWS) / 5,
    };
  });
  const maxSales = maxOf(signals, 'sales');
  const maxEngagement = maxOf(signals, 'engagement');
  for (const signal of signals) {
    signal.popularity = 0.5 * ratio(signal.sales, maxSales) + 0.3 * ratio(signal.engagement, maxEngagement) + 0.2 * signal.rating;
  }
  const maxPopularity = maxOf(signals, 'popularity');

  const ranked = signals
    .map(({ id, product, popularity }) => ({ id, product, trend: ratio(popularity, maxPopularity) }))
    .sort((a, b) => b.trend - a.trend || a.id.localeCompare(b.id));
  return { ranked, byId: new Map(ranked.map((entry) => [entry.id, entry])) };
};

const toItem = (entry, score, reason) => ({ ...entry.product, score: round(score), reason });

/**
 * Appends popular products until `limit` is reached: first the given categories, then the
 * whole catalogue. Each set in `exclusionTiers` is tried in turn, so exclusions can be
 * relaxed (e.g. allow products the shopper only viewed) before the list stays short.
 * Scores never increase down the list.
 */
const topUp = (picked, { limit, catalogue, exclusionTiers, categories = [], categoryReason }) => {
  const chosen = new Set(picked.map((item) => String(item._id)));
  let ceiling = picked.at(-1)?.score ?? 1;
  const passes = [
    ...categories.map((category) => ({
      accepts: (entry) => entry.product.category === category,
      reason: categoryReason(prettifySlug(category)),
    })),
    { accepts: () => true, reason: 'Trending now' },
  ];

  for (const excluded of exclusionTiers) {
    for (const { accepts, reason } of passes) {
      for (const entry of catalogue.ranked) {
        if (picked.length >= limit) return picked;
        if (chosen.has(entry.id) || excluded.has(entry.id) || !accepts(entry)) continue;
        ceiling = Math.min(ceiling, entry.trend);
        picked.push(toItem(entry, ceiling, reason));
        chosen.add(entry.id);
      }
    }
  }
  return picked;
};

const buildPayload = (source, strategy, products) => ({ source, strategy, products, generatedAt: new Date().toISOString() });

/* ----------------------------- personalised ------------------------------ */

/**
 * The shopper's implicit feedback: items: Map<productId, { weight, event, name, category }>
 * (weight capped like a matrix cell, event = strongest event type) and the set of
 * purchased product ids (purchase interactions plus non-cancelled orders).
 */
const loadShopperProfile = async (userId) => {
  const user = new mongoose.Types.ObjectId(String(userId));
  const [history, orderedIds] = await Promise.all([
    Interaction.aggregate([
      { $match: { user } },
      { $group: { _id: '$product', weight: { $sum: '$weight' }, events: { $addToSet: '$event' } } },
    ]),
    Order.distinct('orderItems.product', { user, status: { $ne: 'cancelled' } }),
  ]);

  const purchased = new Set(orderedIds.map(String));
  const products = history.length
    ? await Product.find({ _id: { $in: history.map(({ _id }) => _id) } }).select('name category').lean()
    : [];
  const details = new Map(products.map((product) => [String(product._id), product]));

  const items = new Map();
  for (const { _id, weight, events } of history) {
    const id = String(_id);
    const event = events.reduce((best, current) => (EVENT_WEIGHTS[current] > EVENT_WEIGHTS[best] ? current : best));
    if (event === 'purchase') purchased.add(id);
    // Interactions with deleted products carry no usable signal.
    if (details.has(id)) {
      const { name, category } = details.get(id);
      items.set(id, { weight: Math.min(weight, MAX_CELL_WEIGHT), event, name, category });
    }
  }
  return { items, purchased };
};

const favouriteCategories = (items) => {
  const totals = new Map();
  for (const { category, weight } of items.values()) totals.set(category, (totals.get(category) ?? 0) + weight);
  return [...totals]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, FAVOURITE_CATEGORY_COUNT)
    .map(([category]) => category);
};

/** Adds one term of score(p) = sum_i w(user, i) * sim(i, p), tracking the strongest contributor. */
const addContribution = (scores, productId, value, via) => {
  const entry = scores.get(productId) ?? { score: 0, strongest: 0, via: null };
  entry.score += value;
  if (via && value > entry.strongest) {
    entry.strongest = value;
    entry.via = via;
  }
  scores.set(productId, entry);
};

const scoreFromNeighbours = (profile, neighbourLists) => {
  const scores = new Map();
  for (const [itemId, { weight }] of profile.items) {
    for (const { product, score } of neighbourLists.get(itemId) ?? []) addContribution(scores, product, weight * score, itemId);
  }
  return scores;
};

const warnLiveFailure = (message) => {
  if (liveWarningShown) return;
  liveWarningShown = true;
  console.warn(`[recommendations] RapidMiner live scoring failed (${message}); falling back to the next source.`);
};

/**
 * Live scores from RapidMiner AI Hub. Rows that name the shopper's item they came from
 * (FIRST_ID) are weighted like the item-based formula; plain rows use their score as is.
 * Any failure is logged once per outage and yields no candidates.
 */
const scoreLive = async (profile, { userId, limit, isCandidate }) => {
  if (!isLiveScoringConfigured()) return new Map();
  try {
    const rows = await fetchLiveScores({
      userId: String(userId),
      items: [...profile.items].map(([productId, { weight }]) => ({ productId, weight })),
      limit: Math.min(limit + profile.items.size + profile.purchased.size, MAX_LIVE_ROWS),
    });
    const scores = new Map();
    for (const { productId, score, sourceId } of rows) {
      if (!sourceId) addContribution(scores, productId, score, null);
      else if (profile.items.has(sourceId)) addContribution(scores, productId, profile.items.get(sourceId).weight * score, sourceId);
    }
    if (![...scores.keys()].some(isCandidate)) throw new RapidMinerError('the response contained no recommendable products');
    liveWarningShown = false;
    return scores;
  } catch (error) {
    warnLiveFailure(error.message);
    return new Map();
  }
};

const CANDIDATE_SOURCES = [
  { source: SOURCES.live, collect: scoreLive },
  {
    source: SOURCES.imported,
    collect: async (profile) => scoreFromNeighbours(profile, await getImportedNeighbours([...profile.items.keys()])),
  },
  {
    source: SOURCES.builtin,
    collect: async (profile) => scoreFromNeighbours(profile, (await getBuiltinModel()).neighbours),
  },
];

/** Best `limit` candidates (in stock, not excluded), scores normalised so the best is 1. */
const rankCandidates = (scores, { catalogue, isCandidate, limit }) => {
  const ranked = [...scores]
    .filter(([id]) => isCandidate(id))
    .sort(
      ([idA, a], [idB, b]) =>
        b.score - a.score || catalogue.byId.get(idB).trend - catalogue.byId.get(idA).trend || idA.localeCompare(idB),
    )
    .slice(0, limit);
  const top = ranked[0]?.[1].score;
  return ranked.map(([id, { score, via }]) => ({ entry: catalogue.byId.get(id), score: score / top, via }));
};

/**
 * "Recommended for you": item-based CF over the shopper's interactions, excluding products
 * they already interacted with or bought, topped up with popular products from their
 * favourite categories and then the whole catalogue.
 */
export const recommendForUser = async (userId, { limit }) => {
  const [profile, catalogue] = await Promise.all([loadShopperProfile(userId), loadCatalogue()]);
  const excluded = new Set([...profile.items.keys(), ...profile.purchased]);
  const isCandidate = (id) => !excluded.has(id) && catalogue.byId.has(id);

  let source = SOURCES.popular;
  let picked = [];
  if (profile.items.size) {
    for (const candidateSource of CANDIDATE_SOURCES) {
      const scores = await candidateSource.collect(profile, { userId, limit, isCandidate });
      const ranked = rankCandidates(scores, { catalogue, isCandidate, limit });
      if (ranked.length) {
        source = candidateSource.source;
        picked = ranked.map(({ entry, score, via }) => {
          const item = via && profile.items.get(via);
          return toItem(entry, score, item ? BECAUSE[item.event](item.name) : 'Picked for you by RapidMiner');
        });
        break;
      }
    }
  }

  topUp(picked, {
    limit,
    catalogue,
    categories: favouriteCategories(profile.items),
    categoryReason: (name) => `Popular in ${name}`,
    // Prefer products the shopper has not seen; then allow viewed (never bought) ones.
    exclusionTiers: [excluded, profile.purchased],
  });
  // Last resort (the shopper bought everything in stock): never answer with an empty list.
  if (!picked.length) topUp(picked, { limit, catalogue, exclusionTiers: [new Set()] });

  return buildPayload(source, source === SOURCES.popular ? 'trending' : 'personalized', picked);
};

/** Popular products for guests and as the cold-start answer. */
export const recommendTrending = async ({ limit }) => {
  const catalogue = await loadCatalogue();
  return buildPayload(SOURCES.popular, 'trending', topUp([], { limit, catalogue, exclusionTiers: [new Set()] }));
};

/**
 * "You may also like" for a product page: its nearest neighbours from the imported
 * RapidMiner model (or the built-in model), topped up with popular products of the same
 * category. Throws 404 for an unknown product.
 */
export const recommendSimilar = async (productId, { limit }) => {
  const product = await Product.findById(productId).select('category').lean();
  if (!product) throw ApiError.notFound('Product not found');

  const id = String(product._id);
  const [catalogue, imported] = await Promise.all([loadCatalogue(), getImportedNeighbours([id])]);
  let source = SOURCES.imported;
  let neighbours = imported.get(id) ?? [];
  if (!neighbours.length) {
    source = SOURCES.builtin;
    neighbours = (await getBuiltinModel()).neighbours.get(id) ?? [];
  }

  const usable = neighbours.filter(({ product: other }) => other !== id && catalogue.byId.has(other)).slice(0, limit);
  // Cosine scores are already 0-1; other imported measures are scaled down to that range.
  const scale = Math.max(1, usable[0]?.score ?? 0);
  const picked = usable.map(({ product: other, score }) =>
    toItem(catalogue.byId.get(other), score / scale, 'Customers who viewed this also viewed'),
  );
  if (!picked.length) source = SOURCES.popular;

  topUp(picked, {
    limit,
    catalogue,
    categories: [product.category],
    categoryReason: (name) => `More in ${name}`,
    exclusionTiers: [new Set([id])],
  });
  return buildPayload(source, 'similar-items', picked);
};

/** Model overview for GET /api/analytics/status. */
export const getEngineStatus = async () => {
  const [lastImport, model] = await Promise.all([getImportInfo(), getBuiltinModel()]);
  const liveConfigured = isLiveScoringConfigured();
  let activeSource = SOURCES.popular;
  if (liveConfigured) activeSource = SOURCES.live;
  else if (lastImport) activeSource = SOURCES.imported;
  else if (model.pairs > 0) activeSource = SOURCES.builtin;

  return {
    activeSource,
    rapidminer: { liveConfigured, lastImport },
    builtin: { products: model.products, users: model.users, pairs: model.pairs, computedAt: model.computedAt },
  };
};
