import mongoose from 'mongoose';

/**
 * Implicit-feedback weights shared by the rating-matrix export (RapidMiner input) and the
 * built-in recommender. A (product, user) cell is the sum of weights, capped at MAX_CELL_WEIGHT.
 */
export const EVENT_WEIGHTS = Object.freeze({ view: 1, cart_add: 3, review: 4, purchase: 5 });
export const INTERACTION_EVENTS = Object.keys(EVENT_WEIGHTS);
export const MAX_CELL_WEIGHT = 10;

const interactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    event: { type: String, enum: INTERACTION_EVENTS, required: true },
    weight: { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

// Serves both the 30-minute de-duplication lookup and per-user history reads.
interactionSchema.index({ user: 1, product: 1, event: 1, createdAt: -1 });
// Serves the "recent engagement" window of the popularity ranking.
interactionSchema.index({ createdAt: -1 });

const Interaction = mongoose.model('Interaction', interactionSchema);
export default Interaction;
