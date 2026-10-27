import mongoose from 'mongoose';

/**
 * Item-item similarities imported from RapidMiner's "Similarity to Data" output.
 * One document per product holding its top neighbours, sorted by score (desc).
 */
const neighborSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    score: { type: Number, required: true },
  },
  { _id: false },
);

const productSimilaritySchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
    neighbors: { type: [neighborSchema], default: [] },
    source: { type: String, default: 'rapidminer' },
    batchId: { type: String, required: true, index: true },
    importedAt: { type: Date, required: true },
  },
  { versionKey: false },
);

const ProductSimilarity = mongoose.model('ProductSimilarity', productSimilaritySchema);
export default ProductSimilarity;
