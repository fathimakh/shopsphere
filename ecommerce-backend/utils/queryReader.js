import ApiError from './ApiError.js';

/**
 * Defensive reader for req.query.
 *
 * Express 5 parses query strings with the "simple" parser: every value is a string, or
 * an array of strings when a key is repeated (?category=a&category=b). req.query is a
 * getter that re-parses on each access, so it is only read here, never mutated.
 * Problems are collected as field-level errors and raised together by assertValid().
 */
export const createQueryReader = (query = {}) => {
  const errors = [];
  const raw = (key) => {
    const value = query[key];
    const first = Array.isArray(value) ? value.find((item) => String(item).trim() !== '') : value;
    if (first === undefined || first === null) return undefined;
    const trimmed = String(first).trim();
    return trimmed === '' ? undefined : trimmed;
  };

  return {
    errors,

    string(key, { maxLength = 100 } = {}) {
      const value = raw(key);
      if (value !== undefined && value.length > maxLength) {
        errors.push({ field: key, message: `${key} must be at most ${maxLength} characters` });
        return undefined;
      }
      return value;
    },

    /** Comma separated and/or repeated values -> unique, lower-cased list. */
    list(key) {
      const values = [query[key]].flat().filter((item) => item !== undefined && item !== null);
      const items = values.flatMap((item) => String(item).split(','));
      return [...new Set(items.map((item) => item.trim().toLowerCase()).filter(Boolean))];
    },

    number(key, { min = -Infinity, max = Infinity, integer = false } = {}) {
      const value = raw(key);
      if (value === undefined) return undefined;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed))) {
        errors.push({ field: key, message: `${key} must be ${integer ? 'an integer' : 'a number'}` });
        return undefined;
      }
      if (parsed < min || parsed > max) {
        const range = max === Infinity ? `at least ${min}` : `between ${min} and ${max}`;
        errors.push({ field: key, message: `${key} must be ${range}` });
        return undefined;
      }
      return parsed;
    },

    boolean(key) {
      const value = raw(key)?.toLowerCase();
      if (value === undefined) return undefined;
      if (['true', '1', 'yes'].includes(value)) return true;
      if (['false', '0', 'no'].includes(value)) return false;
      errors.push({ field: key, message: `${key} must be true or false` });
      return undefined;
    },

    oneOf(key, allowed, fallback) {
      const value = raw(key);
      if (value === undefined) return fallback;
      if (!allowed.includes(value)) {
        errors.push({ field: key, message: `${key} must be one of: ${allowed.join(', ')}` });
        return fallback;
      }
      return value;
    },

    /** page >= 1; limit >= 1 and silently capped at maxLimit. */
    pagination({ defaultLimit = 12, maxLimit = 50 } = {}) {
      const page = this.number('page', { min: 1, integer: true }) ?? 1;
      const limit = Math.min(this.number('limit', { min: 1, integer: true }) ?? defaultLimit, maxLimit);
      return { page, limit, skip: (page - 1) * limit };
    },

    assertValid() {
      if (errors.length) throw ApiError.validation(errors, 'Invalid query parameters');
    },
  };
};

/** Standard pagination block returned by every list endpoint. */
export const buildPagination = (page, limit, total) => ({
  page,
  limit,
  total,
  pages: Math.ceil(total / limit),
});
