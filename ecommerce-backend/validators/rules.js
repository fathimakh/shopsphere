/**
 * Tiny declarative validation toolkit (no extra dependency).
 *
 * A rule is `{ required, label, check(value, path) }` where check returns null when the
 * value is fine, a message string, or an array of nested `{ field, message }` errors.
 * validate() runs a map of rules against an object and returns field-level errors.
 */

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;
export const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{6,18}[0-9]$/;
export const URL_PATTERN = /^https?:\/\/[^\s]+$/i;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

const isBlank = (value) => value === null || (typeof value === 'string' && value.trim() === '');
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export const validate = (data, rules, { partial = false, prefix = '' } = {}) => {
  const source = isPlainObject(data) ? data : {};
  const errors = [];

  for (const [key, rule] of Object.entries(rules)) {
    const field = prefix ? `${prefix}.${key}` : key;
    const value = source[key];

    // Missing keys are fine in partial (PATCH-like) updates; blank values never satisfy "required".
    if (value === undefined) {
      if (rule.required && !partial) errors.push({ field, message: `${rule.label} is required` });
      continue;
    }
    if (isBlank(value)) {
      if (rule.required) errors.push({ field, message: `${rule.label} is required` });
      continue;
    }

    const result = rule.check(value, field);
    if (Array.isArray(result)) errors.push(...result);
    else if (result) errors.push({ field, message: result });
  }
  return errors;
};

export const text = ({ label, min = 0, max = 255, required = true, pattern, patternMessage }) => ({
  label,
  required,
  check(value) {
    if (typeof value !== 'string') return `${label} must be a string`;
    const { length } = value.trim();
    if (length < min || length > max) {
      return min > 0 ? `${label} must be between ${min} and ${max} characters` : `${label} must be at most ${max} characters`;
    }
    if (pattern && !pattern.test(value.trim())) return patternMessage || `${label} is invalid`;
    return null;
  },
});

export const email = ({ label = 'Email', required = true } = {}) =>
  text({ label, max: 254, required, pattern: EMAIL_PATTERN, patternMessage: `${label} is invalid` });

export const password = ({ label = 'Password', required = true } = {}) => ({
  label,
  required,
  check(value) {
    if (typeof value !== 'string') return `${label} must be a string`;
    if (value.length < 8) return `${label} must be at least 8 characters`;
    if (value.length > 128) return `${label} must be at most 128 characters`;
    if (!PASSWORD_PATTERN.test(value)) return `${label} must contain at least one letter and one number`;
    return null;
  },
});

/** Accepts numbers and numeric strings (HTML form inputs); Mongoose casts the latter on save. */
export const toNumber = (value) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value);

export const number = ({ label, min = -Infinity, max = Infinity, integer = false, required = true }) => ({
  label,
  required,
  check(raw) {
    const value = toNumber(raw);
    if (typeof value !== 'number' || !Number.isFinite(value)) return `${label} must be a number`;
    if (integer && !Number.isInteger(value)) return `${label} must be a whole number`;
    if (value < min) return `${label} must be at least ${min}`;
    if (value > max) return `${label} must be at most ${max}`;
    return null;
  },
});

export const boolean = ({ label, required = false }) => ({
  label,
  required,
  check: (value) => (typeof value === 'boolean' ? null : `${label} must be true or false`),
});

export const oneOf = ({ label, values, required = true }) => ({
  label,
  required,
  check: (value) => (values.includes(value) ? null : `${label} must be one of: ${values.join(', ')}`),
});

export const objectId = ({ label, required = true }) => ({
  label,
  required,
  check: (value) => (typeof value === 'string' && OBJECT_ID_PATTERN.test(value) ? null : `${label} is not a valid id`),
});

/** Array of strings, each checked by `itemPattern` (e.g. image URLs or tags). */
export const stringList = ({ label, maxItems = 20, itemMax = 500, itemPattern, itemMessage, required = false }) => ({
  label,
  required,
  check(value) {
    if (!Array.isArray(value)) return `${label} must be an array`;
    if (value.length > maxItems) return `${label} can contain at most ${maxItems} items`;
    const invalid = value.findIndex(
      (item) => typeof item !== 'string' || !item.trim() || item.length > itemMax || (itemPattern && !itemPattern.test(item.trim())),
    );
    return invalid === -1 ? null : `${label}[${invalid}] ${itemMessage || 'is invalid'}`;
  },
});

/** Nested object validated with its own rule map; errors are reported as "parent.child". */
export const object = ({ label, fields, required = true, partial = false }) => ({
  label,
  required,
  check(value, path) {
    if (!isPlainObject(value)) return `${label} must be an object`;
    return validate(value, fields, { partial, prefix: path });
  },
});

/** Array of objects; errors are reported as "items[2].quantity". */
export const arrayOf = ({ label, fields, minItems = 1, maxItems = 50, required = true }) => ({
  label,
  required,
  check(value, path) {
    if (!Array.isArray(value)) return `${label} must be an array`;
    if (value.length < minItems) return `${label} must contain at least ${minItems} item${minItems === 1 ? '' : 's'}`;
    if (value.length > maxItems) return `${label} can contain at most ${maxItems} items`;
    return value.flatMap((item, index) => {
      if (!isPlainObject(item)) return [{ field: `${path}[${index}]`, message: `${label} entries must be objects` }];
      return validate(item, fields, { prefix: `${path}[${index}]` });
    });
  },
});
