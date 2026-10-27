#!/usr/bin/env python3
"""
Reference values for rapidminer/processes/product_similarity.rmp (Python 3 stdlib only).

Reads a rating matrix in the API's export format (product_id, u_<userId>, ...) and writes the
item-item cosine similarities in the import format (FIRST_ID, SECOND_ID, SIMILARITY): the top 20
neighbours per product, similarity > 0, the product itself excluded, strongest pairs first.

These numbers are computed with Python to check RapidMiner's output (and the API's built-in
engine, see tests/recoSimilarity.test.js). They are NOT RapidMiner output.

Usage: python3 -I compute_expected.py [rating-matrix.csv] [expected_similarity.csv]
"""
import csv
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TOP_K = 20


def read_matrix(path):
    with open(path, newline='', encoding='utf-8-sig') as fh:
        rows = list(csv.reader(fh))
    return {row[0]: [float(value) for value in row[1:]] for row in rows[1:] if row}


def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norm if norm else 0.0


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'rating-matrix.csv')
    target = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'expected_similarity.csv')
    matrix = read_matrix(source)

    pairs = []
    for first, vector in matrix.items():
        neighbours = [(second, cosine(vector, other)) for second, other in matrix.items() if second != first]
        neighbours = sorted((n for n in neighbours if n[1] > 0), key=lambda n: (-n[1], n[0]))[:TOP_K]
        pairs += [(first, second, score) for second, score in neighbours]
    pairs.sort(key=lambda pair: (-pair[2], pair[0], pair[1]))

    with open(target, 'w', newline='', encoding='utf-8') as fh:
        writer = csv.writer(fh, lineterminator='\n')
        writer.writerow(['FIRST_ID', 'SECOND_ID', 'SIMILARITY'])
        writer.writerows([first, second, f'{score:.6f}'] for first, second, score in pairs)
    print(f'{len(matrix)} products -> {len(pairs)} similarity pairs written to {os.path.relpath(target)}')


if __name__ == '__main__':
    main()
