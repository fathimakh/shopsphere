import Interaction, { MAX_CELL_WEIGHT } from '../models/interaction.js';
import Product from '../models/product.js';

/** Neighbours kept per product, both for the built-in model and for RapidMiner imports. */
export const TOP_NEIGHBOURS = 20;

/**
 * Builds the product x user implicit-feedback matrix exactly like the rating-matrix.csv
 * export: a cell is the sum of event weights for that (product, user), capped at
 * MAX_CELL_WEIGHT. `cells` is a list of { product, user, weight } (ids of any type).
 * Returns sorted product / user id lists and `rows`: Map<productId, Map<userId, weight>>.
 */
export const buildRatingMatrix = (cells) => {
  const rows = new Map();
  const users = new Set();

  for (const { product, user, weight } of cells) {
    const productId = String(product);
    const userId = String(user);
    if (!rows.has(productId)) rows.set(productId, new Map());
    const row = rows.get(productId);
    // Weights are non-negative, so capping the running total equals capping the final sum.
    row.set(userId, Math.min((row.get(userId) ?? 0) + weight, MAX_CELL_WEIGHT));
    users.add(userId);
  }

  return { products: [...rows.keys()].sort(), users: [...users].sort(), rows };
};

/**
 * Item-based cosine similarity between product rows of the rating matrix, i.e. what
 * RapidMiner's "Data to Similarity" (numerical measure: CosineSimilarity) computes on
 * rating-matrix.csv:  sim(a, b) = (a . b) / (|a| |b|).
 * Returns Map<productId, [{ product, score }]> with the `topK` best neighbours (score > 0),
 * sorted by score descending (ties by id, so the output is deterministic).
 */
export const cosineNeighbours = (matrix, { topK = TOP_NEIGHBOURS } = {}) => {
  const squaredNorms = new Map();
  const productsByUser = new Map();

  for (const [productId, row] of matrix.rows) {
    let squaredNorm = 0;
    for (const [userId, weight] of row) {
      if (weight <= 0) continue;
      squaredNorm += weight * weight;
      if (!productsByUser.has(userId)) productsByUser.set(userId, []);
      productsByUser.get(userId).push([productId, weight]);
    }
    squaredNorms.set(productId, squaredNorm);
  }

  // Only products that share at least one user have a non-zero dot product, so the dot
  // products are accumulated user by user instead of comparing every pair of products.
  const dots = new Map();
  const addDot = (a, b, value) => {
    if (!dots.has(a)) dots.set(a, new Map());
    const row = dots.get(a);
    row.set(b, (row.get(b) ?? 0) + value);
  };
  for (const entries of productsByUser.values()) {
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const [a, weightA] = entries[i];
        const [b, weightB] = entries[j];
        addDot(a, b, weightA * weightB);
        addDot(b, a, weightA * weightB);
      }
    }
  }

  const neighbours = new Map();
  for (const [productId, row] of dots) {
    const list = [...row]
      .map(([other, dot]) => ({ product: other, score: dot / Math.sqrt(squaredNorms.get(productId) * squaredNorms.get(other)) }))
      .sort((x, y) => y.score - x.score || x.product.localeCompare(y.product))
      .slice(0, topK);
    neighbours.set(productId, list);
  }
  return neighbours;
};

/** Loads the rating matrix from the interactions of products that still exist. */
export const loadRatingMatrix = async () => {
  const [cells, productIds] = await Promise.all([
    Interaction.aggregate([{ $group: { _id: { product: '$product', user: '$user' }, weight: { $sum: '$weight' } } }]),
    Product.distinct('_id'),
  ]);
  const existing = new Set(productIds.map(String));

  return buildRatingMatrix(
    cells
      .filter(({ _id }) => existing.has(String(_id.product)))
      .map(({ _id, weight }) => ({ product: _id.product, user: _id.user, weight })),
  );
};
