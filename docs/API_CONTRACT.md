# ShopSphere — API & Integration Contract (single source of truth)

This document is the agreement between `ecommerce-backend/` (Node + Express + MongoDB),
`ecommerce-frontend/` (React + Vite + Redux Toolkit) and `ecommerce-backend/rapidminer/`.
If an implementation must deviate, update this file in the same commit.

Store name: **ShopSphere**. Currency: **INR** (prices are plain numbers in rupees, shown as `₹1,499`).

---

## 0. Repository layout (one Git repo: `Module-5/`)

```
Module-5/
├── README.md                    # project overview, live URLs, rubric map, setup
├── render.yaml                  # Render blueprint (API web service + static site)
├── docs/                        # API_CONTRACT.md, screenshots/, extra docs
├── e2e/                         # Playwright end-to-end tests (own package.json)
├── ecommerce-backend/           # exact PDF structure + extras listed below
└── ecommerce-frontend/          # exact PDF structure + extras listed below
```

### Backend (PDF files are mandatory, names exact)
```
ecommerce-backend/
├── index.js                         # Express app entry (exports app for tests; listens unless NODE_ENV=test)
├── config/dbConnection.js
├── models/user.js product.js order.js
│   (+ interaction.js, productSimilarity.js, contactMessage.js)
├── controllers/authentication.js userProfile.js productController.js orderController.js analyticsController.js
│   (+ contactController.js)
├── routes/authenticationRoutes.js userProfileRoutes.js productRoutes.js orderRoutes.js analyticsRoutes.js
│   (+ contactRoutes.js)
├── middleware/authMiddleware.js errorHandler.js   (+ validateRequest.js, sanitize.js as needed)
├── services/                        # recommendationEngine.js, rapidminerClient.js, csv.js, interactionService.js
├── validators/                      # request validation rules
├── utils/                           # ApiError.js, generateToken.js, etc.
├── scripts/seed.js, scripts/data/products.json
├── rapidminer/                      # RapidMiner processes + guide (owned by the RapidMiner author)
├── postman/ShopSphere.postman_collection.json, postman/local.postman_environment.json
├── tests/                           # node:test unit/integration tests
├── .env (gitignored) .env.example .gitignore package.json README.md
```

### Frontend (PDF files are mandatory, names exact)
```
ecommerce-frontend/src/
├── assets/
├── components/Navbar.jsx Footer.jsx ProductCard.jsx CartItem.jsx ProtectedRoute.jsx
│   (+ Recommendations.jsx, Filters.jsx, Pagination.jsx, Loader.jsx, ErrorMessage.jsx, AuthWatcher.jsx, admin/…)
├── redux/store.js
├── redux/slices/authSlice.js productSlice.js cartSlice.js orderSlice.js
├── redux/thunks/authThunks.js productThunks.js cartThunks.js orderThunks.js
├── api/axiosInstance.js
├── pages/Home.jsx ProductDetail.jsx Cart.jsx Orders.jsx Contact.jsx Login.jsx
│   (+ Register.jsx, Checkout.jsx, OrderDetail.jsx, Profile.jsx, NotFound.jsx, admin/AdminDashboard.jsx …)
├── App.jsx main.jsx index.css
```

---

## 1. Ports & environment variables

| Thing | Local value |
|---|---|
| MongoDB (Docker container `m5-mongo`) | `mongodb://127.0.0.1:27035/shopsphere` |
| API | `http://localhost:5050` (all routes under `/api`) |
| Vite dev server | `http://localhost:5175` (strictPort) |

### Backend `.env` (commit `.env.example`, never `.env`)
```
NODE_ENV=development
PORT=5050
MONGO_URI=mongodb://127.0.0.1:27035/shopsphere
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=1d
CLIENT_URL=http://localhost:5175,http://localhost:4173   # comma-separated CORS allow-list
AUTH_RATE_LIMIT_MAX=100                                   # requests / 15 min / IP on /api/auth
SEED_ADMIN_EMAIL=admin@shopsphere.dev
SEED_ADMIN_PASSWORD=Admin@123
# RapidMiner AI Hub / Server (optional — live scoring is used only when the URL is set)
RAPIDMINER_SCORING_URL=
RAPIDMINER_AUTH_TOKEN=
RAPIDMINER_USERNAME=
RAPIDMINER_PASSWORD=
RAPIDMINER_TIMEOUT_MS=4000
RECO_CACHE_TTL_SECONDS=300
```

### Frontend `.env` (commit `.env.example`)
```
VITE_API_URL=http://localhost:5050/api
```
`VITE_API_URL` **includes** the `/api` suffix. All frontend paths below are relative to it.

