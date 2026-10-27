import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { EMAIL_PATTERN } from '../validators/rules.js';

export const USER_ROLES = ['user', 'admin'];
const SALT_ROUNDS = 10;

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true, maxlength: 120, default: '' },
    city: { type: String, trim: true, maxlength: 60, default: '' },
    state: { type: String, trim: true, maxlength: 60, default: '' },
    postalCode: { type: String, trim: true, maxlength: 12, default: '' },
    country: { type: String, trim: true, maxlength: 60, default: 'India' },
  },
  { _id: false },
);

// Server-side copy of the shopping cart so it follows the user across devices.
const cartItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name must be at most 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [EMAIL_PATTERN, 'Email is invalid'],
    },
    // Never selected by default; bcrypt hash is written by the pre-save hook below.
    password: { type: String, required: [true, 'Password is required'], minlength: 8, select: false },
    role: { type: String, enum: USER_ROLES, default: 'user' },
    phone: { type: String, trim: true, maxlength: 20, default: '' },
    address: { type: addressSchema, default: () => ({}) },
    cart: { type: [cartItemSchema], default: [], select: false },
    // Bumped on password change / "log out everywhere" to invalidate older JWTs.
    tokenVersion: { type: Number, default: 0, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.tokenVersion;
        delete ret.cart;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Mongoose 9 middleware is promise based: no next() callback.
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(String(candidate), this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
