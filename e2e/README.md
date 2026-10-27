# End-to-end smoke test

`smoke.mjs` drives one headless Chrome through the real application — React build, Express API and MongoDB —
and checks **43 behaviours**:

- guest catalogue: "Trending now" rail, product grid, search, category + sort from the URL, pagination,
  Back restoring filters;
- product detail with "You may also like" recommendations;
- Redux cart: add → navbar badge, quantity stepper, `localStorage` persistence, survives reload;
- checkout as a guest → login → back to checkout → order placed → order detail → cart emptied → My orders;
- "Recommended for you" with reasons and the recommendation-source badge;
- contact form: empty submit shows field errors, valid message is sent;
- RBAC and tokens: shopper on `/admin` sees "access denied", a tampered token logs the user out and
  redirects to `/login?expired=1`, logout clears the session, guests are redirected from `/orders`;
- every admin page (dashboard, products, orders, users, messages, RapidMiner) and the product form validation;
- no horizontal overflow at 375 px (phone) and 768 px (tablet) on home, cart, contact, login and admin pages.

Screenshots of every step are written to `e2e/output/` (gitignored); a selection is in
[`../docs/screenshots`](../docs/screenshots).

## Run

```bash
# 1. API with fresh demo data
cd ecommerce-backend && npm run seed && npm run dev
# 2. Frontend production build (port 4173 is in the API's CORS allow-list)
cd ecommerce-frontend && npm run build && npm run preview
# 3. Smoke test (uses the installed Google Chrome)
cd e2e && npm install && npm test
```

`E2E_BASE_URL` points it at another frontend (e.g. the deployed site); `E2E_BROWSER=chromium` uses
Playwright's own Chromium (`npx playwright install chromium`). The run places one order and sends one contact
message, so re-seed before running it again for identical results.

The API rate-limits `/api/auth` to `AUTH_RATE_LIMIT_MAX` requests per 15 minutes per IP (100 by default). After
several back-to-back runs, restart the API (the limiter is in memory) or raise the value in `.env`.
