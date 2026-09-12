/**
 * An error that carries an HTTP status.
 *
 * Throwing one of these anywhere in a controller produces a clean response;
 * anything else thrown becomes a 500, which is the correct default for a bug.
 */
export class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message)
    this.status = status
    this.details = details
  }
}

/**
 * Wraps an async route handler so a rejected promise reaches Express.
 *
 * Express 4 does not understand promises. An async handler that throws will
 * reject silently and the request hangs forever — no error, no response, the
 * browser spinner just keeps turning. This wrapper catches the rejection and
 * passes it to next(), which is the only thing Express listens to.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

/* Reached only when no route matched. */
export function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`))
}

/**
 * The error handler.
 *
 * It MUST take four arguments. Express identifies error handlers by function
 * arity — remove `err` and this silently becomes ordinary middleware that
 * never runs, and every error turns into Express's default HTML stack trace.
 */
export function errorHandler(err, _req, res, _next) {
  let status = err.status ?? 500
  let message = err.message ?? 'Something went wrong'
  let details = err.details ?? null

  /* Mongoose validation — a required field missing, an enum violated, our
     coordinate validator rejecting a swapped pair. */
  if (err.name === 'ValidationError') {
    status = 400
    details = Object.values(err.errors).map((e) => e.message)
    message = 'Validation failed'
  }

  /* A malformed ObjectId — "/listings/not-an-id". Mongo can't cast it, so it
     is a bad request, not a server fault. */
  if (err.name === 'CastError') {
    status = 400
    message = `Invalid ${err.path}: ${err.value}`
  }

  /**
   * Duplicate key. Code 11000 comes from MongoDB itself, not Mongoose.
   *
   * This is where the booking race condition lands. Two people submit the
   * same slot at the same instant; the partial unique index on
   * (agent, startAt) lets the first write through and rejects the second
   * with 11000. We turn that into a 409 the frontend can show sensibly.
   */
  if (err.code === 11000) {
    status = 409
    const field = Object.keys(err.keyPattern ?? {})
    if (field.includes('startAt')) {
      message = 'That time has just been booked by someone else. Please pick another slot.'
    } else if (field.includes('email')) {
      message = 'An account with that email already exists'
    } else if (field.includes('slug')) {
      message = 'A listing with that title already exists'
    } else {
      message = 'That record already exists'
    }
  }

  /* Bad or expired token. */
  if (err.name === 'JsonWebTokenError') {
    status = 401
    message = 'Invalid token'
  }
  if (err.name === 'TokenExpiredError') {
    status = 401
    message = 'Your session has expired. Please sign in again.'
  }

  /* Log real faults. A 404 or a 400 is the client's problem and would only
     fill the logs with noise. */
  if (status >= 500) console.error(err)

  res.status(status).json({
    message,
    ...(details ? { details } : {}),
    /* Stack traces are useful locally and a security leak in production. */
    ...(process.env.NODE_ENV === 'production' ? {} : { stack: err.stack }),
  })
}