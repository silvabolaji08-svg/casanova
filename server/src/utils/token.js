import jwt from 'jsonwebtoken'

/**
 * Signs a token carrying the user's id and role.
 *
 * The payload is only base64-encoded, not encrypted — anyone holding the token
 * can read it. So it carries an id and a role and nothing private. The
 * signature is what makes it trustworthy: without JWT_SECRET you cannot
 * produce a token the server will accept, and you cannot alter one without
 * invalidating it.
 *
 * Putting `role` in the payload is a deliberate trade. It saves a database
 * lookup on every request, at the cost of a stale role until the token
 * expires — if you promote someone to agent, they must sign in again.
 */
export function signToken(user) {
  return jwt.sign({ id: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET)
}