import Interaction, { EVENT_WEIGHTS } from '../models/interaction.js';

// Browsing signals repeated by the same user within this window count once, so refreshing
// a product page (or re-reviewing) does not inflate the implicit-feedback matrix.
const DEDUPE_WINDOW_MS = 30 * 60 * 1000;
const DEDUPED_EVENTS = new Set(['view', 'cart_add', 'review']);

/**
 * Records one implicit-feedback event (view / cart_add / review / purchase) with its weight.
 * Resolves to the created document, or null when the event was de-duplicated.
 */
export const recordInteraction = async ({ userId, productId, event }) => {
  if (DEDUPED_EVENTS.has(event)) {
    const recent = await Interaction.exists({
      user: userId,
      product: productId,
      event,
      createdAt: { $gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
    });
    if (recent) return null;
  }
  return Interaction.create({ user: userId, product: productId, event, weight: EVENT_WEIGHTS[event] });
};

/**
 * One purchase event per ordered product. Purchases are never de-duplicated: buying the same
 * product again in a later order is a real, stronger signal (the matrix cell is capped anyway).
 */
export const recordPurchases = (userId, productIds) =>
  Interaction.insertMany(
    productIds.map((productId) => ({ user: userId, product: productId, event: 'purchase', weight: EVENT_WEIGHTS.purchase })),
  );

/**
 * Fire-and-forget wrapper for request handlers: tracking is a side effect and must never
 * fail or slow down the response the shopper is waiting for.
 */
export const trackSafely = (params) => {
  recordInteraction(params).catch((error) => console.warn(`[interactions] could not record ${params.event}:`, error.message));
};
