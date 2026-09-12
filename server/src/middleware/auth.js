import User from '../models/User.js'
import { ApiError, asyncHandler } from './error.js'
import { verifyToken } from '../utils/token.js'

/* "Bearer eyJhbGci..." → "eyJhbGci..." */
function readToken(req) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) return null
  return header.slice(7).trim() || null
}

/**
 * Requires a signed-in user. Attaches the full document as req.user.
 *
 * The user is loaded from the database rather than trusted from the token, so
 * a deleted account cannot keep making requests with a token that hasn't
 * expired yet.
 */
export const protect = asyncHandler(async (req, _res, next) => {
  const token = readToken(req)
  if (!token) throw new ApiError(401, 'Not signed in')

  const payload = verifyToken(token)
  const user = await User.findById(payload.id)
  if (!user) throw new ApiError(401, 'That account no longer exists')

  req.user = user
  next()
})

/**
 * Attaches req.user when a valid token is present, and does nothing when it
 * isn't. For endpoints that work either way — a listing page that also shows
 * whether you've saved it.
 *
 * A bad token is ignored rather than rejected, because the request is valid
 * without one.
 */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = readToken(req)
  if (!token) return next()
  try {
    const payload = verifyToken(token)
    req.user = await User.findById(payload.id)
  } catch {
    /* ignore — treat as a guest */
  }
  next()
})

/* Run after protect. Agents and admins may manage listings. */
export function agentOnly(req, _res, next) {
  if (req.user?.role !== 'agent' && req.user?.role !== 'admin') {
    return next(new ApiError(403, 'Agent access required'))
  }
  next()
}

export function adminOnly(req, _res, next) {
  if (req.user?.role !== 'admin') {
    return next(new ApiError(403, 'Admin access required'))
  }
  next()
}