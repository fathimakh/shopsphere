# Sample data

A tiny, hand-checkable example in the exact formats the API uses.

| File | Purpose |
|---|---|
| `rating-matrix.csv` | 6 products × 5 shoppers in the export format — a quick input for `product_similarity.rmp` |
| `expected_similarity.csv` | cosine similarities for that matrix in the import format (`FIRST_ID, SECOND_ID, SIMILARITY`) |
| `compute_expected.py` | stdlib Python script that produced `expected_similarity.csv` (`python3 -I compute_expected.py [in.csv] [out.csv]`) |
| `history.csv` | a shopper history (`user_id, product_id, weight`) to test `recommend_for_user.rmp` in AI Studio |

`expected_similarity.csv` contains **reference values computed with Python** to check RapidMiner's output
and the API's built-in engine (`tests/recoSimilarity.test.js` asserts the built-in engine reproduces them).
It is **not RapidMiner output**.
