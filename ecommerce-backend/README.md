# ShopSphere API — `ecommerce-backend`

REST API of **ShopSphere**, a MERN e-commerce store (Entri FSD V8 · Module 5). Node.js + Express 5 +
MongoDB (Mongoose) with JWT authentication, bcryptjs password hashing, role-based access control
(admin / user), product filtering / sorting / search, orders with stock management, and a
**RapidMiner-based recommendation system**.

> Frontend: [`../ecommerce-frontend`](../ecommerce-frontend) · Project overview: [`../README.md`](../README.md) ·
> Full API contract: [`../docs/API_CONTRACT.md`](../docs/API_CONTRACT.md) · RapidMiner guide: [`rapidminer/README.md`](rapidminer/README.md)

## Tech stack

| Concern | Library |
|---|---|
| Server | Node.js ≥ 20 (22 recommended), **Express 5** (async errors reach the error handler without wrappers) |
| Database | **MongoDB** + **Mongoose 9** |
| Auth | **jsonwebtoken** (JWT, `Authorization: Bearer`), **bcryptjs** (10 salt rounds) |
| Config | **dotenv** (`config/env.js` validates and types every variable) |
| Security | **cors** (allow-list), **helmet**, **express-rate-limit** (auth + contact), NoSQL-injection sanitiser, request validation |
| Logging | **morgan** (development only) |
| Dev / test | **nodemon**, `node:test` + **supertest** (130 tests), **newman** (Postman, 145 assertions) |

## Folder structure

The folders and files from the assignment's recommended structure are all present with the same names
(marked ★); the rest are additions that keep controllers small and testable.

```
ecommerce-backend/
├── index.js ★                      # Express app: helmet, CORS allow-list, JSON body, sanitiser, routers, 404 + error handler; starts the server
├── config/
│   ├── dbConnection.js ★           # MongoDB connection (connectDB / disconnectDB / isDBConnected)
│   └── env.js                      # loads .env once and exposes typed settings
├── models/
│   ├── user.js ★                   # user schema: bcrypt pre-save hook, role (user|admin), address, saved cart, tokenVersion
│   ├── product.js ★                # product schema: slug, price/mrp, category, stock, embedded reviews, rating
│   ├── order.js ★                  # order schema: items snapshot, shipping, payment, status workflow, server-side pricing
│   ├── interaction.js              # implicit-feedback events (view / cart_add / review / purchase) for recommendations
│   ├── productSimilarity.js        # item-to-item neighbours imported from RapidMiner
│   └── contactMessage.js           # contact-form messages
├── controllers/
│   ├── authentication.js ★         # register, login, me, logout (JWT generation)
│   ├── userProfile.js ★            # profile CRUD, password change, saved cart, admin user management
│   ├── productController.js ★      # product CRUD, filtering, sorting, search, pagination, categories, reviews
│   ├── orderController.js ★        # order placement, my orders, cancel, admin status updates, tracking history
│   ├── analyticsController.js ★    # recommendations (RapidMiner integration), behaviour tracking, CSV export/import, dashboard
│   └── contactController.js        # contact form + admin inbox
├── routes/
│   ├── authenticationRoutes.js ★   # /api/auth
│   ├── userProfileRoutes.js ★      # /api/users
│   ├── productRoutes.js ★          # /api/products
│   ├── orderRoutes.js ★            # /api/orders
│   ├── analyticsRoutes.js ★        # /api/analytics
│   └── contactRoutes.js            # /api/contact
├── middleware/
│   ├── authMiddleware.js ★         # protect (JWT verification), optionalAuth, authorize(...roles) = RBAC
│   ├── errorHandler.js ★           # centralised error responses + 404 handler
│   ├── validateRequest.js          # body validation and ObjectId checks
│   ├── sanitize.js                 # strips "$" / "." keys (NoSQL injection)
│   └── rateLimiter.js              # brute-force protection for /api/auth and /api/contact
├── services/                       # recommendation engine, RapidMiner client, CSV export/import, interaction tracking
├── validators/                     # declarative validation rules per endpoint
├── utils/                          # ApiError, generateToken, query-string reader, string helpers
├── scripts/                        # seed.js (demo data), buildProductSnapshot.js, data/products.json
├── rapidminer/                     # RapidMiner processes (.rmp), training data, reference values, guide
├── postman/                        # Postman collection + environment + newman results
├── tests/                          # node:test + supertest integration tests
├── .env ★ (not committed)  .env.example  .gitignore ★  package.json ★  README.md ★
```

