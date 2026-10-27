import mongoose from 'mongoose';
import { EMAIL_PATTERN } from '../validators/rules.js';

export const CONTACT_STATUSES = ['new', 'read', 'resolved'];

const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: { type: String, required: true, trim: true, lowercase: true, match: EMAIL_PATTERN },
    subject: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    message: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    status: { type: String, enum: CONTACT_STATUSES, default: 'new', index: true },
    // Set when the sender was logged in (POST /api/contact uses optionalAuth).
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
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

const ContactMessage = mongoose.model('ContactMessage', contactMessageSchema);
export default ContactMessage;
