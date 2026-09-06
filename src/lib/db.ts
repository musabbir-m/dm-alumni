import mongoose from 'mongoose';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Reuse one connection across dev-server hot reloads (module state resets,
// globalThis doesn't)
const cached: MongooseCache =
  (globalThis as { __mongooseCache?: MongooseCache }).__mongooseCache ??
  { conn: null, promise: null };
(globalThis as { __mongooseCache?: MongooseCache }).__mongooseCache = cached;

export async function connectDB() {
  // Read the URI lazily: ESM imports evaluate before scripts like seed.ts
  // can load .env.local into process.env, so a module-level const would
  // capture undefined and silently fall back to the local default.
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/dm-alumni';

  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(uri);
  }
  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null; // allow a retry on the next call
    throw err;
  }
  return cached.conn;
}
