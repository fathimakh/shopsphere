import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-secret-reco-similarity';

const { EVENT_WEIGHTS, MAX_CELL_WEIGHT } = await import('../models/interaction.js');
const { buildRatingMatrix, cosineNeighbours } = await import('../services/similarity.js');

const cell = (product, user, event) => ({ product, user, weight: EVENT_WEIGHTS[event] });

/*
 * Hand-checked example (users a-d, products W-Z). Matrix cells after summing and capping:
 *        a   b   c   d
 *   W   10   0   0   0     (purchase + purchase + cart_add = 13, capped at 10)
 *   X    1   1   1   1     |X|^2 = 4
 *   Y    3   0   4   0     |Y|^2 = 25
 *   Z    0   0   0   4     |Z|^2 = 16
 * sim(X,Y) = (3 + 4) / sqrt(4 * 25)  = 0.7     sim(X,Z) = 4 / sqrt(4 * 16)    = 0.5
 * sim(W,X) = 10 / sqrt(100 * 4)      = 0.5     sim(W,Y) = 30 / sqrt(100 * 25) = 0.6
 * sim(Y,Z) = sim(W,Z) = 0 (no shared user, so they are not neighbours)
 */
const CELLS = [
  cell('W', 'a', 'purchase'),
  cell('W', 'a', 'purchase'),
  cell('W', 'a', 'cart_add'),
  ...['a', 'b', 'c', 'd'].map((user) => cell('X', user, 'view')),
  cell('Y', 'a', 'cart_add'),
  cell('Y', 'c', 'review'),
  cell('Z', 'd', 'review'),
];

describe('buildRatingMatrix', () => {
  it('sums event weights per (product, user) and caps each cell', () => {
    const matrix = buildRatingMatrix(CELLS);

    assert.deepEqual(matrix.products, ['W', 'X', 'Y', 'Z']);
    assert.deepEqual(matrix.users, ['a', 'b', 'c', 'd']);
    assert.equal(MAX_CELL_WEIGHT, 10);
    assert.equal(matrix.rows.get('W').get('a'), 10);
    assert.equal(matrix.rows.get('Y').get('a'), 3);
    assert.equal(matrix.rows.get('Y').get('c'), 4);
    assert.equal(matrix.rows.get('Y').has('b'), false);
  });

  it('stringifies ids so ObjectIds and strings land in the same cell', () => {
    const matrix = buildRatingMatrix([
      { product: { toString: () => 'p1' }, user: 'u1', weight: 1 },
      { product: 'p1', user: { toString: () => 'u1' }, weight: 3 },
    ]);
    assert.equal(matrix.rows.get('p1').get('u1'), 4);
  });
});

describe('cosineNeighbours', () => {
  const neighbours = cosineNeighbours(buildRatingMatrix(CELLS));

  it('computes exact cosine similarities between product rows', () => {
    assert.deepEqual(neighbours.get('X'), [
      { product: 'Y', score: 0.7 },
      { product: 'W', score: 0.5 },
      { product: 'Z', score: 0.5 },
    ]);
    assert.deepEqual(neighbours.get('Y'), [
      { product: 'X', score: 0.7 },
      { product: 'W', score: 0.6 },
    ]);
    assert.deepEqual(neighbours.get('Z'), [{ product: 'X', score: 0.5 }]);
    assert.deepEqual(neighbours.get('W'), [
      { product: 'Y', score: 0.6 },
      { product: 'X', score: 0.5 },
    ]);
  });

  it('is symmetric and never lists a product as its own neighbour', () => {
    for (const [product, list] of neighbours) {
      for (const { product: other, score } of list) {
        assert.notEqual(other, product);
        assert.equal(neighbours.get(other).find((entry) => entry.product === product).score, score);
      }
    }
  });

  it('keeps only the top-K neighbours per product', () => {
    const top1 = cosineNeighbours(buildRatingMatrix(CELLS), { topK: 1 });
    assert.deepEqual(top1.get('X'), [{ product: 'Y', score: 0.7 }]);
  });

  it('returns no neighbours for products without shared users', () => {
    const isolated = cosineNeighbours(buildRatingMatrix([cell('A', 'u1', 'view'), cell('B', 'u2', 'view')]));
    assert.equal(isolated.size, 0);
  });
});
