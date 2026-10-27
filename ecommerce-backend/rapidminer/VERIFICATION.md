# How the RapidMiner processes were verified

Altair AI Studio needs an Altair account to download, and it was not installed on the machine this
project was built on. The two `.rmp` files in [`processes/`](processes) were therefore **written by hand**
in the XML format RapidMiner saves, and checked as far as possible without running RapidMiner.

**Not executed yet:** neither process has been run in AI Studio. The first run is the real test — see
the checklist at the end.

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
required inputs are wired; every `%{macro}` is declared or predefined.

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

The cosine similarity itself was cross-checked independently: `sample-data/compute_expected.py`
(Python) and the API's built-in engine (`services/similarity.js`, test
`tests/recoSimilarity.test.js`) agree to 6 decimals on `sample-data/rating-matrix.csv`.

## Not verifiable from the open-source code

| Item | Why | What to check |
|---|---|---|
| Behaviour in Altair AI Studio 2024+ | only the 9.7 core is open source | Studio opens 9.7 processes at their compatibility level; accept any operator replacement it offers |
| AI Hub web-service URL, authentication and JSON envelope | Altair AI Hub is proprietary | use the URL / auth shown on the deployment's test page; the API accepts an array or `{ data: [...] }` |

## Checklist for the first run in AI Studio

1. Import `product_similarity.rmp`, set `input_file` = `rapidminer/data/rating-matrix.csv`,
   `output_file` = `rapidminer/output/product_similarity.csv`, run.
2. The result has three columns `FIRST_ID, SECOND_ID, SIMILARITY` with values in (0, 1] and no row where
   `FIRST_ID = SECOND_ID`. With the committed data expect about 849 rows for 53 products (ties at the top-k boundary can change the count slightly).
3. Spot-check: `python3 -I rapidminer/sample-data/compute_expected.py rapidminer/data/rating-matrix.csv /tmp/check.csv`
   computes the same table in Python — the similarities should match to about 6 decimals.
4. Import the file (Admin → RapidMiner, or `POST /api/analytics/import`): `imported` ≈ 849, `skipped` = 0.
5. Commit `output/product_similarity.csv`.