## Setup

Requirements: Node.js 20+ and MongoDB (local, Docker or MongoDB Atlas).

```bash
# The project was created as in the assignment:
#   mkdir ecommerce-backend && cd ecommerce-backend && npm init -y
#   npm i express mongoose dotenv cors bcryptjs jsonwebtoken
#   npm i -D nodemon
cd ecommerce-backend
npm install
cp .env.example .env          # then set JWT_SECRET (and MONGO_URI if not the local default)

# MongoDB in Docker, if you don't have one running:
docker run -d --name m5-mongo -p 27035:27017 mongo:7

npm run seed                  # demo catalogue, users, orders and behaviour data
npm run dev                   # http://localhost:5050  (nodemon)
```

Check it: `curl http://localhost:5050/api/health` → `{"success":true,"status":"ok","db":"connected",…}`.

### Demo accounts (created by `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@shopsphere.dev` | `Admin@123` |
| Shopper | `demo@shopsphere.dev` | `Demo@1234` |
| 15 synthetic shoppers | `<first>.<last>@example.com` (e.g. `aarav.sharma@example.com`) | `Shopper@123` |

The seed is deterministic: 60 products in 12 categories (from a committed dummyjson.com snapshot, prices in
INR), 31 orders in every status with consistent stock and sales, 25 verified reviews and ~300 behaviour events.
Seeded users and products have fixed ids, so the RapidMiner exports in `rapidminer/data/` stay valid.

## Environment variables

| Variable | Example | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | `production` on Render |
| `PORT` | `5050` | HTTP port (Render sets it automatically) |
| `MONGO_URI` | `mongodb://127.0.0.1:27035/shopsphere` | MongoDB / Atlas connection string |
| `JWT_SECRET` | long random string | signs the JWTs — **required**, the server refuses to start without it |
| `JWT_EXPIRES_IN` | `1d` | token lifetime |
| `CLIENT_URL` | `http://localhost:5175,http://localhost:4173` | comma-separated CORS allow-list (add the deployed frontend URL) |
| `AUTH_RATE_LIMIT_MAX` | `100` | requests per 15 min per IP on `/api/auth` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `admin@shopsphere.dev` / `Admin@123` | admin created by the seed |
| `RAPIDMINER_SCORING_URL` | *(empty)* | Altair AI Hub scoring endpoint; enables live RapidMiner scoring |
| `RAPIDMINER_AUTH_TOKEN` or `RAPIDMINER_USERNAME` + `RAPIDMINER_PASSWORD` | | AI Hub credentials (Bearer or Basic) |
| `RAPIDMINER_TIMEOUT_MS` | `4000` | live-scoring timeout before falling back |
| `RECO_CACHE_TTL_SECONDS` | `300` | cache lifetime of the built-in similarity model |

`.env` is git-ignored; [`.env.example`](.env.example) documents every variable.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | start with nodemon (restarts on changes) |
| `npm start` | start with node (production) |
| `npm run seed` | wipe and re-create the demo data |
| `npm test` | 130 integration/unit tests (`node:test` + supertest), each file on its own throw-away database |
| `npm run test:api` | run the Postman collection with newman (server must be running on a freshly seeded DB) |
| `npm run snapshot:products` | rebuild `scripts/data/products.json` from dummyjson.com (only needed to change the catalogue) |

## API reference

Base URL `http://localhost:5050/api`. Access: 🌐 public · 👤 logged-in user (`protect`) ·
🛡️ admin only (`protect` + `authorize('admin')`) · 🌓 optional login (personalised when a token is sent).

