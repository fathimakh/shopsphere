import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import User from '../models/user.js';
import ApiError from '../utils/ApiError.js';
import { isObjectIdString } from '../utils/strings.js';

/** Reads "Authorization: Bearer <jwt>"; returns null when absent or malformed. */
const extractToken = (req) => {
  const [scheme, token] = (req.headers.authorization || '').trim().split(/\s+/);
  return /^Bearer$/i.test(scheme || '') && token ? token : null;
};

/**
 * Verifies the JWT and loads its user. Every failure is a 401 with a specific code
 * that the frontend's axios interceptor uses to end the session cleanly.
 */
const resolveUser = async (token) => {
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Your session has expired. Please log in again.', 'TOKEN_EXPIRED');
    }
    throw ApiError.unauthorized('Invalid authentication token', 'TOKEN_INVALID');
  }

  if (!isObjectIdString(payload.id) || typeof payload.tv !== 'number') {
    throw ApiError.unauthorized('Invalid authentication token', 'TOKEN_INVALID');
  }

  const user = await User.findById(payload.id).select('+tokenVersion');
  if (!user) throw ApiError.unauthorized('The account for this session no longer exists', 'USER_NOT_FOUND');
  if (payload.tv !== user.tokenVersion) {
    throw ApiError.unauthorized('This session was signed out. Please log in again.', 'TOKEN_REVOKED');
  }
  return user;
};

/** Requires a valid token; sets req.user (Mongoose document, password excluded). */
export const protect = async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Not authorized, no token provided', 'NO_TOKEN');
  req.user = await resolveUser(token);
  next();
};

/** Attaches req.user when a valid token is sent; guests and stale tokens continue anonymously. */
export const optionalAuth = async (req, _res, next) => {
  const token = extractToken(req);
  if (token) {
    try {
      req.user = await resolveUser(token);
    } catch {
      req.user = undefined;
    }
  }
  next();
};

/** Role-based access control. Use after protect: authorize('admin'). */
export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) throw ApiError.unauthorized('Not authorized, no token provided', 'NO_TOKEN');
    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden(`Access denied: this action requires the ${roles.join(' or ')} role`);
    }
    next();
  };
