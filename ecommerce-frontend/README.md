# ShopSphere web app — `ecommerce-frontend`

React single-page app of **ShopSphere**, a MERN e-commerce store (Entri FSD V8 · Module 5). Built with
**React 19 + Vite**, **React Router**, **Axios**, **Redux Toolkit** (cart and login state) and **Tailwind CSS**.
It consumes the ShopSphere API for authentication, products, orders, recommendations and the contact form.

> API: [`../ecommerce-backend`](../ecommerce-backend) · Project overview and screenshots: [`../README.md`](../README.md)

## Features

- **Catalogue** — product listing with search, category, price range, rating, in-stock filters, sorting and
  pagination. Every filter lives in the URL (`/?search=phone&category=smartphones&sort=price_asc&page=2`)
  and drives `GET /api/products`, so Back/Forward, refresh and shared links restore the same view.
- **Product detail** — gallery, price / MRP / discount, stock, quantity picker, add to cart / buy now,
  reviews with a review form, and **"You may also like"** recommendations.
- **RapidMiner recommendations** — "Recommended for you" (signed in) or "Trending now" (guests) on the home
  page, with a badge that says honestly where the list came from (RapidMiner AI Hub, RapidMiner model,
  collaborative filtering or trending) and a reason per product ("Because you viewed …").
- **Redux cart** — add, change quantity (bounded by stock), remove, totals with the free-shipping rule,
  persisted in `localStorage`, mirrored to the server and merged after login.
- **Checkout** — validated shipping address (prefilled from the profile), cash on delivery or simulated card
  payment, order placed through the API → order page with a status timeline; **My orders** with cancellation.
- **Login / Register / Logout** synchronised with the backend JWT flow; **protected routes**; automatic
  logout and redirect when the token expires or is rejected.
- **Contact form** with client-side validation (required fields, email format, length limits, character
  counter, accessible inline errors) and server-error mapping.
- **Profile** — details and address, password change, log out of all devices, account deletion.
- **Admin dashboard** (admin role only) — store KPIs, product CRUD, order status workflow, user roles,
  contact inbox, and the **RapidMiner panel** (export training data, import the RapidMiner model, preview).
- **Responsive** from 320 px phones to desktops (cards ↔ tables, filter drawer, mobile menu), keyboard and
  screen-reader friendly, loading skeletons, error states with retry, and a banner while a sleeping free-tier
  server wakes up.

## Folder structure

The folders and files from the assignment's recommended structure are all present with the same names
(marked ★); the rest are additions.

```
ecommerce-frontend/
├── index.html  vite.config.js  eslint.config.js  netlify.toml  vercel.json  public/_redirects
├── .env (not committed)  .env.example
├── package.json ★
└── src/
    ├── assets/ ★                   # logo.svg, placeholder-product.svg (image fallback)
    ├── components/
    │   ├── Navbar.jsx ★            # responsive header: links, search, cart badge, user menu, mobile menu
    │   ├── Footer.jsx ★
    │   ├── ProductCard.jsx ★       # product tile with add-to-cart
    │   ├── CartItem.jsx ★          # cart line with quantity stepper and remove
    │   ├── ProtectedRoute.jsx ★    # waits for token validation, redirects guests to /login, 403 for wrong role
    │   ├── AuthWatcher.jsx         # logs out when the JWT expires or the API rejects it → /login?expired=1
    │   ├── Recommendations.jsx     # recommendation rail + RecommendationSourceBadge.jsx
    │   ├── Filters.jsx, FilterDrawer.jsx, SearchBar.jsx, SortSelect.jsx, ActiveFilters.jsx, Pagination.jsx
    │   ├── ProductGallery.jsx, AddToCartPanel.jsx, QuantityStepper.jsx, ReviewForm.jsx, ReviewList.jsx …
    │   ├── OrderSummary.jsx, AddressForm.jsx, PaymentMethodPicker.jsx, OrderCard.jsx, OrderStatusTimeline.jsx
    │   ├── Loader.jsx, ErrorMessage.jsx, EmptyState.jsx, ConfirmDialog.jsx, ServerStatusBanner.jsx …
    │   └── admin/                  # admin tables, dialogs, product form, CSV export/import, charts
    ├── redux/
    │   ├── store.js ★              # configureStore, rehydration of auth + cart, listener middleware
    │   ├── slices/
    │   │   ├── authSlice.js ★      # user, token, status, initialized, session messages
    │   │   ├── productSlice.js ★   # catalogue list, current product, categories, recommendations, similar
    │   │   ├── cartSlice.js ★      # cart lines + memoised selectors (count, subtotal, shipping, total)
    │   │   └── orderSlice.js ★     # my orders, current order, order placement
    │   ├── thunks/
    │   │   ├── authThunks.js ★     # login, register, fetchCurrentUser (/auth/me), logout, profile, password
    │   │   ├── productThunks.js ★  # fetchProducts, fetchProductById, categories, recommendations, reviews
    │   │   ├── cartThunks.js ★     # addToCart (stock check + cart_add tracking), syncCart, mergeCartOnLogin
    │   │   ├── orderThunks.js ★    # placeOrder, fetchMyOrders, fetchOrderById, cancelOrder
    │   │   └── createApiThunk.js   # createAsyncThunk with a uniform error payload
    │   ├── listeners.js            # persistence, debounced server cart sync, post-login cart merge
    │   └── persistence.js          # safe localStorage read/write with shape checks
    ├── api/
    │   ├── axiosInstance.js ★      # Axios instance: VITE_API_URL, JWT header, 401 handling
    │   ├── apiErrors.js            # error → user-facing message / field errors
    │   └── serverStatus.js         # detects slow (sleeping) servers for the banner
    ├── hooks/                      # useProductQuery (URL ↔ filters), useDebounce, useValidatedForm,
    │                               # useDocumentTitle, useRedirectPath, useAdminResource, useAdminMutation
    ├── pages/
    │   ├── Home.jsx ★  ProductDetail.jsx ★  Cart.jsx ★  Orders.jsx ★  Contact.jsx ★  Login.jsx ★
    │   ├── Register.jsx  Checkout.jsx  OrderDetail.jsx  Profile.jsx  NotFound.jsx
    │   └── admin/                  # AdminLayout, Dashboard, Products, Orders, Users, Messages, Recommendations
    ├── utils/                      # constants, formatters (₹), validators, JWT decoding
    ├── App.jsx ★                   # layout + React Router routes (pages lazy-loaded)
    ├── main.jsx ★                  # Provider, BrowserRouter, Toaster, token validation on start
    └── index.css ★                 # Tailwind v4 theme tokens and component classes
```

