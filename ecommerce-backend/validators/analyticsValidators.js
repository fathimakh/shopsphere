import { objectId, oneOf } from './rules.js';

// Clients may only report browsing signals; reviews and purchases are recorded server-side.
export const TRACKABLE_EVENTS = ['view', 'cart_add'];

export const trackRules = {
  productId: objectId({ label: 'Product id' }),
  event: oneOf({ label: 'Event', values: TRACKABLE_EVENTS }),
};
