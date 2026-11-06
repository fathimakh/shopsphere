# RapidMiner output

Produced on 6 Nov 2026 by running the processes with RapidMiner Studio Core 9.7.0
([`../tools/core-runner`](../tools/core-runner)); details and cross-checks in [../VERIFICATION.md](../VERIFICATION.md).

| File | What it is |
|---|---|
| `product_similarity.csv` | output of `processes/product_similarity.rmp` on `data/rating-matrix.csv`: 849 rows `FIRST_ID, SECOND_ID, SIMILARITY` — the model imported into the store |
| `recommend_for_user-input.csv` | one seeded shopper's history (`user_id, product_id, weight`), fed to the input port of `processes/recommend_for_user.rmp` |
| `recommend_for_user-result.csv` | that process's result: the shopper's top 8 products (`score, product_id`) |
| `run-log.txt` | console output of both runs and the cross-check results |

Import the model into a store with **Admin → RapidMiner → Import RapidMiner output** or
`POST /api/analytics/import` (see [../README.md](../README.md)). It matches every freshly seeded store, because
the seed uses fixed ids; after the data changes, export a new `rating-matrix.csv` and run the process again.
