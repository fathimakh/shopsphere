# RapidMiner recommendation system

ShopSphere's product recommendations ("Recommended for you" on the home page, "You may also like" on
every product page) come from an **item-based collaborative-filtering model built in RapidMiner**
(RapidMiner Studio / Altair AI Studio). The API exports the shoppers' behaviour as CSV, a RapidMiner process turns it into
product-to-product similarities, and the result is imported back into the store, which then serves
recommendations from it. A live mode calls a RapidMiner model deployed on Altair AI Hub on every request.

```
rapidminer/
├── processes/
│   ├── product_similarity.rmp   # batch model: rating matrix -> cosine item similarities (FIRST_ID, SECOND_ID, SIMILARITY)
│   └── recommend_for_user.rmp   # AI Hub web service: a shopper's history -> top-N products (product_id, score)
├── data/                        # real export of the seeded store (input of product_similarity.rmp)
│   ├── rating-matrix.csv  interactions.csv  products.csv
├── sample-data/                 # tiny hand-checkable example + Python reference values
│   ├── rating-matrix.csv  expected_similarity.csv  compute_expected.py  history.csv
├── output/                      # RapidMiner output: product_similarity.csv (the model), recommend_for_user result, run-log.txt
├── tools/
│   ├── core-runner/             # runs the .rmp files with RapidMiner Studio Core 9.7.0 (no GUI, no account)
│   └── validate_processes.py    # static checker for the .rmp files
├── VERIFICATION.md              # how the processes were run and checked
└── README.md
```

## 1. How the recommender works

**Implicit feedback.** Every shopper action is stored in the `interactions` collection with a weight:

| Event | Recorded when | Weight |
|---|---|---|
| `view` | a signed-in shopper opens a product page | 1 |
| `cart_add` | a signed-in shopper adds a product to the cart | 3 |
| `review` | a shopper reviews a product | 4 |
| `purchase` | an order is placed | 5 |

Views, cart adds and reviews repeated within 30 minutes count once. For each (product, shopper) pair the
weights are summed and capped at 10: that is the **rating matrix** (one row per product, one column per
shopper).

**Item-based collaborative filtering.** Two products are similar when the same shoppers engage with them.
RapidMiner computes the cosine similarity between product rows:

```
sim(i, j) = (r_i · r_j) / (|r_i| |r_j|)
```

and keeps the 20 most similar products for every product.

**Personal recommendations.** For a shopper `u` with history weights `w(u, i)` the API scores every other
product `j` as `score(u, j) = Σ_i w(u, i) · sim(i, j)`, removes products the shopper already bought,
normalises the scores to 0–1 and explains the strongest contribution ("Because you viewed …"). Short lists
are topped up with popular products from the shopper's favourite categories.

```mermaid
flowchart LR
    A[Shopper actions<br/>view · cart_add · review · purchase] --> B[(MongoDB<br/>interactions)]
    B -->|GET /api/analytics/export/rating-matrix.csv<br/>Admin → RapidMiner → Download| C[rating-matrix.csv]
    C --> D[RapidMiner / Altair AI Studio<br/>product_similarity.rmp<br/>Cross Distances · Cosine]
    D --> E[product_similarity.csv<br/>FIRST_ID, SECOND_ID, SIMILARITY]
    E -->|POST /api/analytics/import<br/>Admin → RapidMiner → Upload| F[(MongoDB<br/>productsimilarities)]
    F --> G[GET /api/analytics/recommendations<br/>GET /api/analytics/recommendations/product/:id]
    G --> H[React UI<br/>Recommended for you · You may also like]
    D -. deploy recommend_for_user.rmp .-> I[Altair AI Hub<br/>web service]
    I -. RAPIDMINER_SCORING_URL .-> G
```

## 2. Run the RapidMiner process (Altair AI Studio)

1. **Install Altair AI Studio** (the successor of RapidMiner Studio; free licence with an Altair One
   account): <https://altair.com/altair-ai-studio>. RapidMiner Studio 9.x / 10.x opens the files too.
