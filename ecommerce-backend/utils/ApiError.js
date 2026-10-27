/**
 * An operational error with an HTTP status. Thrown anywhere in a request and turned
 * into the standard error payload by middleware/errorHandler.js:
 *   { success: false, message, code?, errors? }
 */
export default class ApiError extends Error {
  constructor(statusCode, message, { code, errors } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
  }

  static badRequest(message, options) {
    return new ApiError(400, message, options);
  }

  static validation(errors, message = 'Validation failed') {
    return new ApiError(400, message, { code: 'VALIDATION_ERROR', errors });
  }

  static unauthorized(message, code) {
    return new ApiError(401, message, { code });
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, message, { code: 'FORBIDDEN' });
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new ApiError(404, message, { code });
  }

  static conflict(message, code = 'CONFLICT') {
    return new ApiError(409, message, { code });
  }
}
