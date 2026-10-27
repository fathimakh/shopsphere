import { readFileSync } from 'node:fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import env from './config/env.js';
import { connectDB, disconnectDB, isDBConnected } from './config/dbConnection.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { authLimiter } from './middleware/rateLimiter.js';
import sanitizeBody from './middleware/sanitize.js';
import ApiError from './utils/ApiError.js';
import authRoutes from './routes/authenticationRoutes.js';
import userProfileRoutes from './routes/userProfileRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import contactRoutes from './routes/contactRoutes.js';

const { name: packageName, version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// In development any localhost port may call the API (Vite picks another port when 5175 is busy).
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const isAllowedOrigin = (origin) =>
  env.clientUrls.includes(origin) || (env.nodeEnv === 'development' && LOCAL_ORIGIN.test(origin));

const corsOptions = {
  // Requests without an Origin header (curl, Postman/newman, server-to-server) are not CORS requests.
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) return callback(null, true);
    // A JSON 403 without Access-Control-Allow-Origin: the handler never runs and the browser blocks it.
    return callback(new ApiError(403, `Origin ${origin} is not allowed to access this API`, { code: 'CORS_ORIGIN_DENIED' }));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
  maxAge: 600,
};

const app = express();

// Render (and most PaaS) terminate TLS at one proxy hop; needed for correct req.ip in the rate limiter.
app.set('trust proxy', 1);

// The API is consumed from another origin (the SPA), so its responses may be embedded cross-origin.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(corsOptions));
if (env.nodeEnv === 'development') app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(sanitizeBody);

app.get('/', (_req, res) => {
  res.json({
    success: true,
    name: 'ShopSphere API',
    package: packageName,
    version,
    message: 'Welcome to the ShopSphere e-commerce REST API. Every endpoint lives under /api.',
    docs: 'See docs/API_CONTRACT.md and the Postman collection in ecommerce-backend/postman/ in the GitHub repository.',
    links: {
      health: '/api/health',
      products: '/api/products',
      categories: '/api/products/categories',
      recommendations: '/api/analytics/recommendations',
    },
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    db: isDBConnected() ? 'connected' : 'disconnected',
    uptime: Math.round(process.uptime()),
    environment: env.nodeEnv,
  });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userProfileRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/contact', contactRoutes);

app.use(notFound);
app.use(errorHandler);

/** Hides credentials in a connection string before it is logged. */
const redactUri = (uri) => uri.replace(/\/\/[^@/]+@/, '//***:***@');

const start = async () => {
  try {
    await connectDB();
  } catch (error) {
    console.error(`Could not connect to MongoDB at ${redactUri(env.mongoUri)}: ${error.message}`);
    console.error('Check that MongoDB is running and that MONGO_URI in .env is correct, then try again.');
    process.exit(1);
  }

  const server = app.listen(env.port, (error) => {
    if (error) {
      const reason = error.code === 'EADDRINUSE' ? `port ${env.port} is already in use` : error.message;
      console.error(`Could not start the API: ${reason}`);
      process.exit(1);
    }
    console.log(`ShopSphere API (${env.nodeEnv}) listening on http://localhost:${env.port}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received: closing the HTTP server and the database connection...`);
    // Force-exit if open connections keep the server alive for too long.
    setTimeout(() => process.exit(1), 10_000).unref();
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
};

// Tests import the app and manage their own database connection.
if (!env.isTest) start();

export default app;
