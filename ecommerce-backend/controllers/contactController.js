import ContactMessage, { CONTACT_STATUSES } from '../models/contactMessage.js';
import ApiError from '../utils/ApiError.js';
import { buildPagination, createQueryReader } from '../utils/queryReader.js';

const findMessageOr404 = async (id) => {
  const contactMessage = await ContactMessage.findById(id);
  if (!contactMessage) throw ApiError.notFound('Message not found');
  return contactMessage;
};

/** POST /api/contact — public contact form; links the message to the sender when logged in. */
export const submitContactMessage = async (req, res) => {
  const { name, email, subject, message } = req.body;
  await ContactMessage.create({ name, email, subject, message, user: req.user?._id ?? null });

  const firstName = name.trim().split(/\s+/)[0];
  res.status(201).json({
    success: true,
    message: `Thanks ${firstName}! Your message has been received and we'll reply within 1-2 business days.`,
  });
};

/** GET /api/contact (admin) — newest first; query: status, page, limit. */
export const listContactMessages = async (req, res) => {
  const query = createQueryReader(req.query);
  const status = query.oneOf('status', CONTACT_STATUSES);
  const { page, limit, skip } = query.pagination({ defaultLimit: 50, maxLimit: 100 });
  query.assertValid();

  const filter = status ? { status } : {};
  const [messages, total] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
    ContactMessage.countDocuments(filter),
  ]);
  res.json({ success: true, messages, pagination: buildPagination(page, limit, total) });
};

/** PATCH /api/contact/:id (admin) — { status: "new" | "read" | "resolved" } */
export const updateContactStatus = async (req, res) => {
  const contactMessage = await findMessageOr404(req.params.id);
  contactMessage.status = req.body.status;
  await contactMessage.save();
  res.json({ success: true, contactMessage });
};

/** DELETE /api/contact/:id (admin) */
export const deleteContactMessage = async (req, res) => {
  const contactMessage = await findMessageOr404(req.params.id);
  await contactMessage.deleteOne();
  res.json({ success: true, message: 'Message deleted' });
};