### Auth — `/api/auth`
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/register` | 🌐 | `{ name, email, password }` → 201 `{ token, user }` (role is always `user`; 409 for a used email) |
| POST | `/login` | 🌐 | `{ email, password }` → `{ token, user }` · 401 `INVALID_CREDENTIALS` |
| GET | `/me` | 👤 | current user — the frontend validates a stored token with it |
| POST | `/logout` | 👤 | `{ allDevices?: true }` revokes every token of the account |

### Users & profiles — `/api/users`
| Method | Path | Access | Description |
|---|---|---|---|
| GET / PUT / DELETE | `/profile` | 👤 | read / update (name, email, phone, address) / delete own account (password required) |
| PUT | `/profile/password` | 👤 | `{ currentPassword, newPassword }` → new token; older tokens are revoked |
| GET / PUT | `/cart` | 👤 | saved cart (mirrors the Redux cart); unknown products dropped, quantities clamped to stock |
| GET | `/` | 🛡️ | list users (`search`, `role`, `page`, `limit`) |
| GET / PUT / DELETE | `/:id` | 🛡️ | read / update (name, email, role) / delete a user — admins cannot demote or delete themselves |

### Products — `/api/products`
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/` | 🌐 | list with filtering, sorting, search and pagination (query below) |
| GET | `/categories` | 🌐 | `[{ name, count }]` |
| GET | `/:id` | 🌓 | product with reviews; records a `view` for signed-in shoppers |
| POST | `/` | 🛡️ | create (validated) |
| PUT | `/:id` | 🛡️ | partial update |
| DELETE | `/:id` | 🛡️ | delete (also removed from saved carts and behaviour data) |
| POST | `/:id/reviews` | 👤 | `{ rating 1-5, comment }` — one review per user, rating recalculated |

`GET /api/products` query parameters (all optional and combinable):

| Param | Example | Meaning |
|---|---|---|
| `search` | `apple watch` | every word must match name, description, brand, tags or category (case-insensitive, regex-escaped) |
| `category` | `smartphones,laptops` | one or more category slugs |
| `brand` | `Apple` | exact brand, case-insensitive |
| `minPrice` / `maxPrice` | `1000` / `50000` | price range in ₹ (inclusive) |
| `minRating` | `4` | 0–5 |
| `inStock` / `featured` | `true` | only products in stock / featured |
| `sort` | `newest` · `price_asc` · `price_desc` · `rating` · `popular` · `name_asc` | default `newest` |
| `page` / `limit` | `2` / `12` | pagination (limit ≤ 50) → `{ products, pagination: { page, limit, total, pages } }` |

Invalid values (e.g. `sort=cheapest`, `minPrice=abc`, `minPrice > maxPrice`) → 400 with field errors.

### Orders — `/api/orders`
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/` | 👤 | `{ items: [{ product, quantity }], shippingAddress, paymentMethod: "COD" \| "CARD" }` — prices come from the database, stock is reserved atomically (409 `Only N left of …`), card payment is simulated |
| GET | `/my` | 👤 | own orders, newest first |
| GET | `/:id` | 👤 | owner or admin (others 403) |
| PUT | `/:id/cancel` | 👤 | owner, while pending / processing — stock is restored |
| GET | `/` | 🛡️ | all orders (`status`, `page`, `limit`) with customer name and email |
| PUT | `/:id/status` | 🛡️ | `{ status, note? }`: pending → processing → shipped → delivered, or cancel; others 409 |
| DELETE | `/:id` | 🛡️ | delete (open orders restock) |

Shipping is free from ₹999, otherwise ₹49. Every status change is appended to `statusHistory`.

### Analytics & recommendations — `/api/analytics`
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/track` | 👤 | `{ productId, event: "view" \| "cart_add" }` behaviour signal |
| GET | `/recommendations` | 🌓 | personalised for a shopper, trending for guests (`limit` ≤ 24) |
| GET | `/recommendations/product/:id` | 🌐 | "You may also like" |
| GET | `/export/rating-matrix.csv` · `/export/interactions.csv` · `/export/products.csv` | 🛡️ | training data for RapidMiner |
| POST / DELETE | `/import` | 🛡️ | import RapidMiner's `product_similarity.csv` (raw `text/csv` or JSON `{ csv }`) / remove it |
| GET | `/status` | 🛡️ | active recommendation source, model sizes, interaction counts |
| GET | `/summary` | 🛡️ | admin dashboard totals, orders by status, low stock, top products, recent orders |

Recommendation responses: `{ source: "rapidminer-live" | "rapidminer" | "builtin-cf" | "popular", strategy, products: [{ …product, score, reason }] }`.

