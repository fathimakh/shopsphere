import mongoose from 'mongoose';
import env from './env.js';

// Only fields declared in a schema may be used in query filters.
mongoose.set('strictQuery', true);

/**
 * Opens the shared Mongoose connection. Resolves once MongoDB is reachable and
 * rejects (instead of hanging) when it is not, so callers can fail fast.
 */
export const connectDB = async (uri = env.mongoUri) => {
  const connection = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  const { host, port, name } = connection.connection;
  if (!env.isTest) console.log(`MongoDB connected: ${host}:${port}/${name}`);
  return connection;
};

export const disconnectDB = () => mongoose.disconnect();

/** True when the default connection is open (used by GET /api/health). */
export const isDBConnected = () => mongoose.connection.readyState === 1;
