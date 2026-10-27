import { rateLimit } from 'express-rate-limit';
import env from '../config/env.js';

const WINDOW_MS = 15 * 60 * 1000;

/** Rate limiter that answers with the standard error envelope (contract §2). */
const createLimiter = (limit, message) =>
  rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res, _next, options) => {
      res.status(options.statusCode).json({ success: false, message, code: 'RATE_LIMITED' });
    },
  });

/** Brute-force protection for /api/auth: AUTH_RATE_LIMIT_MAX requests per 15 minutes per IP. */
export const authLimiter = createLimiter(
  env.authRateLimitMax,
  'Too many authentication attempts. Please try again in 15 minutes.',
);

/** Spam protection for the public contact form: 20 messages per 15 minutes per IP. */
export const contactLimiter = createLimiter(20, 'Too many messages sent. Please try again in 15 minutes.');
