import dotenv from 'dotenv';

// Load .env once, before any module reads configuration. Values that are already
// present in process.env (e.g. set by the host or the test runner) always win.
dotenv.config({ quiet: true });

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// "http://a.com/, http://b.com" -> ["http://a.com", "http://b.com"]
const toOriginList = (value) =>
  String(value || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

const nodeEnv = process.env.NODE_ENV || 'development';

/**
 * Centralised, typed view of the environment. Kept as a plain (mutable) object so
 * tests can point individual settings, such as the RapidMiner URL, at mock servers.
 */
const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: toInt(process.env.PORT, 5050),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27035/shopsphere',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  clientUrls: toOriginList(process.env.CLIENT_URL || 'http://localhost:5175'),
  authRateLimitMax: toInt(process.env.AUTH_RATE_LIMIT_MAX, 100),
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@shopsphere.dev',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
  rapidminer: {
    scoringUrl: (process.env.RAPIDMINER_SCORING_URL || '').trim(),
    authToken: process.env.RAPIDMINER_AUTH_TOKEN || '',
    username: process.env.RAPIDMINER_USERNAME || '',
    password: process.env.RAPIDMINER_PASSWORD || '',
    timeoutMs: toInt(process.env.RAPIDMINER_TIMEOUT_MS, 4000),
  },
  recoCacheTtlSeconds: toInt(process.env.RECO_CACHE_TTL_SECONDS, 300),
};

if (!env.jwtSecret) {
  throw new Error('JWT_SECRET is not set. Copy .env.example to .env and fill it in.');
}

export default env;
