import { URL_PATTERN, boolean, number, stringList, text } from './rules.js';

// Create uses these as-is; update runs them with { partial: true }.
// The cross-field rule "mrp >= price" lives in the Product schema so it also covers partial updates.
export const productRules = {
  name: text({ label: 'Name', min: 2, max: 120 }),
  description: text({ label: 'Description', min: 10, max: 2000 }),
  price: number({ label: 'Price', min: 0 }),
  mrp: number({ label: 'MRP', min: 0, required: false }),
  category: text({ label: 'Category', min: 2, max: 50 }),
  brand: text({ label: 'Brand', max: 60, required: false }),
  images: stringList({ label: 'Images', maxItems: 10, itemPattern: URL_PATTERN, itemMessage: 'must be an http(s) URL' }),
  thumbnail: text({
    label: 'Thumbnail',
    max: 500,
    required: false,
    pattern: URL_PATTERN,
    patternMessage: 'Thumbnail must be an http(s) URL',
  }),
  stock: number({ label: 'Stock', min: 0, integer: true }),
  tags: stringList({ label: 'Tags', maxItems: 20, itemMax: 30 }),
  isFeatured: boolean({ label: 'isFeatured' }),
};

export const reviewRules = {
  rating: number({ label: 'Rating', min: 1, max: 5, integer: true }),
  comment: text({ label: 'Comment', max: 1000, required: false }),
};
