# Postman collection

`ShopSphere.postman_collection.json` — **77 requests / 145 assertions** in 8 folders, run in order:

| Folder | What it checks |
|---|---|
| 0. Setup | health check, admin + demo shopper login, picks two products |
| 1. Auth | register (role forced to `user`), duplicate email 409, field validation 400, wrong password 401 `INVALID_CREDENTIALS`, `/auth/me`, 401 `NO_TOKEN` / `TOKEN_INVALID`, logout |
| 2. Users & profile | profile read/update/validation, saved cart (clamped, unknown ids dropped), admin user list/search/get/update, shopper → 403, invalid id → 400 |
| 3. Products | listing, search, category + price filter with `price_asc` sort, rating + stock filter, invalid sort → 400, categories, 400/404 ids, admin create/update, shopper 403 / guest 401, validation, reviews |
| 4. Orders | server-side pricing (client price ignored), insufficient stock 409, validation, my orders, other shopper's order 403, admin list + status workflow, illegal transition 409, owner cancel + restock, double cancel 409 |
| 5. Analytics & RapidMiner | behaviour tracking, guest (trending) and personalised recommendations, similar products, CSV exports (admin only), RapidMiner output import → `source: "rapidminer"`, bad header 400, engine status, model removal, dashboard summary |
| 6. Contact | valid message 201, four field errors 400, admin inbox, mark resolved, delete, shopper 403 |
| 7. Cleanup | deletes the order, product and the registered shopper (whose token then answers 401 `USER_NOT_FOUND`); admin self-delete 409 |

## Run

```bash
npm run seed          # fresh demo data (admin, demo shopper, catalogue)
npm run dev           # API on http://localhost:5050
npm run test:api      # = newman run postman/ShopSphere.postman_collection.json -e postman/local.postman_environment.json
```

Or import both JSON files into Postman and use *Run collection*. Tokens and ids are passed between requests
through collection variables, the new shopper's email is unique per run, and everything created is removed
at the end, so the collection can be run repeatedly.

Last run: [`results/newman-summary.txt`](results/newman-summary.txt) — 77 requests, 145 assertions, 0 failures.