### Contact — `/api/contact`
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/` | 🌐 | `{ name, email, subject, message }` with validation (rate limited) |
| GET | `/` | 🛡️ | inbox (`status`) |
| PATCH / DELETE | `/:id` | 🛡️ | mark new / read / resolved, delete |

`GET /api/health` reports the API and database status; `GET /` describes the API.

## Authentication and role-based access control

- Passwords are hashed with **bcryptjs** in the user model's pre-save hook and never returned.
- Login / register return a **JWT** `{ id, role, tv }` signed with `JWT_SECRET` (expires after `JWT_EXPIRES_IN`).
- `protect` (in `middleware/authMiddleware.js`) verifies the token, loads the user and compares the token
  version, so a password change or "log out of all devices" revokes older tokens. Failures are 401 with a
  code the frontend reacts to: `NO_TOKEN`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, `TOKEN_REVOKED`, `USER_NOT_FOUND`.
- `authorize('admin')` implements RBAC using the role **stored in the database** (a forged role in a token
  has no effect); wrong role → 403 `FORBIDDEN`.

| Capability | Guest | User | Admin |
|---|:-:|:-:|:-:|
| Browse / search products, categories, similar products | ✔ | ✔ | ✔ |
| Personalised recommendations, reviews, profile, saved cart | | ✔ | ✔ |
| Place / view / cancel own orders | | ✔ | ✔ |
| Product CRUD, all orders + status updates, user management | | | ✔ |
| Contact inbox, RapidMiner export / import, dashboard | | | ✔ |

## Errors

Every error has the same shape, produced by `middleware/errorHandler.js`:

```json
{ "success": false, "message": "Validation failed", "code": "VALIDATION_ERROR",
  "errors": [{ "field": "email", "message": "Email is invalid" }] }
```

400 validation / malformed id / malformed JSON · 401 authentication · 403 role or ownership · 404 not found ·
409 conflicts (duplicate email, stock, status transition) · 429 rate limit · 500 unexpected (logged; stack only
in development).

## Recommendation system (RapidMiner)

Shopper behaviour (views, cart adds, reviews, purchases) is stored with weights and exported as a product ×
user rating matrix. The RapidMiner process `rapidminer/processes/product_similarity.rmp` computes cosine
item-to-item similarities; its output is imported back (`POST /api/analytics/import` or the admin panel) and
the API serves "Recommended for you" and "You may also like" from it. With `RAPIDMINER_SCORING_URL` set the
API instead calls a model deployed on Altair AI Hub (`recommend_for_user.rmp`) in real time. If neither is
available the API computes the same cosine model itself and finally falls back to popularity, so
recommendations never come back empty — the `source` field says which one was used.

Step-by-step guide, data formats and verification status: [`rapidminer/README.md`](rapidminer/README.md).

## Testing

```bash
npm test             # 130 tests: auth, RBAC, products, orders, users/cart, contact, security, CSV,
                     # cosine similarity (incl. agreement with the RapidMiner reference data),
                     # recommendation engine and the live RapidMiner client against a mock AI Hub server
npm run test:api     # Postman collection: 77 requests, 145 assertions (see postman/README.md)
```

Tests use separate databases (`shopsphere_test_<file>`) on the same MongoDB and clean up after themselves.

## Deployment (Render + MongoDB Atlas)

1. Create a free **MongoDB Atlas** cluster, a database user, allow access from `0.0.0.0/0`, and copy the
   connection string (`mongodb+srv://…/shopsphere?retryWrites=true&w=majority`).
2. On **Render**: *New → Blueprint* with this repository (it reads [`../render.yaml`](../render.yaml)), or a
   *Web Service* with root directory `ecommerce-backend`, build `npm ci`, start `npm start`, health check
   `/api/health`.
3. Environment: `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET` (generated), `CLIENT_URL` = the deployed
   frontend origin (e.g. `https://shopsphere-web.onrender.com`), optional `RAPIDMINER_*`.
4. Seed the Atlas database once from your machine: `MONGO_URI="<atlas uri>" npm run seed`.
5. Free Render services sleep when idle; the first request can take ~30–60 s (the frontend shows a
   "waking up the server" banner).
