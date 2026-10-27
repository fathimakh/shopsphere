# Training data (export of the seeded store)

Exported from the API of a freshly seeded store (`npm run seed`) with an admin token:

| File | Endpoint | Content |
|---|---|---|
| `rating-matrix.csv` | `GET /api/analytics/export/rating-matrix.csv` | input of `processes/product_similarity.rmp`: one row per product (`product_id`), one column per shopper (`u_<userId>`), cell = view 1 + cart_add 3 + review 4 + purchase 5, capped at 10 |
| `interactions.csv` | `GET /api/analytics/export/interactions.csv` | the raw events in long format: `user_id, product_id, event, weight, timestamp` |
| `products.csv` | `GET /api/analytics/export/products.csv` | `product_id, name, category, brand, price, rating` — join it onto RapidMiner results to read product names |

The seed uses fixed ObjectIds for products and users, so these files (and any similarity model RapidMiner
builds from them) match every freshly seeded database, locally or on the deployed API. Export again from
the running store to include newer activity.
