import mongoose from 'mongoose';

export const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
export const PAYMENT_METHODS = ['COD', 'CARD'];

// Forward-only fulfilment flow; any non-delivered order may additionally be cancelled.
export const NEXT_STATUS = { pending: 'processing', processing: 'shipped', shipped: 'delivered' };
export const CUSTOMER_CANCELLABLE = ['pending', 'processing'];

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    // name / image / price are snapshots taken from the catalogue at checkout time.
    name: { type: String, required: true },
    image: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, trim: true, default: 'India' },
  },
  { _id: false },
);

const paymentResultSchema = new mongoose.Schema(
  { status: { type: String, required: true }, reference: { type: String, required: true } },
  { _id: false },
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    note: { type: String, trim: true, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderItems: {
      type: [orderItemSchema],
      validate: { validator: (items) => items.length > 0, message: 'An order needs at least one item' },
    },
    shippingAddress: { type: shippingAddressSchema, required: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    paymentResult: { type: paymentResultSchema, default: null },
    itemsPrice: { type: Number, required: true, min: 0 },
    shippingPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date, default: null },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending', index: true },
    statusHistory: { type: [statusHistorySchema], default: [] },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        // A populated user that no longer exists comes back as null; keep the shape stable.
        if (ret.user === null) ret.user = { _id: null, name: 'Deleted user', email: '' };
        return ret;
      },
    },
  },
);

orderSchema.index({ createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);
export default Order;
