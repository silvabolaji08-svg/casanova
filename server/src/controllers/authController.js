import User from '../models/User.js'
import Listing from '../models/Listing.js'
import { ApiError, asyncHandler } from '../middleware/error.js'
import { signToken } from '../utils/token.js'

/* POST /api/auth/register */
export const register = asyncHandler(async (req, res) => {
  /**
   * Only these four fields are read.
   *
   * `role` is deliberately NOT destructured. If it were, anyone could POST
   * { role: 'admin' } and promote themselves — a mass assignment
   * vulnerability. Agents are created by the seed or promoted by an admin.
   */
  const { name, email, password, phone } = req.body

  if (!name || !email || !password) {
    throw new ApiError(400, 'Name, email and password are required')
  }

  /* The unique index on email is the real guarantee; this check just gives a
     nicer message in the common case. A race between two identical
     registrations still ends at the 11000 handler. */
  const existing = await User.findOne({ email: String(email).toLowerCase() })
  if (existing) throw new ApiError(409, 'An account with that email already exists')

  const user = await User.create({ name, email, password, phone })

  res.status(201).json({ user, token: signToken(user) })
})

/* POST /api/auth/login */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) throw new ApiError(400, 'Email and password are required')

  /* password is select:false, so it must be asked for explicitly. */
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password')

  /**
   * One message for both failure modes.
   *
   * "No account found" versus "wrong password" tells an attacker which
   * emails are registered — account enumeration. Same message, and the
   * bcrypt comparison still runs in the normal case so the timing doesn't
   * give it away either.
   */
  if (!user || !(await user.matchPassword(password))) {
    throw new ApiError(401, 'Incorrect email or password')
  }

  /* Strip the password before it goes anywhere near the response. */
  user.password = undefined

  res.json({ user, token: signToken(user) })
})

/* GET /api/auth/me — restores a session from a stored token */
export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user })
})

/* PUT /api/auth/me */
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, bio, agency, avatar, workingDays, workingHours, slotMinutes } = req.body

  const user = req.user

  if (name !== undefined) user.name = name
  if (phone !== undefined) user.phone = phone

  /* Agent-only fields, ignored for a buyer rather than rejected — a buyer
     sending them is a client bug, not an attack. */
  if (user.role === 'agent' || user.role === 'admin') {
    if (bio !== undefined) user.bio = bio
    if (agency !== undefined) user.agency = agency
    if (avatar !== undefined) user.avatar = avatar
    if (Array.isArray(workingDays)) user.workingDays = workingDays
    if (workingHours?.start) user.workingHours.start = workingHours.start
    if (workingHours?.end) user.workingHours.end = workingHours.end
    if (slotMinutes) user.slotMinutes = Number(slotMinutes)
  }

  await user.save()
  res.json({ user })
})

/* GET /api/auth/saved — the buyer's shortlist, fully populated */
export const getSaved = asyncHandler(async (req, res) => {
  const items = await Listing.find({ _id: { $in: req.user.savedListings } }).populate(
    'agent',
    'name agency'
  )
  res.json({ items, total: items.length })
})

/**
 * POST /api/auth/saved/:id — toggle a property on the shortlist.
 *
 * $addToSet and $pull are used rather than reading the array, changing it in
 * JavaScript and saving it back. Those operators are applied by MongoDB
 * atomically, so two rapid taps can't drop one of the changes.
 */
export const toggleSaved = asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.params.id).select('_id')
  if (!listing) throw new ApiError(404, 'Property not found')

  const alreadySaved = req.user.savedListings.some((id) => String(id) === String(listing._id))

  await User.updateOne(
    { _id: req.user._id },
    alreadySaved
      ? { $pull: { savedListings: listing._id } }
      : { $addToSet: { savedListings: listing._id } }
  )

  res.json({ saved: !alreadySaved })
})