2. **Get the input.** Either use the committed export [`data/rating-matrix.csv`](data/rating-matrix.csv)
   (it matches every freshly seeded store, because the seed uses fixed ids), or download a fresh one:
   - in the app: sign in as `admin@shopsphere.dev` / `Admin@123` → **Admin → RapidMiner** → *rating-matrix.csv*;
   - or with curl:
     ```bash
     API=http://localhost:5050/api      # deployed: https://<your-api>.onrender.com/api
     TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
       -d '{"email":"admin@shopsphere.dev","password":"Admin@123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
     curl -H "Authorization: Bearer $TOKEN" $API/analytics/export/rating-matrix.csv -o rapidminer/data/rating-matrix.csv
     ```
3. **Open the process:** *File → Import Process…* → `rapidminer/processes/product_similarity.rmp`.
4. **Set two paths** in *Process → Context → Macros* (or click the process background and use the
   *Context* panel): `input_file` = full path of `rating-matrix.csv`, `output_file` = full path of
   `rapidminer/output/product_similarity.csv`.
5. **Run** (F11). The Results view shows the similarity table, strongest pairs first, and the file is written.
6. **Import the model into the store:**
   - in the app: **Admin → RapidMiner → Import RapidMiner output** → choose `product_similarity.csv`;
   - or with curl:
     ```bash
     curl -X POST $API/analytics/import -H "Authorization: Bearer $TOKEN" \
       -H 'Content-Type: text/csv' --data-binary @rapidminer/output/product_similarity.csv
     # {"success":true,"batchId":"…","imported":849,"skipped":0,"products":53}
     ```
7. **See it in the UI.** The recommendation rails now carry the badge **"RapidMiner model"**, and
   `GET /api/analytics/status` reports `"activeSource": "rapidminer"`. *Admin → RapidMiner → Clear imported
   model* (`DELETE /api/analytics/import`) switches back to the built-in model.

Commit the generated `output/product_similarity.csv` as evidence of the run.

### What the process does

| # | Operator | Purpose |
|---|---|---|
| 1 | Read CSV | reads `rating-matrix.csv`; column types are guessed (`product_id` polynominal, `u_*` integer) |
| 2 | Set Role | `product_id` → *id*, so only the shopper columns form the product vectors |
| 3 | Multiply | the matrix is compared with itself |
| 4 | Cross Distances | *NumericalMeasures / CosineSimilarity*, *compute similarities*, *only top k* = 21, *search for* = farthest (= the 21 highest similarities, including the product itself) |
| 5 | Filter Examples | `request != document && distance > 0` drops self pairs and unrelated products |
| 6 | Rename | `request, document, distance` → `FIRST_ID, SECOND_ID, SIMILARITY` |
| 7 | Sort | strongest pairs first |
| 8 | Write CSV | `product_similarity.csv` (also shown in the Results view) |

### Without AI Studio: the RapidMiner engine from the command line

[`tools/core-runner/run.sh`](tools/core-runner/run.sh) runs the same process files with **RapidMiner Studio
Core 9.7.0**, the open-source engine of RapidMiner Studio (AGPL-3.0), downloaded from RapidMiner's Maven
repository. It needs Java 11+ and Maven, no Altair account. Macros are passed as `name=value`:

```bash
cd ecommerce-backend
R=$PWD/rapidminer
rapidminer/tools/core-runner/run.sh $R/processes/product_similarity.rmp \
  input_file=$R/data/rating-matrix.csv output_file=$R/output/product_similarity.csv
# Result example set: 849 rows, columns: FIRST_ID,SECOND_ID,SIMILARITY
```

The first run downloads the engine (about 110 MB) into `tools/core-runner/.work/` (git-ignored).
`--input=<csv>` feeds a CSV file to a process's input port (used for `recommend_for_user.rmp`),
`--result=<csv>` saves its result, and `RM_TRACE=1` prints the row count after every operator. Then import
the file as in step 6.

## 3. Live scoring with Altair AI Hub (optional)

`processes/recommend_for_user.rmp` scores one shopper in real time. Its input port receives the
shopper's history, it joins the history with `product_similarity.csv`, computes
`Σ weight × SIMILARITY` per candidate, removes products the shopper already knows and returns the top
`%{limit}` rows as `product_id, score`.

1. Run `product_similarity.rmp` first and upload `product_similarity.csv` to AI Hub next to the process
   (or point the `model_file` macro at its location).