---

## 2. Conventions

* JSON everywhere. Auth header: `Authorization: Bearer <jwt>`.
* **Success** responses: `{ "success": true, ...payload }` (payload keys listed per endpoint).
* **Error** responses (always, via `middleware/errorHandler.js`):
  ```json
  { "success": false, "message": "Human readable message", "code": "OPTIONAL_CODE", "errors": [{ "field": "email", "message": "Email is invalid" }] }
  ```
  `errors` only for validation failures. Stack traces only when `NODE_ENV=development`.
* Status codes: 200 OK, 201 Created, 400 validation / bad id / bad query, 401 not authenticated,
  403 authenticated but wrong role / not owner, 404 not found, 409 conflict (duplicate email,
  insufficient stock, illegal status transition), 429 rate limited, 500 server error.
* **401 codes** (frontend interceptor depends on these): `NO_TOKEN`, `TOKEN_INVALID`, `TOKEN_EXPIRED`,
  `USER_NOT_FOUND`, `TOKEN_REVOKED` (password changed / logout-all), `INVALID_CREDENTIALS` (login only).
* **403 code**: `FORBIDDEN`.
* Invalid MongoDB ObjectId in a path → 400 `{ message: "Invalid <resource> id" }`.
* Pagination object everywhere: `{ "page": 1, "limit": 12, "total": 57, "pages": 5 }`.
* Request bodies are sanitised (keys starting with `$` or containing `.` are stripped). Unknown/forbidden
  fields (e.g. `role` on register, `price` on order items) are ignored — the server is authoritative.

### Public object shapes
**User** (never includes password/tokenVersion):
```json
{ "_id": "…", "name": "Asha Nair", "email": "asha@example.com", "role": "user",
  "phone": "+91 98765 43210",
  "address": { "street": "", "city": "", "state": "", "postalCode": "", "country": "India" },
  "createdAt": "…", "updatedAt": "…" }
```
**Product**:
```json
{ "_id": "…", "name": "…", "slug": "…", "description": "…", "price": 1499, "mrp": 1999,
  "category": "smartphones", "brand": "Apple", "images": ["https://…"], "thumbnail": "https://…",
  "stock": 25, "rating": 4.3, "numReviews": 12, "soldCount": 40, "tags": ["…"], "isFeatured": false,
  "reviews": [{ "_id": "…", "user": "…", "name": "Asha", "rating": 5, "comment": "…", "createdAt": "…" }],
  "createdAt": "…", "updatedAt": "…" }
```
List endpoints may omit `reviews` and `description` is kept (cards truncate it client-side).
Categories are lowercase slugs (e.g. `mens-shirts`); the UI prettifies them ("Mens Shirts").

**Order**:
```json
{ "_id": "…", "user": "…" | { "_id": "…", "name": "…", "email": "…" },
  "orderItems": [{ "product": "…", "name": "…", "image": "…", "price": 1499, "quantity": 2 }],
  "shippingAddress": { "fullName": "", "phone": "", "street": "", "city": "", "state": "", "postalCode": "", "country": "India" },
  "paymentMethod": "COD" | "CARD",
  "paymentResult": { "status": "simulated-success", "reference": "SIM-…" } | null,
  "itemsPrice": 2998, "shippingPrice": 0, "totalPrice": 2998,
  "isPaid": true, "paidAt": "…" | null,
  "status": "pending" | "processing" | "shipped" | "delivered" | "cancelled",
  "statusHistory": [{ "status": "pending", "note": "Order placed", "at": "…" }],
  "deliveredAt": null, "cancelledAt": null, "createdAt": "…", "updatedAt": "…" }
```
Pricing rule (server is authoritative, frontend shows the same estimate):
`shippingPrice = itemsPrice >= 999 ? 0 : 49`, `totalPrice = itemsPrice + shippingPrice`. No tax line.

---

## 3. Endpoints

Legend: 🌐 public · 👤 any logged-in user (`protect`) · 🛡️ admin only (`protect` + `authorize('admin')`) ·
🌓 optional auth (`optionalAuth`: attaches `req.user` if a valid token is sent, never fails).

### 3.1 Health
| Method | Path | Access | Response |
|---|---|---|---|
| GET | `/api/health` | 🌐 | `{ success, status: "ok", db: "connected"\|"disconnected", uptime, environment }` |

