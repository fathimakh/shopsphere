/**
 * Browser smoke test of the whole ShopSphere stack: React app + real API + MongoDB.
 *
 * Needs a freshly seeded API (npm run seed && npm run dev in ecommerce-backend) and the frontend
 * (npm run build && npm run preview in ecommerce-frontend, or npm run dev with E2E_BASE_URL).
 * Drives one headless Chrome through every page and flow, checks horizontal overflow on phone
 * and tablet widths, and saves screenshots to e2e/output/. Exit code 1 when a check fails.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const WEB = (process.env.E2E_BASE_URL || 'http://localhost:4173').replace(/\/$/, '');
const SHOTS = new URL('./output/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
// The tampered-token step makes the API answer 401 on purpose; the browser logs that as an error.
const EXPECTED_CONSOLE = /status of 401/;

const results = [];
const problems = [];
const check = (name, ok, detail = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) problems.push(name);
};

// Uses the installed Google Chrome; set E2E_BROWSER=chromium after "npx playwright install chromium" instead.
const browser = await chromium.launch(process.env.E2E_BROWSER === 'chromium' ? {} : { channel: 'chrome' });

const newPage = async (viewport) => {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !EXPECTED_CONSOLE.test(msg.text())) problems.push(`console: ${msg.text().slice(0, 160)}`);
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('response', (res) => { if (res.status() >= 500) problems.push(`HTTP ${res.status()} ${res.url()}`); });
  return { context, page };
};
const shot = (page, name, fullPage = false) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage });
const settle = (page) => page.waitForLoadState('networkidle').catch(() => {});

const login = async (page, email, password) => {
  await page.goto(`${WEB}/login`);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
  await settle(page);
};

// ---------------------------------------------------------------- desktop: guest
{
  const { context, page } = await newPage({ width: 1280, height: 800 });

  await page.goto(WEB);
  await settle(page);
  await page.getByRole('heading', { name: 'Trending now' }).waitFor();
  check('Home: guest sees "Trending now" rail', true);
  const cards = await page.locator('a[href^="/product/"]').count();
  check('Home: product grid rendered', cards >= 12, `${cards} product links`);
  await shot(page, 'desktop-home', true);

  // Search through the catalogue search box (URL-synced)
  await page.getByPlaceholder('Search products, brands and more').fill('watch');
  await page.waitForURL(/search=watch/);
  await settle(page);
  const searchText = await page.locator('main').innerText();
  check('Search: URL updated and results shown', /watch/i.test(searchText), page.url().replace(WEB, ''));
  await shot(page, 'desktop-search-watch');

  // Filters + sort via URL, then back button restores the previous filters
  await page.goto(`${WEB}/?category=smartphones&sort=price_asc`);
  await settle(page);
  const prices = await page.locator('main').innerText();
  check('Filter: category + sort from URL', /Smartphones/i.test(prices));
  await shot(page, 'desktop-filter-smartphones');
  await page.goto(`${WEB}/?page=2`);
  await settle(page);
  check('Pagination: page 2 loads', /page=2/.test(page.url()));
  await page.goBack();
  await settle(page);
  check('Back button restores filters', /category=smartphones/.test(page.url()));

  // Product detail + similar products
  await page.goto(WEB);
  await settle(page);
  const firstCard = page.locator('main a[href^="/product/"]').nth(8);
  const href = await firstCard.getAttribute('href');
  await page.goto(`${WEB}${href}`);
  await settle(page);
  await page.getByRole('heading', { name: 'You may also like' }).waitFor({ timeout: 10000 });
  check('Product detail: "You may also like" recommendations', true, href);
  await shot(page, 'desktop-product-detail', true);

  // Redux cart: add, badge, quantity, persistence
  await page.getByRole('button', { name: 'Add to cart' }).first().click();
  await page.getByRole('link', { name: /Cart, 1 item/ }).waitFor({ timeout: 10000 });
  check('Cart: navbar badge shows 1 item after add', true);
  await page.goto(`${WEB}/cart`);
  await settle(page);
  await page.getByRole('button', { name: /increase/i }).first().click();
  await page.getByRole('link', { name: /Cart, 2 items/ }).waitFor({ timeout: 5000 });
  check('Cart: quantity stepper updates Redux count', true);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('shopsphere_cart') || '[]'));
  check('Cart: persisted to localStorage', stored.length === 1 && stored[0].quantity === 2, JSON.stringify(stored.map((i) => i.quantity)));
  await page.reload();
  await settle(page);
  check('Cart: survives reload', await page.getByRole('link', { name: /Cart, 2 items/ }).isVisible());
  await shot(page, 'desktop-cart');

  // Guest checkout -> login -> back to checkout
  await page.getByRole('link', { name: /Log in to checkout|Proceed to checkout/ }).first().click();
  await page.waitForURL(/\/login/);
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  check('Checkout as guest redirects to login', true);
  await shot(page, 'desktop-login');
  await page.getByRole('button', { name: /Use demo shopper/i }).click();
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.waitForURL(/\/checkout/, { timeout: 15000 });
  await settle(page);
  check('Login redirects back to checkout', true);
  await shot(page, 'desktop-checkout', true);

  await page.getByRole('button', { name: /Place order/ }).click();
  await page.waitForURL(/\/orders\/[a-f0-9]{24}/, { timeout: 15000 });
  await settle(page);
  check('Place order -> order detail page', /placed=1/.test(page.url()), page.url().replace(WEB, ''));
  check('Cart emptied after order', await page.getByRole('link', { name: /Cart, 0 items/ }).isVisible());
  await shot(page, 'desktop-order-detail', true);

  await page.goto(`${WEB}/orders`);
  await settle(page);
  const ordersText = await page.locator('main').innerText();
  check('My orders lists orders', /pending/i.test(ordersText) && /delivered/i.test(ordersText));
  await shot(page, 'desktop-orders');

  // Personalised recommendations for the logged-in shopper
  await page.goto(WEB);
  await settle(page);
  await page.getByRole('heading', { name: 'Recommended for you' }).waitFor({ timeout: 10000 });
  const recoText = await page.locator('main').innerText();
  check('Home: "Recommended for you" with reasons', /Because you/i.test(recoText));
  check('Home: recommendation source badge', /Collaborative filtering|RapidMiner/i.test(recoText));
  await shot(page, 'desktop-home-recommended');

  // Contact form validation + success
  await page.goto(`${WEB}/contact`);
  await settle(page);
  await page.getByLabel('Your name').fill('');
  await page.getByLabel('Email').fill('');
  await page.getByRole('button', { name: 'Send message' }).click();
  const invalid = await page.locator('[aria-invalid="true"]').count();
  check('Contact: empty submit shows field errors', invalid >= 3, `${invalid} invalid fields`);
  await page.getByLabel('Email').fill('not-an-email');
  await page.getByLabel('Email').blur();
  await shot(page, 'desktop-contact-errors');
  await page.getByLabel('Your name').fill('Fathima K H');
  await page.getByLabel('Email').fill('fathima@example.com');
  await page.getByLabel('Subject').fill('Question about delivery');
  await page.getByLabel('Message').fill('Hello! How long does delivery to Kochi usually take?');
  await page.getByRole('button', { name: 'Send message' }).click();
  await page.getByText(/Thanks Fathima/).waitFor({ timeout: 10000 });
  check('Contact: valid message is sent', true);
  await shot(page, 'desktop-contact-success');

  // Non-admin on /admin -> 403 panel
  await page.goto(`${WEB}/admin`);
  await settle(page);
  check('Shopper on /admin sees access denied', /doesn.t have admin access/i.test(await page.locator('main').innerText()));
  await shot(page, 'desktop-admin-forbidden');

  // Invalid token -> session ends and protected page redirects to login
  await page.evaluate(() => {
    const auth = JSON.parse(localStorage.getItem('shopsphere_auth'));
    auth.token = `${auth.token.slice(0, -4)}abcd`;
    localStorage.setItem('shopsphere_auth', JSON.stringify(auth));
  });
  await page.goto(`${WEB}/orders`);
  await page.waitForURL(/\/login/, { timeout: 15000 });
  await settle(page);
  check('Tampered token -> logged out and sent to /login', true, page.url().replace(WEB, ''));
  await shot(page, 'desktop-session-expired');

  // Logout through the navbar
  await login(page, 'demo@shopsphere.dev', 'Demo@1234');
  await page.locator('header button[aria-expanded]').first().click();
  await page.getByRole('menuitem', { name: 'Log out' }).or(page.getByRole('button', { name: 'Log out' })).first().click();
  await page.getByRole('link', { name: 'Log in' }).first().waitFor({ timeout: 5000 });
  check('Logout clears the session', (await page.evaluate(() => localStorage.getItem('shopsphere_auth'))) === null);

  // Protected route as guest
  await page.goto(`${WEB}/orders`);
  await page.waitForURL(/\/login/);
  check('Guest on /orders is redirected to login', true);
  await context.close();
}

// ---------------------------------------------------------------- desktop: admin
{
  const { context, page } = await newPage({ width: 1280, height: 800 });
  await login(page, 'admin@shopsphere.dev', 'Admin@123');
  for (const [path, name, pattern] of [
    ['/admin', 'admin-dashboard', /Revenue/i],
    ['/admin/products', 'admin-products', /iPhone|Product/i],
    ['/admin/orders', 'admin-orders', /pending|processing/i],
    ['/admin/users', 'admin-users', /demo@shopsphere\.dev/i],
    ['/admin/messages', 'admin-messages', /Bulk order enquiry/i],
    ['/admin/recommendations', 'admin-rapidminer', /RapidMiner/i],
  ]) {
    await page.goto(`${WEB}${path}`);
    await settle(page);
    await page.waitForTimeout(400);
    check(`Admin page ${path}`, pattern.test(await page.locator('main').innerText()));
    await shot(page, `desktop-${name}`, true);
  }

  // Product create dialog validation
  await page.goto(`${WEB}/admin/products`);
  await settle(page);
  await page.getByRole('button', { name: /Add product|New product/i }).first().click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('dialog').getByRole('button', { name: /Create product|Save/i }).click();
  const dialogInvalid = await page.getByRole('dialog').locator('[aria-invalid="true"]').count();
  check('Admin: product form validates', dialogInvalid >= 3, `${dialogInvalid} invalid fields`);
  await shot(page, 'desktop-admin-product-form');
  await context.close();
}

// ---------------------------------------------------------------- mobile + tablet layouts
for (const [label, viewport] of [['mobile', { width: 375, height: 812 }], ['tablet', { width: 768, height: 1024 }]]) {
  const { context, page } = await newPage(viewport);
  await page.goto(WEB);
  await settle(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(`${label}: home has no horizontal overflow`, !overflow);
  await shot(page, `${label}-home`);
  await shot(page, `${label}-home-full`, true);

  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.waitForTimeout(300);
  await shot(page, `${label}-menu-open`);
  await page.getByRole('button', { name: 'Close menu' }).click();

  const href = await page.locator('main a[href^="/product/"]').nth(8).getAttribute('href');
  await page.goto(`${WEB}${href}`);
  await settle(page);
  await page.getByRole('button', { name: 'Add to cart' }).first().click();
  await page.waitForTimeout(800);
  await shot(page, `${label}-product-detail`, true);

  for (const path of ['/cart', '/contact', '/login']) {
    await page.goto(`${WEB}${path}`);
    await settle(page);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(`${label}: ${path} has no horizontal overflow`, !wide);
    await shot(page, `${label}-${path.slice(1)}`, true);
  }

  await login(page, 'admin@shopsphere.dev', 'Admin@123');
  for (const path of ['/admin', '/admin/orders']) {
    await page.goto(`${WEB}${path}`);
    await settle(page);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(`${label}: ${path} has no horizontal overflow`, !wide);
    await shot(page, `${label}${path.replaceAll('/', '-')}`, true);
  }
  await context.close();
}

await browser.close();
console.log(results.join('\n'));
const passed = results.filter((line) => line.startsWith('PASS')).length;
console.log(`\n${passed}/${results.length} checks passed, screenshots in e2e/output/`);
if (problems.length) {
  console.log(`\nPROBLEMS:\n${[...new Set(problems)].join('\n')}`);
  process.exitCode = 1;
}
