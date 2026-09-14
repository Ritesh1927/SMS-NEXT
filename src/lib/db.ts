import mongoose from "mongoose";
import dns from "dns";

// Some local/ISP DNS resolvers fail to resolve the SRV records that
// `mongodb+srv://` connection strings depend on (surfaces as
// `querySrv ECONNREFUSED`), even though the connection string and Atlas
// config are both fine. Point SRV lookups at public resolvers instead —
// same fix used in the SMS backend for the same symptom.
if (process.env.MONGO_URI?.startsWith("mongodb+srv://")) {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

// Next.js API routes run as separate function invocations rather than one
// long-lived process, so a naive `mongoose.connect()` per request would open
// a new connection every time. Caching the connection (and the in-flight
// connect promise) on the Node global object survives across invocations
// within the same warm serverless instance, matching the standard
// Next.js + Mongoose pattern.
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cache;

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  // Checked here (not at module scope) so simply importing this file — which
  // Next.js does while collecting route metadata at build time — doesn't
  // fail a build that never actually needs a live database connection.
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is not set. Add it to .env.local");
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGO_URI, {
      bufferCommands: false,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }

  return cache.conn;
}
