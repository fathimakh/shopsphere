/**
 * Builds the committed product snapshot used by the seed (npm run snapshot:products).
 *
 * Fetches a curated set of products from dummyjson.com ONCE and writes
 * scripts/data/products.json. `npm run seed` only reads that file, so seeding is offline,
 * fast and reproducible. Images stay hot-linked from cdn.dummyjson.com.
 */
import { mkdir, writeFile } from 'node:fs/promises';

const API_BASE = 'https://dummyjson.com';
const OUTPUT_FILE = new URL('./data/products.json', import.meta.url);
const USD_TO_INR = 85;

// dummyjson category slug -> product ids to keep (60 products across 12 categories).
const CATALOGUE_PLAN = {
  smartphones: [123, 124, 126, 130, 132, 133],
  laptops: [78, 79, 80, 81, 82],
  tablets: [159, 160, 161],
  'mobile-accessories': [100, 101, 104, 105, 107, 108],
  'mens-watches': [93, 94, 95, 97, 98],
  'womens-bags': [172, 173, 174, 175, 176],
  fragrances: [6, 7, 8, 9, 10],
  'mens-shirts': [83, 84, 85, 86, 87],
  sunglasses: [154, 155, 156, 157, 158],
  'kitchen-accessories': [51, 52, 61, 65, 66],
  'home-decoration': [43, 44, 45, 46, 47],
  'sports-accessories': [140, 143, 144, 149, 152],
};

// Highlighted on the home page ("featured=true").
const FEATURED_IDS = new Set([123, 80, 160, 101, 95, 7, 173, 144]);

// A few dummyjson titles are truncated or awkward; everything else keeps its source title.
const NAME_OVERRIDES = {
  7: 'Chanel Coco Noir Eau de Parfum',
  9: 'Dolce Shine Eau de Parfum',
  10: 'Gucci Bloom Eau de Parfum',
  82: 'Dell XPS 13 9300 Laptop',
  84: 'Gigabyte Aorus Men T-Shirt',
  158: 'Classic Black Sunglasses',
};

const fetchJson = async (path) => {
  const response = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`GET ${path} failed with HTTP ${response.status}`);
  return response.json();
};

/** USD -> INR with retail-style endings: 849.15 -> 849, 46749.15 -> 46749 (always ...49 or ...99). */
const toInrPrice = (usd) => Math.max(49, Math.round((usd * USD_TO_INR) / 50) * 50 - 1);

/** MRP implied by the discount, rounded up to the next ...99; equals price when the discount is tiny. */
const toMrp = (price, discountPercentage) => {
  if (!(discountPercentage >= 3)) return price;
  const listPrice = price / (1 - discountPercentage / 100);
  return Math.max(price, Math.ceil(listPrice / 100) * 100 - 1);
};

/** Deterministic stock between 5 and 80 so every snapshot build gives the same numbers. */
const toStock = (sourceId) => 5 + ((sourceId * 37) % 76);

const toSnapshotProduct = (source) => {
  const price = toInrPrice(source.price);
  return {
    sourceId: source.id,
    name: NAME_OVERRIDES[source.id] ?? source.title.trim(),
    description: source.description.trim(),
    category: source.category,
    brand: source.brand?.trim() || 'Generic',
    price,
    mrp: toMrp(price, source.discountPercentage),
    stock: toStock(source.id),
    images: source.images,
    thumbnail: source.thumbnail,
    tags: [...new Set((source.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean))],
    isFeatured: FEATURED_IDS.has(source.id),
  };
};

const main = async () => {
  const available = new Set((await fetchJson('/products/categories')).map((category) => category.slug));
  const missingCategories = Object.keys(CATALOGUE_PLAN).filter((slug) => !available.has(slug));
  if (missingCategories.length) throw new Error(`Unknown dummyjson categories: ${missingCategories.join(', ')}`);

  const products = [];
  for (const [slug, ids] of Object.entries(CATALOGUE_PLAN)) {
    const { products: categoryProducts } = await fetchJson(`/products/category/${slug}?limit=0`);
    const byId = new Map(categoryProducts.map((product) => [product.id, product]));
    for (const id of ids) {
      if (!byId.has(id)) throw new Error(`Product ${id} not found in category ${slug}`);
      products.push(toSnapshotProduct(byId.get(id)));
    }
    console.log(`  ${slug.padEnd(20)} ${ids.length} products`);
  }

  const snapshot = {
    source: API_BASE,
    generatedAt: new Date().toISOString(),
    usdToInr: USD_TO_INR,
    count: products.length,
    products,
  };
  await mkdir(new URL('./data/', import.meta.url), { recursive: true });
  await writeFile(OUTPUT_FILE, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Wrote ${products.length} products across ${Object.keys(CATALOGUE_PLAN).length} categories to scripts/data/products.json`);
};

main().catch((error) => {
  console.error(`Snapshot failed: ${error.message}`);
  process.exit(1);
});