### 3.2 Auth — `routes/authenticationRoutes.js` → `controllers/authentication.js`
| Method | Path | Access | Body | Response |
|---|---|---|---|---|
| POST | `/api/auth/register` | 🌐 | `{ name, email, password }` | 201 `{ success, token, user }` |
| POST | `/api/auth/login` | 🌐 | `{ email, password }` | 200 `{ success, token, user }` · 401 `INVALID_CREDENTIALS` |
| GET | `/api/auth/me` | 👤 | – | `{ success, user }` |
| POST | `/api/auth/logout` | 👤 | `{ allDevices?: boolean }` | `{ success, message }` (allDevices bumps `tokenVersion`) |

Validation: name 2–50 chars; email valid (stored lowercase, trimmed); password ≥ 8 chars with at least one
letter and one number. Duplicate email → 409. New users always get `role: "user"`.
JWT payload: `{ id, role, tv }` (`tv` = user.tokenVersion), signed with `JWT_SECRET`, `expiresIn: JWT_EXPIRES_IN`.
`protect` verifies the token, loads the user, checks `tv === user.tokenVersion`, sets `req.user`.

### 3.3 User profiles — `routes/userProfileRoutes.js` → `controllers/userProfile.js` (mounted at `/api/users`)
| Method | Path | Access | Body | Response |
|---|---|---|---|---|
| GET | `/api/users/profile` | 👤 | – | `{ success, user }` |
| PUT | `/api/users/profile` | 👤 | `{ name?, email?, phone?, address? }` | `{ success, user }` |
| PUT | `/api/users/profile/password` | 👤 | `{ currentPassword, newPassword }` | `{ success, message, token }` (new token; old tokens revoked) |
| DELETE | `/api/users/profile` | 👤 | `{ password }` | `{ success, message }` |
| GET | `/api/users/cart` | 👤 | – | `{ success, cart: [{ product: <Product>, quantity }] }` |
| PUT | `/api/users/cart` | 👤 | `{ items: [{ product: "<id>", quantity }] }` | `{ success, cart }` — replaces the saved cart; unknown products dropped, quantity clamped to 1..stock |
| GET | `/api/users` | 🛡️ | query `search, role, page, limit` | `{ success, users, pagination }` |
| GET | `/api/users/:id` | 🛡️ | – | `{ success, user }` |
| PUT | `/api/users/:id` | 🛡️ | `{ name?, email?, role? }` | `{ success, user }` — admin cannot change own role |
| DELETE | `/api/users/:id` | 🛡️ | – | `{ success, message }` — admin cannot delete self |

### 3.4 Products — `routes/productRoutes.js` → `controllers/productController.js`
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/api/products` | 🌐 | filtering / sorting / search / pagination (below) → `{ success, products, pagination }` |
| GET | `/api/products/categories` | 🌐 | `{ success, categories: [{ name: "smartphones", count: 6 }] }` sorted by name |
| GET | `/api/products/:id` | 🌓 | `{ success, product }` (with reviews). If authenticated, records a `view` interaction |
| POST | `/api/products` | 🛡️ | create → 201 `{ success, product }` |
| PUT | `/api/products/:id` | 🛡️ | partial update → `{ success, product }` |
| DELETE | `/api/products/:id` | 🛡️ | `{ success, message }` |
| POST | `/api/products/:id/reviews` | 👤 | `{ rating: 1-5, comment }` → 201 `{ success, product }` (creates or updates the caller's review; recalculates rating/numReviews; records a `review` interaction) |

`GET /api/products` query parameters (all optional, combinable):
| Param | Meaning |
|---|---|
| `search` | case-insensitive match on name, description, brand, tags (regex-escaped) |
| `category` | one slug or comma-separated slugs |
| `brand` | exact brand (case-insensitive) |
| `minPrice`, `maxPrice` | numeric range (inclusive); non-numeric → 400 |
| `minRating` | 0–5 |
| `inStock` | `true` → only `stock > 0` |
| `featured` | `true` → only `isFeatured` |
| `sort` | `newest` (default) · `price_asc` · `price_desc` · `rating` · `popular` (soldCount) · `name_asc`; anything else → 400 |
| `page`, `limit` | defaults 1 / 12, `limit` max 50 |

Product create/update validation: name 2–120, description 10–2000, price ≥ 0, mrp ≥ price (optional),
category required (stored lowercase slug), stock integer ≥ 0, images = array of http(s) URLs (thumbnail defaults to images[0]).

### 3.5 Orders — `routes/orderRoutes.js` → `controllers/orderController.js`
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/api/orders` | 👤 | body `{ items: [{ product, quantity }], shippingAddress, paymentMethod: "COD"\|"CARD" }` → 201 `{ success, order }` |
| GET | `/api/orders/my` | 👤 | `{ success, orders }` newest first |
| GET | `/api/orders/:id` | 👤 | owner or admin, else 403 → `{ success, order }` |
| PUT | `/api/orders/:id/cancel` | 👤 | owner, only while `pending`/`processing` → `{ success, order }`, stock restored |
| GET | `/api/orders` | 🛡️ | query `status, page, limit` → `{ success, orders (user populated: name,email), pagination }` |
| PUT | `/api/orders/:id/status` | 🛡️ | `{ status, note? }` → `{ success, order }` |
| DELETE | `/api/orders/:id` | 🛡️ | `{ success, message }` |

