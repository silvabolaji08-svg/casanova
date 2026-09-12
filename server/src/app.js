import 'dotenv/config'
import express from 'express'
import cors from 'cors'

import { connectDB } from './config/db.js'
import { notFound, errorHandler, asyncHandler } from './middleware/error.js'

import listingRoutes from './routes/listingRoutes.js'
import authRoutes from './routes/authRoutes.js'
import viewingRoutes from './routes/viewingRoutes.js'

const app = express()

/* Only these origins may call the API from a browser. Set CLIENT_ORIGIN in
   the environment; comma-separate for more than one. */
const origins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())

app.use(cors({ origin: origins, credentials: true }))

/* Parses JSON bodies into req.body. Without it, req.body is undefined. */
app.use(express.json({ limit: '1mb' }))

/**
 * Health check, registered BEFORE the database middleware so it answers even
 * when Mongo is unreachable. That is what makes it useful — it distinguishes
 * "the server is down" from "the database is down", which are different
 * problems with different fixes.
 */
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, uptime: process.uptime(), service: 'casanova-api' })
)

/**
 * Ensure the database is connected before any route that needs it.
 *
 * On a long-running server this resolves instantly after the first request.
 * On serverless there is no startup phase, so this is the only place a
 * connection can be established — and connectDB caches it, so warm
 * invocations reuse the existing one.
 */
app.use(
  asyncHandler(async (_req, _res, next) => {
    await connectDB()
    next()
  })
)

app.use('/api/listings', listingRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/viewings', viewingRoutes)

/* Last, after every real route. */
app.use(notFound)
app.use(errorHandler)

export default app