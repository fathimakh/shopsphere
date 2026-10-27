/**
 * NoSQL-injection guard: recursively removes keys that start with "$" or contain "."
 * (e.g. { "email": { "$gt": "" } } becomes { "email": {} } and then fails validation).
 *
 * - req.body: sanitised here for every request.
 * - req.params: keys come from our route definitions and values are always strings;
 *   every ":id" is additionally checked to be a 24-hex ObjectId via router.param().
 * - req.query: deliberately not touched. In Express 5 it is a read-only getter and the
 *   "simple" query parser never builds nested objects, so values are plain strings (or
 *   arrays of strings) that utils/queryReader.js parses defensively.
 */
const isUnsafeKey = (key) => key.startsWith('$') || key.includes('.');

export const stripUnsafeKeys = (value) => {
  if (Array.isArray(value)) {
    value.forEach(stripUnsafeKeys);
  } else if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (isUnsafeKey(key)) delete value[key];
      else stripUnsafeKeys(value[key]);
    }
  }
  return value;
};

const sanitizeBody = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') stripUnsafeKeys(req.body);
  next();
};

export default sanitizeBody;