Order creation: server loads each product, rejects unknown products (400) and insufficient stock (409
"Only N left of <name>"), copies name/image/price from the DB, computes prices, decrements stock
atomically (`findOneAndUpdate({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty, soldCount: qty } })`,
rolling back already-decremented items on failure), records `purchase` interactions, clears the user's
saved cart. `CARD` = simulated payment → `isPaid: true`, `paidAt`, `paymentResult`. `COD` → unpaid until delivered.
shippingAddress requires fullName, phone, street, city, state, postalCode (country defaults "India").
Status transitions (admin): pending→processing→shipped→delivered; any non-delivered → cancelled (restock).
Others → 409. Delivered sets `deliveredAt` (and `isPaid`/`paidAt` for COD). Every change appends `statusHistory`.

### 3.6 Analytics & recommendations — `routes/analyticsRoutes.js` → `controllers/analyticsController.js`
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/api/analytics/track` | 👤 | `{ productId, event: "view"\|"cart_add" }` → 201 `{ success }` (deduped: same user+product+event within 30 min is ignored but still 201) |
| GET | `/api/analytics/recommendations` | 🌓 | query `limit` (default 8, max 24) → recommendation payload (below) |
| GET | `/api/analytics/recommendations/product/:id` | 🌐 | "You may also like" — query `limit` (default 6) → recommendation payload |
| GET | `/api/analytics/export/rating-matrix.csv` | 🛡️ | CSV for RapidMiner (format §4) — `Content-Type: text/csv`, `Content-Disposition: attachment` |
| GET | `/api/analytics/export/interactions.csv` | 🛡️ | long-format CSV (format §4) |
| GET | `/api/analytics/export/products.csv` | 🛡️ | `product_id,name,category,brand,price,rating` |
| POST | `/api/analytics/import` | 🛡️ | RapidMiner scored output. Accepts `Content-Type: text/csv` raw body **or** JSON `{ csv: "<file text>" }` → `{ success, batchId, imported, skipped, products }` — replaces the previous import |
| DELETE | `/api/analytics/import` | 🛡️ | removes the imported model (engine falls back to built-in) → `{ success, message }` |
| GET | `/api/analytics/status` | 🛡️ | `{ success, activeSource, rapidminer: { liveConfigured, lastImport: { batchId, importedAt, pairs } \| null }, interactions: { total, byEvent }, builtin: { products, pairs, computedAt } }` |
| GET | `/api/analytics/summary` | 🛡️ | admin dashboard: `{ success, totals: { users, products, orders, revenue }, ordersByStatus: { pending: 3, … }, lowStock: [Product], topProducts: [{ product, soldCount }], recentOrders: [Order] }` |

**Recommendation payload**
```json
{ "success": true,
  "source": "rapidminer-live" | "rapidminer" | "builtin-cf" | "popular",
  "strategy": "personalized" | "similar-items" | "trending",
  "products": [ { ...Product, "score": 0.83, "reason": "Because you viewed Wireless Earbuds" } ],
  "generatedAt": "ISO date" }
```
Engine order of preference (see `services/recommendationEngine.js`):
1. **RapidMiner live** — if `RAPIDMINER_SCORING_URL` is set, POST to it (timeout `RAPIDMINER_TIMEOUT_MS`);
   on any failure log a warning and continue. Source `rapidminer-live`.
2. **RapidMiner imported model** — item-item similarities imported via `/api/analytics/import`. Source `rapidminer`.
3. **Built-in item-based collaborative filtering** — the same cosine similarity the RapidMiner process
   computes, calculated in Node from the interaction matrix and cached `RECO_CACHE_TTL_SECONDS`. Source `builtin-cf`.
4. **Popularity** (soldCount + weighted interactions + rating) — for guests / cold start, and to top up
   short lists. Source `popular` (strategy `trending`).
Personalized score: `score(p) = Σ_i w(user,i) · sim(i,p)` over the user's interacted items `i`, excluding
products the user already purchased; `reason` names the strongest contributing item. Results are normalised to 0–1,
out-of-stock products are skipped, and the list is always filled to `limit` (top-up with popular items in the user's
favourite categories, then global popular). The endpoints **never** return an empty list while products exist.

### 3.7 Contact — `routes/contactRoutes.js` → `controllers/contactController.js`
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/api/contact` | 🌓 | `{ name, email, subject, message }` → 201 `{ success, message: "Thanks …" }` — name 2–60, email valid, subject 3–120, message 10–2000 |
| GET | `/api/contact` | 🛡️ | `{ success, messages }` newest first (query `status`) |
| PATCH | `/api/contact/:id` | 🛡️ | `{ status: "new"\|"read"\|"resolved" }` → `{ success, contactMessage }` |
| DELETE | `/api/contact/:id` | 🛡️ | `{ success, message }` |