## Setup

```bash
# The project was created as in the assignment:
#   npm create vite@latest ecommerce-frontend      (React, JavaScript)
#   npm i react-router-dom axios react-icons react-redux @reduxjs/toolkit
#   npm i tailwindcss @tailwindcss/vite react-hot-toast
cd ecommerce-frontend
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:5050/api
npm run dev                   # http://localhost:5175 (the API must be running)
```

| Script | Does |
|---|---|
| `npm run dev` | Vite dev server on port 5175 |
| `npm run build` | production build into `dist/` |
| `npm run preview` | serve the build on port 4173 |
| `npm run lint` | ESLint (React hooks rules) — clean |

### Environment variables

| Variable | Example | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:5050/api` · `https://shopsphere-api-iold.onrender.com/api` | API base URL **including** `/api`. Vite inlines it at build time, so set it on the hosting service before building. |

Only `.env.example` is committed. The API must list the frontend origin in its `CLIENT_URL` (CORS).

## Routes

| Path | Page | Access |
|---|---|---|
| `/` | Home: hero, recommendations, catalogue with filters | public |
| `/product/:id` | Product detail + "You may also like" | public |
| `/cart` | Cart | public |
| `/contact` | Contact form | public |
| `/login`, `/register` | Login / registration | guests (signed-in users are redirected) |
| `/checkout` | Checkout | signed in |
| `/orders`, `/orders/:id` | My orders / order detail | signed in |
| `/profile` | Profile | signed in |
| `/admin` (+ `/products`, `/orders`, `/users`, `/messages`, `/recommendations`) | Admin dashboard | **admin role** |
| `*` | 404 | public |

Protected routes wait until a restored token has been validated with `GET /auth/me`, send guests to `/login`
(and back afterwards), and show an "access denied" panel to signed-in users without the required role.
The API enforces the same rules, so hiding a page is never the only protection.

## State management (Redux Toolkit)

| Slice | State | Persisted |
|---|---|---|
| `auth` | `user`, `token`, `status`, `error`, `initialized`, `sessionMessage` | `localStorage.shopsphere_auth` |
| `cart` | `items: [{ productId, name, price, image, stock, quantity }]` | `localStorage.shopsphere_cart` |
| `products` | catalogue `list` + `pagination`, `current` product, `categories`, `recommendations` (+ `source`), `similar` | — |
| `orders` | `mine`, `current`, `placing` | — |

- **Thunks** (`createAsyncThunk`) call the API through the shared Axios instance; every slice tracks
  `idle / loading / succeeded / failed` and an error that the pages display. Requests superseded by a newer
  one (e.g. typing in the search box) are aborted.
- **Listener middleware** keeps side effects out of components: it saves auth and cart to `localStorage`,
  mirrors the cart to `PUT /users/cart` (debounced 600 ms) for signed-in users, and merges the saved cart
  after login.
- **On start** the stored session is shape-checked, dropped if the JWT has expired, and confirmed with
  `GET /auth/me`; `AuthWatcher` logs the user out at the token's expiry time.
- **Selectors** (`createSelector`) derive cart count, subtotal, shipping (free from ₹999, otherwise ₹49 — the
  same rule as the server) and total.

## API layer (Axios)

`src/api/axiosInstance.js` creates one instance with `baseURL = import.meta.env.VITE_API_URL` and a 20 s
timeout.

- **Request interceptor** adds `Authorization: Bearer <token>` from the Redux store.
- **Response interceptor**: a 401 with `TOKEN_EXPIRED`, `TOKEN_INVALID`, `TOKEN_REVOKED` or `USER_NOT_FOUND`
  for a request that carried the current token dispatches `sessionExpired()`; `AuthWatcher` then shows a
  toast and redirects to `/login?expired=1`. A wrong password (`INVALID_CREDENTIALS`) never logs anyone out.
- `getErrorMessage()` turns network errors, timeouts ("the server may be waking up"), validation errors and
  server messages into readable text; `getFieldErrors()` maps server field errors onto form inputs.

## Deployment

The build is a static site (`dist/`) with client-side routing, so every host needs an "all paths →
`index.html`" rule — included for each option:

| Host | Config | Settings |
|---|---|---|
| **Netlify** | [`netlify.toml`](netlify.toml), [`public/_redirects`](public/_redirects) | base directory `ecommerce-frontend`, build `npm run build`, publish `dist`, env `VITE_API_URL` |
| **Vercel** | [`vercel.json`](vercel.json) | root directory `ecommerce-frontend`, framework Vite, env `VITE_API_URL` |
| **Render** (static site) | [`../render.yaml`](../render.yaml) | blueprint deploys API + site together; set `VITE_API_URL` |

After deploying, add the site's URL to the API's `CLIENT_URL` and redeploy the API.
