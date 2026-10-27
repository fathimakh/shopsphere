import mongoose from 'mongoose';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

/** Catch-all for unknown routes (mounted after every router). */
export const notFound = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
};

const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

/** Maps library errors (Mongoose, MongoDB, JWT, body-parser) onto ApiError; null = unexpected. */
const toApiError = (err) => {
  if (err instanceof ApiError) return err;

  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((detail) => ({
      field: detail.path,
      message: detail.name === 'CastError' ? `${capitalize(detail.path)} has an invalid value` : detail.message,
    }));
    return ApiError.validation(errors);
  }
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for ${err.path}`, { code: 'INVALID_ID' });
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0] || 'Value';
    return ApiError.conflict(`${capitalize(field)} already exists`, 'DUPLICATE_KEY');
  }

  if (err?.name === 'TokenExpiredError') return ApiError.unauthorized('Your session has expired', 'TOKEN_EXPIRED');
  if (err?.name === 'JsonWebTokenError' || err?.name === 'NotBeforeError') {
    return ApiError.unauthorized('Invalid authentication token', 'TOKEN_INVALID');
  }

  // body-parser errors
  if (err?.type === 'entity.parse.failed') {
    return ApiError.badRequest('Malformed JSON in request body', { code: 'INVALID_JSON' });
  }
  if (err?.type === 'entity.too.large') {
    return new ApiError(413, 'Request body is too large', { code: 'PAYLOAD_TOO_LARGE' });
  }
  if (err?.status >= 400 && err?.status < 500 && err?.expose) {
    return new ApiError(err.status, err.message, { code: 'BAD_REQUEST' });
  }
  return null;
};

/** Centralised error responder: { success: false, message, code?, errors? }. */
// eslint-disable-next-line no-unused-vars -- Express recognises error handlers by their 4 arguments.
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const apiError = toApiError(err);
  const status = apiError?.statusCode ?? 500;
  const body = {
    success: false,
    message: apiError?.message ?? 'Something went wrong on our side. Please try again later.',
  };
  body.code = apiError?.code ?? 'SERVER_ERROR';
  if (apiError?.errors?.length) body.errors = apiError.errors;

  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    if (env.nodeEnv === 'development') body.stack = err?.stack;
  }
  res.status(status).json(body);
};
