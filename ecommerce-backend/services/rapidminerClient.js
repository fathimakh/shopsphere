import env from '../config/env.js';
import { isObjectIdString } from '../utils/strings.js';

/**
 * Client for live scoring on RapidMiner AI Hub (a deployed "real-time scoring" endpoint)
 * or on a small custom adapter in front of it. Only used when RAPIDMINER_SCORING_URL is set;
 * every failure is thrown so the recommendation engine can fall back to the next source.
 */

// Accepted column names in the scored rows (matched case-insensitively, first hit wins).
const PRODUCT_ID_KEYS = ['second_id', 'product_id', 'id', 'item'];
const SCORE_KEYS = ['score', 'similarity', 'confidence', 'prediction'];
// Optional: the shopper's item a row was derived from (FIRST_ID of a similarity table).
const SOURCE_ID_KEYS = ['first_id'];

export class RapidMinerError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RapidMinerError';
  }
}

export const isLiveScoringConfigured = () => Boolean(env.rapidminer.scoringUrl);

const authorizationHeader = () => {
  const { authToken, username, password } = env.rapidminer;
  if (authToken) return `Bearer ${authToken}`;
  if (username && password) return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  return undefined;
};

/**
 * Request body. It carries both conventions: `data` is the row list AI Hub's real-time
 * scoring deployments expect, `user_id` / `items` / `limit` suit a custom adapter.
 */
export const buildScoringRequest = ({ userId, items, limit }) => ({
  user_id: userId,
  limit,
  items: items.map(({ productId, weight }) => ({ product_id: productId, weight })),
  data: items.map(({ productId, weight }) => ({ user_id: userId, product_id: productId, weight })),
});

const pickValue = (row, keys) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return undefined;
};

/** Accepts a JSON array, { data: [...] }, { result: [...] } or { results: [...] }. */
const extractRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  const rows = ['data', 'results', 'result'].map((key) => payload?.[key]).find(Array.isArray);
  if (!rows) throw new RapidMinerError('unexpected response shape (expected an array of scored rows)');
  return rows;
};

/**
 * Normalises scored rows to { productId, score, sourceId? }. Rows without a valid product
 * id or a positive numeric score are dropped.
 */
export const normaliseScoredRows = (payload) =>
  extractRows(payload).flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const fields = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]));
    const productId = String(pickValue(fields, PRODUCT_ID_KEYS) ?? '').trim().toLowerCase();
    const score = Number(pickValue(fields, SCORE_KEYS));
    if (!isObjectIdString(productId) || !Number.isFinite(score) || score <= 0) return [];

    const sourceId = String(pickValue(fields, SOURCE_ID_KEYS) ?? '').trim().toLowerCase();
    return [{ productId, score, ...(isObjectIdString(sourceId) && { sourceId }) }];
  });

/**
 * Asks the live RapidMiner deployment to score products for a shopper.
 * `items` are the shopper's interactions as [{ productId, weight }].
 * Resolves to [{ productId, score, sourceId? }]; rejects on timeout, HTTP errors,
 * malformed JSON or an unexpected payload.
 */
export const fetchLiveScores = async ({ userId, items, limit }) => {
  const { scoringUrl, timeoutMs } = env.rapidminer;
  if (!scoringUrl) throw new RapidMinerError('RAPIDMINER_SCORING_URL is not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const authorization = authorizationHeader();

  try {
    const response = await fetch(scoringUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(authorization && { Authorization: authorization }),
      },
      body: JSON.stringify(buildScoringRequest({ userId, items, limit })),
      signal: controller.signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new RapidMinerError(`scoring endpoint responded with HTTP ${response.status}`);
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new RapidMinerError('scoring endpoint returned malformed JSON');
    }
    return normaliseScoredRows(payload);
  } catch (error) {
    if (error.name === 'AbortError') throw new RapidMinerError(`scoring endpoint timed out after ${timeoutMs} ms`);
    if (error instanceof RapidMinerError) throw error;
    throw new RapidMinerError(`scoring endpoint is unreachable (${error.cause?.code ?? error.message})`);
  } finally {
    clearTimeout(timer);
  }
};
