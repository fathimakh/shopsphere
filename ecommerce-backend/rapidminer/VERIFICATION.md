# How the RapidMiner processes were verified

The two `.rmp` files in [`processes/`](processes) were written by hand in the XML format RapidMiner saves
(Altair AI Studio needs an Altair account, which was not available while the project was built), checked
statically, and then **run with RapidMiner Studio Core 9.7.0** — the open-source engine of RapidMiner
Studio (AGPL-3.0) — headless, through [`tools/core-runner/run.sh`](tools/core-runner). Both processes ran
successfully; their output is committed in [`output/`](output) together with the console log.

## Run with RapidMiner (6 Nov 2026)

```bash
cd ecommerce-backend
R=$PWD/rapidminer
rapidminer/tools/core-runner/run.sh $R/processes/product_similarity.rmp \
  input_file=$R/data/rating-matrix.csv output_file=$R/output/product_similarity.csv
rapidminer/tools/core-runner/run.sh $R/processes/recommend_for_user.rmp \
  model_file=$R/output/product_similarity.csv limit=8 \
  --input=$R/output/recommend_for_user-input.csv --result=$R/output/recommend_for_user-result.csv
```

| Process | Input | RapidMiner result | Independent check |
|---|---|---|---|
| `product_similarity.rmp` | `data/rating-matrix.csv` (53 products × 16 shoppers) | `output/product_similarity.csv`: **849 rows** `FIRST_ID, SECOND_ID, SIMILARITY`, no self pairs, values in (0, 1] | `sample-data/compute_expected.py` on the same matrix: the same 849 pairs, largest difference 5.0e-07 (Python rounds to 6 decimals) |
| `recommend_for_user.rmp` | one seeded shopper's history (11 products, `output/recommend_for_user-input.csv`) on its input port, as AI Hub would pass it | `output/recommend_for_user-result.csv`: top 8 `score, product_id`, products already in the history removed | Σ weight × SIMILARITY recomputed in Python from `product_similarity.csv`: same 8 products in the same order, largest difference 4.4e-16 |

Console output: [`output/run-log.txt`](output/run-log.txt).

**Imported into the store:** `POST /api/analytics/import` with `product_similarity.csv` →
`{"imported":849,"skipped":0,"products":53}`; `GET /api/analytics/status` then reports
`"activeSource": "rapidminer"`, and "Recommended for you" / "You may also like" carry the **RapidMiner model**
badge ([screenshot](../../docs/screenshots/02-home-recommended-for-you.jpg),
[admin panel](../../docs/screenshots/21-admin-rapidminer.jpg)). API tests (130) and the browser smoke test
(43 checks) pass with the imported model.

The processes were run in the RapidMiner engine, not in the Altair AI Studio window. AI Studio opens the same
files (they are saved at compatibility level 9.7.000) — see [README.md](README.md) section 2.

## Automated checks

```bash
python3 -I rapidminer/tools/validate_processes.py
# with a checkout of https://github.com/rapidminer/rapidminer-studio (open-source core, release 9.7.0):
python3 -I rapidminer/tools/validate_processes.py --studio-src /path/to/rapidminer-studio
```

Last result (RapidMiner Studio source at commit `7124551`, "Release RapidMiner 9.7.0"):

```
Operator tables vs RapidMiner Studio source (21 operators): OK
rapidminer/processes/product_similarity.rmp: 8 operators, 9 connections - OK
rapidminer/processes/recommend_for_user.rmp: 11 operators, 13 connections - OK
```

The checker verifies: well-formed XML with `<process version>` and `<context><macros>`; every operator key
exists in `OperatorsCore.xml` and maps to the expected Java class; every parameter / list key and every
category value (measure, sort direction, role, …) is a literal in the operator's class hierarchy; every
port exists (including port extenders such as `output 2`, `result 1`), no input is wired twice and
required inputs are wired; every `%{macro}` is declared or predefined; operator names are unique in the
whole process; no macro sits inside a quoted string of an expression.

The last two checks were added after the first real run of the module's sister project (Module 4) found
exactly those two mistakes, which the earlier checks had passed: RapidMiner renames a duplicate operator name
on load (dropping its connections), and since version 6.5 the expression parser reads `%{name}` itself and
leaves `"%{name}"` inside quotes untouched (`parameter/ParameterTypeExpression.java`, `substituteMacros`).
Neither occurs in this module's processes.

## Behaviour confirmed in the RapidMiner source

Paths relative to `src/main/java/com/rapidminer/`.

| Assumption | Where it is confirmed |
|---|---|
| Read CSV with an **empty** `data_set_meta_data_information` list re-reads the column layout from the file and guesses the value types at run time — needed because the number of `u_*` columns changes with every export | `operator/nio/model/AbstractDataResultSetReader.java` (`transformDataResultSet`: `configuration.isComplete()` false → `reconfigure` + `guessValueTypes`); `DataResultSetTranslationConfiguration.isComplete()` |
| Cross Distances names its output columns `request`, `document`, `distance` and keeps the id attribute's value type | `operator/similarity/CrossDistancesOperator.java` (lines creating the `request` / `document` / `distance` attributes) |
| With *compute similarities*, `search_for = farthest` keeps the **k highest** similarities (the bounded queue keeps the k smallest values, and similarities are stored negated) | `CrossDistancesOperator.java`, `tools/math/container/BoundedPriorityQueue.java` |
| `CosineSimilarity` is the numerical measure key | `tools/math/similarity/DistanceMeasures.java` |
| Filter Examples' expression compares nominal values as strings (`request != document`) | `example/set/ConditionedExampleSet.java`, expression parser |
| Set Minus compares the **id** attributes of both inputs (hence the two Set Role operators) | `operator/preprocessing/join/ExampleSetMinus.java` |
| Aggregate names its result `sum(weighted)` | `operator/preprocessing/transformation/aggregation/AggregationOperator.java` |
| Filter Example Range with `last_example` larger than the data returns everything | `operator/preprocessing/filter/ExampleRangeFilter.java` |

All of these were confirmed again by the run above.

The cosine similarity itself was cross-checked independently: `sample-data/compute_expected.py`
(Python) and the API's built-in engine (`services/similarity.js`, test
`tests/recoSimilarity.test.js`) agree to 6 decimals on `sample-data/rating-matrix.csv`.

## Not verified

| Item | Why | What to check |
|---|---|---|
| Opening the processes in the Altair AI Studio window | AI Studio needs an Altair account | Studio opens 9.7 processes at their compatibility level; accept any operator replacement it offers |
| AI Hub web-service URL, authentication and JSON envelope | Altair AI Hub is proprietary | use the URL / auth shown on the deployment's test page; the API accepts an array or `{ data: [...] }` |
