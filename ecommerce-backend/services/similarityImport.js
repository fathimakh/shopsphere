import { randomUUID } from 'node:crypto';
import Product from '../models/product.js';
import ProductSimilarity from '../models/productSimilarity.js';
import ApiError from '../utils/ApiError.js';
import { CsvParseError, parseCsv } from './csv.js';
import { TOP_NEIGHBOURS } from './similarity.js';

/**
 * Import of RapidMiner's scored output (the item-item similarity table written by the
 * "Similarity to Data" operator) into the ProductSimilarity collection.
 */

// Accepted header names, matched case-insensitively: RapidMiner's own column names first.
// RapidMiner "Similarity to Data" names its columns FIRST_ID / SECOND_ID / SIMILARITY and
// "Cross Distances" request / document / distance (the distance holds the similarity when
// "compute similarities" is on), so un-renamed RapidMiner output imports as well.
const COLUMN_ALIASES = {
  first: ['first_id', 'product_id', 'request'],
  second: ['second_id', 'similar_product_id', 'document'],
  score: ['similarity', 'score', 'distance'],
};

const EXPECTED_HEADER = 'FIRST_ID,SECOND_ID,SIMILARITY (or product_id,similar_product_id,score)';

const resolveColumns = (header) => {
  const names = header.map((name) => name.trim().toLowerCase());
  const columns = Object.fromEntries(
    Object.entries(COLUMN_ALIASES).map(([column, aliases]) => [column, names.findIndex((name) => aliases.includes(name))]),
  );
  return Object.values(columns).every((index) => index >= 0) ? columns : null;
};

const parseRows = (csvText) => {
  try {
    return parseCsv(csvText);
  } catch (error) {
    if (error instanceof CsvParseError) throw ApiError.badRequest(`Could not read the CSV: ${error.message}`, { code: 'INVALID_CSV' });
    throw error;
  }
};

/**
 * Validates and stores a similarity table, replacing the previous import.
 * Rows with unknown product ids, self pairs or non-numeric / non-positive scores are skipped.
 * Both directions of every pair are stored and each product keeps its TOP_NEIGHBOURS best.
 * Resolves to { batchId, imported, skipped, products }.
 */
export const importSimilarityCsv = async (csvText) => {
  const [header, ...records] = parseRows(csvText);
  if (!header) throw ApiError.badRequest('The CSV file is empty', { code: 'INVALID_CSV' });

  const columns = resolveColumns(header);
  if (!columns) {
    throw ApiError.badRequest(`Unrecognised CSV header "${header.join(',')}". Expected ${EXPECTED_HEADER}.`, {
      code: 'INVALID_CSV_HEADER',
    });
  }

  const knownIds = new Set((await Product.distinct('_id')).map(String));
  const neighbours = new Map();
  const link = (from, to, score) => {
    if (!neighbours.has(from)) neighbours.set(from, new Map());
    const row = neighbours.get(from);
    row.set(to, Math.max(row.get(to) ?? 0, score));
  };

  let imported = 0;
  let skipped = 0;
  for (const record of records) {
    const first = (record[columns.first] ?? '').toLowerCase();
    const second = (record[columns.second] ?? '').toLowerCase();
    const rawScore = record[columns.score] ?? '';
    const score = rawScore === '' ? Number.NaN : Number(rawScore);

    if (!knownIds.has(first) || !knownIds.has(second) || first === second || !Number.isFinite(score) || score <= 0) {
      skipped += 1;
      continue;
    }
    link(first, second, score);
    link(second, first, score);
    imported += 1;
  }

  if (!imported) {
    throw ApiError.badRequest(
      `No valid similarity rows found (${skipped} row(s) skipped: unknown product ids, self pairs or scores ≤ 0).`,
      { code: 'NOTHING_IMPORTED' },
    );
  }

  const batchId = randomUUID();
  const importedAt = new Date();
  const operations = [...neighbours].map(([product, row]) => ({
    updateOne: {
      filter: { product },
      update: {
        $set: {
          neighbors: [...row]
            .map(([other, score]) => ({ product: other, score }))
            .sort((a, b) => b.score - a.score || a.product.localeCompare(b.product))
            .slice(0, TOP_NEIGHBOURS),
          source: 'rapidminer',
          batchId,
          importedAt,
        },
      },
      upsert: true,
    },
  }));

  // Each product's document is replaced in place first, then products that are no longer
  // part of the model are removed, so readers never see an empty model mid-import.
  await ProductSimilarity.bulkWrite(operations, { ordered: false });
  await ProductSimilarity.deleteMany({ batchId: { $ne: batchId } });

  return { batchId, imported, skipped, products: operations.length };
};

/** Removes the imported model; resolves to the number of product documents deleted. */
export const clearImportedSimilarities = async () => {
  const { deletedCount } = await ProductSimilarity.deleteMany({});
  return deletedCount;
};

/** Summary of the active import, or null when none exists. */
export const getImportInfo = async () => {
  const latest = await ProductSimilarity.findOne().sort({ importedAt: -1 }).select('batchId importedAt').lean();
  if (!latest) return null;

  const [totals] = await ProductSimilarity.aggregate([
    { $match: { batchId: latest.batchId } },
    { $group: { _id: null, products: { $sum: 1 }, pairs: { $sum: { $size: '$neighbors' } } } },
  ]);
  return { batchId: latest.batchId, importedAt: latest.importedAt, pairs: totals?.pairs ?? 0, products: totals?.products ?? 0 };
};

/** Imported neighbour lists for the given products: Map<productId, [{ product, score }]>. */
export const getImportedNeighbours = async (productIds) => {
  if (!productIds.length) return new Map();
  const documents = await ProductSimilarity.find({ product: { $in: productIds } }).select('product neighbors').lean();
  return new Map(
    documents.map(({ product, neighbors }) => [
      String(product),
      neighbors.map((neighbour) => ({ product: String(neighbour.product), score: neighbour.score })),
    ]),
  );
};
