import ApiError from '../utils/ApiError.js';
import { isObjectIdString } from '../utils/strings.js';
import { validate } from '../validators/rules.js';

/**
 * Validates req.body against a rule map from validators/. With `partial: true` (updates)
 * only the fields that are present are checked, and at least one of them must be sent.
 */
export const validateBody =
  (rules, { partial = false } = {}) =>
  (req, _res, next) => {
    const errors = validate(req.body, rules, { partial });
    if (errors.length) throw ApiError.validation(errors);
    if (partial && !Object.keys(rules).some((key) => req.body?.[key] !== undefined)) {
      throw ApiError.badRequest(`Provide at least one of: ${Object.keys(rules).join(', ')}`, { code: 'NOTHING_TO_UPDATE' });
    }
    next();
  };

/**
 * router.param() handler that rejects malformed ObjectIds before any DB access,
 * e.g. GET /api/products/abc -> 400 { message: "Invalid product id" }.
 */
export const validateObjectIdParam = (resource) => (_req, _res, next, value) => {
  if (!isObjectIdString(value)) {
    next(ApiError.badRequest(`Invalid ${resource} id`, { code: 'INVALID_ID' }));
    return;
  }
  next();
};
