/** Escapes user input so it can be embedded in a RegExp literally (prevents ReDoS / regex injection). */
export const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "Men's Check Shirt!" -> "mens-check-shirt" */
export const slugify = (value) =>
  String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** "mens-shirts" -> "Mens Shirts" (used in recommendation reasons). */
export const prettifySlug = (slug) =>
  String(slug)
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** True for a 24-character hexadecimal MongoDB ObjectId string. */
export const isObjectIdString = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);

/** Emails are stored trimmed and lower-cased, so every lookup must normalise the same way. */
export const normalizeEmail = (email) => String(email).trim().toLowerCase();