2. Deploy `recommend_for_user.rmp` as a **real-time scoring / web service** deployment on AI Hub and
   copy its endpoint URL.
3. Configure the API (Render → Environment, or `.env`):
   ```
   RAPIDMINER_SCORING_URL=https://<ai-hub>/…/recommend_for_user   # the deployment's endpoint
   RAPIDMINER_AUTH_TOKEN=<token>        # or RAPIDMINER_USERNAME + RAPIDMINER_PASSWORD (basic auth)
   RAPIDMINER_TIMEOUT_MS=4000
   ```
4. For a signed-in shopper the API then POSTs
   ```json
   { "user_id": "…", "limit": 8,
     "items": [{ "product_id": "…", "weight": 5 }],
     "data":  [{ "user_id": "…", "product_id": "…", "weight": 5 }] }
   ```
   `data` is the row list AI Hub turns into the process's input example set; `items` suits a custom
   adapter. The response may be a JSON array or `{ "data": [...] }` with a product id
   (`product_id` / `SECOND_ID` / `id`) and a score (`score` / `SIMILARITY` / `confidence` / `prediction`).
   The badge then reads **"RapidMiner AI Hub"**.

The exact URL format and authentication depend on the AI Hub version and deployment type, so check the
deployment's test page once and adjust the env vars (see [VERIFICATION.md](VERIFICATION.md)).

## 4. Fallback chain — the site always shows recommendations

`services/recommendationEngine.js` tries the sources in order; every response says which one was used
(`source`), and the UI shows it as a badge:

| Order | Source (`source`) | Badge | Used when |
|---|---|---|---|
| 1 | `rapidminer-live` | RapidMiner AI Hub | `RAPIDMINER_SCORING_URL` is set and the call succeeds within the timeout |
| 2 | `rapidminer` | RapidMiner model | a RapidMiner `product_similarity.csv` has been imported |
| 3 | `builtin-cf` | Collaborative filtering | no RapidMiner model: the API computes **the same cosine similarity** in Node (cached, 5 min) |
| 4 | `popular` | Trending | guests and shoppers without history (sales, recent interest, rating) |

Lists are always filled to the requested length (popular products top them up), out-of-stock products are
skipped, and the endpoints never return an empty list while products exist.

## 5. Status — what was verified

- **RapidMiner run:** both processes were run with RapidMiner Studio Core 9.7.0 (`tools/core-runner`).
  `product_similarity.rmp` produced [`output/product_similarity.csv`](output/product_similarity.csv) (849
  pairs, 53 products) and `recommend_for_user.rmp` scored one shopper's history; both results match an
  independent Python calculation ([`output/run-log.txt`](output/run-log.txt)).
- **In the store:** the RapidMiner file was imported (`imported 849, skipped 0`), the API reports
  `activeSource: "rapidminer"` and the recommendation rails show the **RapidMiner model** badge.
- **Process files:** checked with `tools/validate_processes.py`, both against its operator tables and against
  the open-source RapidMiner Studio 9.7.0 code (`--studio-src`). Details: [VERIFICATION.md](VERIFICATION.md).
- **Math:** `sample-data/expected_similarity.csv` holds cosine similarities computed with Python
  (`compute_expected.py`) as reference values; the API test-suite checks that the built-in engine (the
  fallback) reproduces them to 6 decimals (`tests/recoSimilarity.test.js`).
- **Data formats:** export → import is covered by `tests/analytics.test.js`.
- **Not done:** opening the processes in the Altair AI Studio window (needs an Altair account) and an AI Hub
  deployment (section 3).

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| `product_id` read as a number | In Read CSV, open *Import Configuration Wizard* and set `product_id` to *polynominal* |
| "Attribute … is not numerical" in Cross Distances | a user column was read as text: set all `u_*` columns to *integer* in the wizard |
| Import says "unrecognised header" | the file must start with `FIRST_ID,SECOND_ID,SIMILARITY` (or `request,document,distance`, `product_id,similar_product_id,score`) |
| Import reports many `skipped` rows | the matrix came from another database: export again from the store you import into |
| Numbers with a decimal comma | set the operating system / Studio locale to use `.`; the importer also accepts `;`-separated files |
| Very large stores | lower *k* in Cross Distances; the API keeps at most 20 neighbours per product anyway |