---

## 4. RapidMiner data formats

Implicit-feedback weights: `view = 1`, `cart_add = 3`, `review = 4`, `purchase = 5`.
Matrix cell value = sum of weights for that (product, user), capped at 10.

**`rating-matrix.csv`** (input of `rapidminer/processes/product_similarity.rmp`) — one row per product
that has at least one interaction, one column per user with at least one interaction, `0` when none:
```
product_id,u_665f1c…,u_665f1d…,…
665f2a…,5,0,3,…
```

**`interactions.csv`** (long format, for inspection / alternative processes):
```
user_id,product_id,event,weight,timestamp
```

**Scored output imported back** (`rapidminer/output/product_similarity.csv`, produced by RapidMiner's
*Similarity to Data* operator):
```
FIRST_ID,SECOND_ID,SIMILARITY
665f2a…,665f2b…,0.8165
```
The importer is case-insensitive on headers, also accepts `product_id,similar_product_id,score`, ignores rows
whose ids are unknown or whose score ≤ 0, stores both directions, and keeps the top 20 neighbours per product.

**Live AI Hub contract** (when `RAPIDMINER_SCORING_URL` is set): `POST` JSON
`{ "user_id": "…", "items": [{ "product_id": "…", "weight": 5 }], "limit": 8 }` with
`Authorization: Bearer $RAPIDMINER_AUTH_TOKEN` (or basic auth from username/password). The response may be a JSON
array or `{ data: [...] }` of rows with a product id (`product_id` | `SECOND_ID` | `id`) and a score
(`score` | `SIMILARITY` | `confidence`). Unknown ids are dropped.

---

## 5. Seed data (`npm run seed` in ecommerce-backend)

* ~60 products across ~12 categories from a committed snapshot `scripts/data/products.json` (built once from
  dummyjson.com; images hot-linked from `cdn.dummyjson.com`), prices converted to INR.
* Users: **admin** `admin@shopsphere.dev` / `Admin@123`; **demo shopper** `demo@shopsphere.dev` / `Demo@1234`;
  ~15 synthetic shoppers with category "personas" who generate views, cart adds, reviews and orders in assorted
  statuses, so the recommendation engine has real signal. The demo shopper has a few interactions + one order.
* `npm run seed` wipes and re-creates; `npm run seed -- --keep-users` style flags optional.

---

## 6. Frontend behaviour contract

* `src/api/axiosInstance.js`: `baseURL = import.meta.env.VITE_API_URL`, timeout 20 s; request interceptor adds
  the JWT from the Redux store; response interceptor: on **401** for a request that carried a token
  (codes `TOKEN_EXPIRED`, `TOKEN_INVALID`, `TOKEN_REVOKED`, `USER_NOT_FOUND`) → dispatch `sessionExpired()` (logout +
  message) and the app redirects to `/login?expired=1`. Exports a `getErrorMessage(err)` helper (network error /
  timeout / server message).
* Auth state persisted to `localStorage` (`shopsphere_auth`), cart to `localStorage` (`shopsphere_cart`);
  on app load the token is validated with `GET /auth/me`; the JWT `exp` is decoded client-side and the user is
  logged out automatically when it passes.
* Logged-in cart is mirrored to the server (`PUT /users/cart`, debounced) and merged with the server cart on login.
* Home = catalogue: search, category, price range, rating, in-stock and sort filters live in the **URL query
  string** (`/?search=phone&category=smartphones&sort=price_asc&page=2`) and drive `GET /products`.
* Routes: `/`, `/product/:id`, `/cart`, `/checkout`👤, `/orders`👤, `/orders/:id`👤, `/profile`👤, `/contact`,
  `/login`, `/register`, `/admin`🛡️ (+ `/admin/products`, `/admin/orders`, `/admin/users`, `/admin/messages`,
  `/admin/recommendations`), `*` 404.
