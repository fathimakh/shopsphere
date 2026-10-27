// App-wide constants. Values that mirror backend rules reference docs/API_CONTRACT.md.

export const APP_NAME = 'ShopSphere'

/** Pricing rule (contract §2): free shipping from ₹999, otherwise a flat ₹49. */
export const FREE_SHIPPING_THRESHOLD = 999
export const SHIPPING_FEE = 49

export const PRODUCTS_PER_PAGE = 12

/** Most units of one product per order line (the API rejects order quantities above 100). */
export const MAX_QUANTITY_PER_ITEM = 100

/** Allowed `sort` values for GET /products, in the order shown in the UI. */
export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Best selling' },
  { value: 'rating', label: 'Top rated' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name_asc', label: 'Name: A–Z' },
]
export const DEFAULT_SORT = 'newest'

export const RATING_FILTERS = [4, 3, 2]

/** Order lifecycle (contract §3.5). */
export const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
export const ORDER_FLOW = ['pending', 'processing', 'shipped', 'delivered']
export const CANCELLABLE_STATUSES = ['pending', 'processing']

/** Status transitions an admin may apply: forward one step, or cancel anything not yet delivered. */
export const NEXT_ORDER_STATUSES = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
}

export const PAYMENT_METHODS = [
  {
    value: 'COD',
    label: 'Cash on delivery',
    description: 'Pay in cash or UPI when your order arrives.',
  },
  {
    value: 'CARD',
    label: 'Card (simulated)',
    description: 'Demo payment — the order is marked paid instantly, no card is charged.',
  },
]

export const CONTACT_STATUSES = ['new', 'read', 'resolved']

/**
 * Where a recommendation list came from (contract §3.6). The badge is deliberately honest:
 * it says whether RapidMiner scored the list or a fallback did.
 */
export const RECOMMENDATION_SOURCES = {
  'rapidminer-live': {
    label: 'RapidMiner AI Hub',
    description: 'Scored live by a RapidMiner AI Hub deployment.',
    tone: 'brand',
  },
  rapidminer: {
    label: 'RapidMiner model',
    description: 'Item-to-item similarities computed by our RapidMiner process and imported into the store.',
    tone: 'brand',
  },
  'builtin-cf': {
    label: 'Collaborative filtering',
    description: 'Cosine item-to-item similarity computed on our server — the same method as the RapidMiner process.',
    tone: 'sky',
  },
  popular: {
    label: 'Trending',
    description: 'Popular with shoppers right now (sales, interest and ratings).',
    tone: 'accent',
  },
}

/** Demo accounts seeded by the backend (contract §5) so evaluators can sign in quickly. */
export const DEMO_ACCOUNTS = [
  { label: 'Demo shopper', email: 'demo@shopsphere.dev', password: 'Demo@1234' },
  { label: 'Admin demo', email: 'admin@shopsphere.dev', password: 'Admin@123' },
]
