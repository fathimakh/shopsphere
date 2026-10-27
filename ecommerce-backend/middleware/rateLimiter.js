import { rateLimit } from 'express-rate-limit';
import env from '../config/env.js';

/** Brute-force protection for /api/auth: AUTH_RATE_LIMIT_MAX requests per 15 minutes per IP. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.authRateLimitMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json({
      success: false,
      message: 'Too many authentication attempts. Please try again in 15 minutes.',
      code: 'RATE_LIMITED',
    });
  },
});
