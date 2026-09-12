import mongoose from 'mongoose'

/**
 * Cached connection.
 *
 * A long-running server connects once at startup. Serverless has no startup —
 * every request may run in a fresh function, and connecting each time would
 * open hundreds of sockets and exhaust Atlas's connection limit.
 *
 * The cache lives on `globalThis` because a warm serverless invocation reuses
 * the process but can re-evaluate modules; a module-level variable alone is
 * not reliably shared, a global is.
 */
const cache = (globalThis.__casanovaMongo ??= { conn: null, promise: null })

export async function connectDB() {
  if (cache.conn) return cache.conn

  if (!cache.promise) {
    const uri = process.env.MONGO_URI
    if (!uri) throw new Error('MONGO_URI is missing. Copy .env.example to .env and fill it in.')

    mongoose.set('strictQuery', true)

    cache.promise = mongoose
      .connect(uri, {
        /* Fail fast instead of queuing commands against a dead connection —
           a hung request is worse than an error you can see. */
        bufferCommands: false,
        /* Small pool: many short-lived functions each want a few sockets. */
        maxPoolSize: 5,
        /* Well under Vercel's 10s function limit, so a database problem
           surfaces as a clear error rather than a timeout. */
        serverSelectionTimeoutMS: 5000,
      })
      .then((m) => {
        console.log(`MongoDB connected: ${m.connection.host}/${m.connection.name}`)
        return m
      })
      .catch((err) => {
        /* Clear the cached promise so the next request retries rather than
           awaiting a rejection forever. */
        cache.promise = null
        throw err
      })
  }

  cache.conn = await cache.promise
  return cache.conn
}

/**
 * Ensures every model's indexes exist in MongoDB.
 *
 * Declaring `index()` in a schema does not create the index — Mongoose builds
 * them in the background on first connect, and on a fresh serverless function
 * that may not have happened yet. For geospatial work this matters more than
 * usual: a $near query against a collection with no 2dsphere index does not
 * run slowly, it throws outright. So the seed script calls this explicitly.
 */
export async function syncIndexes() {
  const results = []
  for (const name of mongoose.modelNames()) {
    await mongoose.model(name).syncIndexes()
    results.push(name)
  }
  return results
}