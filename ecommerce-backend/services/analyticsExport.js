import Interaction from '../models/interaction.js';
import Product from '../models/product.js';
import { toCsv } from './csv.js';
import { loadRatingMatrix } from './similarity.js';

/**
 * CSV exports consumed by the RapidMiner processes (formats: docs/API_CONTRACT.md §4).
 */

/** Wide product x user matrix: product_id,u_<userId>,... with capped implicit-feedback weights. */
export const buildRatingMatrixCsv = async () => {
  const { products, users, rows } = await loadRatingMatrix();
  const header = ['product_id', ...users.map((userId) => `u_${userId}`)];
  const lines = products.map((productId) => {
    const row = rows.get(productId);
    return [productId, ...users.map((userId) => row.get(userId) ?? 0)];
  });
  return toCsv(header, lines);
};

/** Long format, one row per recorded event, oldest first. */
export const buildInteractionsCsv = async () => {
  const interactions = await Interaction.find().sort({ createdAt: 1, _id: 1 }).lean();
  return toCsv(
    ['user_id', 'product_id', 'event', 'weight', 'timestamp'],
    interactions.map(({ user, product, event, weight, createdAt }) => [String(user), String(product), event, weight, createdAt]),
  );
};

/** Product attributes for joining names / categories onto RapidMiner results. */
export const buildProductsCsv = async () => {
  const products = await Product.find().select('name category brand price rating').sort({ _id: 1 }).lean();
  return toCsv(
    ['product_id', 'name', 'category', 'brand', 'price', 'rating'],
    products.map(({ _id, name, category, brand, price, rating }) => [String(_id), name, category, brand, price, rating]),
  );
};
