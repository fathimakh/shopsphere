import mongoose from 'mongoose';
import { slugify } from '../utils/strings.js';
import { URL_PATTERN } from '../validators/rules.js';

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true },
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [120, 'Name must be at most 120 characters'],
    },
    slug: { type: String, unique: true },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [2000, 'Description must be at most 2000 characters'],
    },
    price: { type: Number, required: [true, 'Price is required'], min: [0, 'Price cannot be negative'] },
    // Maximum retail price (the "was" price shown struck through); must not be below price.
    mrp: {
      type: Number,
      min: [0, 'MRP cannot be negative'],
      validate: {
        validator(value) {
          return value === null || value === undefined || value >= this.price;
        },
        message: 'MRP must be greater than or equal to price',
      },
    },
    // Lower-case slug such as "mens-shirts"; the UI prettifies it.
    category: { type: String, required: [true, 'Category is required'], set: slugify, index: true },
    brand: { type: String, trim: true, maxlength: 60, default: 'Generic' },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (images) => images.every((url) => URL_PATTERN.test(url)),
        message: 'Images must be http(s) URLs',
      },
    },
    thumbnail: { type: String, trim: true, default: '' },
    stock: {
      type: Number,
      required: [true, 'Stock is required'],
      min: [0, 'Stock cannot be negative'],
      validate: { validator: Number.isInteger, message: 'Stock must be a whole number' },
    },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    numReviews: { type: Number, min: 0, default: 0 },
    soldCount: { type: Number, min: 0, default: 0 },
    tags: { type: [{ type: String, trim: true, lowercase: true }], default: [] },
    isFeatured: { type: Boolean, default: false },
    reviews: { type: [reviewSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  },
);

productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ soldCount: -1 });
productSchema.index({ createdAt: -1 });

/** Picks a slug that no other product uses ("iphone-13-pro", then "iphone-13-pro-4k2f"). */
async function uniqueSlug(doc) {
  const base = slugify(doc.name) || 'product';
  let candidate = base;
  while (await doc.constructor.exists({ slug: candidate, _id: { $ne: doc._id } })) {
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return candidate;
}

productSchema.pre('validate', async function deriveFields() {
  // The thumbnail follows the first image unless one is given explicitly.
  if ((this.isModified('images') && !this.isModified('thumbnail')) || !this.thumbnail) {
    this.thumbnail = this.images[0] || '';
  }
  if (this.isModified('name') || !this.slug) this.slug = await uniqueSlug(this);
  // Re-check "mrp >= price" when only the price changes (validators run on modified paths only).
  if (this.isModified('price') && this.mrp != null) this.markModified('mrp');
});

/** Re-derives the average rating (1 decimal) and review count from the embedded reviews. */
productSchema.methods.recalculateRating = function recalculateRating() {
  this.numReviews = this.reviews.length;
  const total = this.reviews.reduce((sum, review) => sum + review.rating, 0);
  this.rating = this.numReviews ? Math.round((total / this.numReviews) * 10) / 10 : 0;
};

const Product = mongoose.model('Product', productSchema);
export default Product;
