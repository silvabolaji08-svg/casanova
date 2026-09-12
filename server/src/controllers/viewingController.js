import Listing from '../models/Listing.js'
import Viewing, { ACTIVE_STATUSES } from '../models/Viewing.js'
import { ApiError, asyncHandler } from '../middleware/error.js'

/* How much warning an agent needs. Nobody wants a viewing booked for
   ten minutes from now. */
const MIN_NOTICE_MINUTES = 120
/* How far ahead the calendar opens. */
const MAX_DAYS_AHEAD = 30

/**
 * A NOTE ON TIME, because this is where scheduling code goes wrong.
 *
 * Everything here works in UTC. Dates arrive as "2026-09-14" and slots are
 * built with Date.UTC, so a slot is an unambiguous instant.
 *
 * The known limitation: an agent's "09:00 to 18:00" is therefore 09:00 UTC,
 * not 09:00 wherever they are. For a UK-only demo that is very nearly right
 * and wrong by an hour in summer. Doing it properly means storing an IANA
 * timezone per agent and converting through Intl — worth knowing, not worth
 * the complexity here. It is written down rather than left as a surprise.
 */

/* "09:30" → 570 minutes past midnight. */
function parseHm(hm) {
  const [h, m] = String(hm).split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

/**
 * "2026-09-14" → the UTC timestamp of that midnight, or null.
 *
 * The round-trip check rejects dates that look valid but aren't: new Date
 * happily turns 2026-02-30 into 2 March, which would silently offer slots on
 * the wrong day.
 */
function parseDay(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''))
  if (!m) return null
  const [, y, mo, d] = m.map(Number)
  const ms = Date.UTC(y, mo - 1, d)
  const check = new Date(ms)
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    return null
  }
  return ms
}

/**
 * Every slot the agent could work on this day, minus the taken ones and the
 * ones too soon to book.
 *
 * `taken` is a Set of start timestamps in milliseconds.
 */
function buildSlots({ dayStartMs, agent, taken, now = Date.now() }) {
  const dayOfWeek = new Date(dayStartMs).getUTCDay()
  if (!agent.workingDays?.includes(dayOfWeek)) return []

  const from = parseHm(agent.workingHours?.start ?? '09:00')
  const to = parseHm(agent.workingHours?.end ?? '18:00')
  if (from === null || to === null || to <= from) return []

  const step = agent.slotMinutes || 30
  const earliest = now + MIN_NOTICE_MINUTES * 60_000

  const slots = []

  /**
   * `mins + step <= to` — not `mins < to`.
   *
   * The viewing has to FINISH by closing time, not merely start before it.
   * With hour-long viewings and a 17:30 close, the last start is 16:00,
   * because 17:00 would run over.
   */
  for (let mins = from; mins + step <= to; mins += step) {
    const startMs = dayStartMs + mins * 60_000
    if (startMs < earliest) continue
    if (taken.has(startMs)) continue
    slots.push(new Date(startMs).toISOString())
  }

  return slots
}

/* Loads the listing and its agent, or 404s. */
async function findListingBySlug(slug) {
  const listing = await Listing.findOne({ slug }).populate(
    'agent',
    'name agency workingDays workingHours slotMinutes'
  )
  if (!listing) throw new ApiError(404, 'Property not found')
  if (!listing.agent) throw new ApiError(409, 'This property has no agent assigned')
  return listing
}

/* All active viewing start times for an agent within a window. */
async function takenSlots(agentId, fromMs, toMs) {
  const rows = await Viewing.find({
    agent: agentId,
    status: { $in: ACTIVE_STATUSES },
    startAt: { $gte: new Date(fromMs), $lt: new Date(toMs) },
  })
    .select('startAt')
    .lean()

  return new Set(rows.map((r) => r.startAt.getTime()))
}

/**
 * GET /api/viewings/availability?listing=<slug>&date=2026-09-14
 *
 * Free slots for one day.
 */
export const getAvailability = asyncHandler(async (req, res) => {
  const { listing: slug, date } = req.query
  if (!slug) throw new ApiError(400, 'A listing slug is required')

  const dayStartMs = parseDay(date)
  if (dayStartMs === null) throw new ApiError(400, 'A date is required, formatted YYYY-MM-DD')

  const listing = await findListingBySlug(slug)
  const dayEndMs = dayStartMs + 86_400_000

  const taken = await takenSlots(listing.agent._id, dayStartMs, dayEndMs)

  res.json({
    date,
    listing: listing.slug,
    durationMinutes: listing.agent.slotMinutes || 30,
    slots: buildSlots({ dayStartMs, agent: listing.agent, taken }),
  })
})

/**
 * GET /api/viewings/availability/range?listing=<slug>&days=14
 *
 * One request that tells the date picker which days have anything free, so
 * it can grey out the rest instead of making the user click through them.
 */
export const getAvailabilityRange = asyncHandler(async (req, res) => {
  const { listing: slug } = req.query
  if (!slug) throw new ApiError(400, 'A listing slug is required')

  const days = Math.min(Math.max(Number(req.query.days) || 14, 1), MAX_DAYS_AHEAD)

  const listing = await findListingBySlug(slug)

  /* Start from today's UTC midnight. */
  const today = new Date()
  const startMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  const endMs = startMs + days * 86_400_000

  /* One query for the whole range, then the days are filtered in memory.
     The alternative — a query per day — is fourteen round trips for data
     one round trip already has. */
  const taken = await takenSlots(listing.agent._id, startMs, endMs)

  const out = []
  for (let i = 0; i < days; i += 1) {
    const dayStartMs = startMs + i * 86_400_000
    const slots = buildSlots({ dayStartMs, agent: listing.agent, taken })
    out.push({
      date: new Date(dayStartMs).toISOString().slice(0, 10),
      count: slots.length,
      firstSlot: slots[0] ?? null,
    })
  }

  res.json({ listing: listing.slug, days: out })
})

/**
 * POST /api/viewings
 *
 * Body: { listing: slug, startAt: ISO string, notes?, contact? }
 */
export const createViewing = asyncHandler(async (req, res) => {
  const { listing: slug, startAt, notes, contact } = req.body
  if (!slug || !startAt) throw new ApiError(400, 'A listing and a start time are required')

  const when = new Date(startAt)
  if (Number.isNaN(when.getTime())) throw new ApiError(400, 'That start time is not a valid date')

  const listing = await findListingBySlug(slug)

  if (listing.status === 'sold' || listing.status === 'let') {
    throw new ApiError(409, 'This property is no longer available to view')
  }

  /* An agent booking a viewing on their own listing is a mistake, not a sale. */
  if (String(listing.agent._id) === String(req.user._id)) {
    throw new ApiError(400, 'You are the agent for this property')
  }

  /**
   * Re-derive the valid slots server-side and check the requested time is
   * one of them.
   *
   * The frontend already only shows valid slots — but the frontend is not a
   * security boundary. Anyone can POST any timestamp: 3am, a Sunday, a
   * quarter past ten when slots run on the half hour. Same principle as
   * taking prices from the database rather than the request.
   */
  const dayStartMs = Date.UTC(when.getUTCFullYear(), when.getUTCMonth(), when.getUTCDate())
  const taken = await takenSlots(listing.agent._id, dayStartMs, dayStartMs + 86_400_000)
  const slots = buildSlots({ dayStartMs, agent: listing.agent, taken })

  if (!slots.includes(when.toISOString())) {
    throw new ApiError(409, 'That time is not available. Please choose another slot.')
  }

  if (when.getTime() > Date.now() + MAX_DAYS_AHEAD * 86_400_000) {
    throw new ApiError(400, `Viewings can only be booked up to ${MAX_DAYS_AHEAD} days ahead`)
  }

  /**
   * And now the write.
   *
   * The slot check above is a courtesy — it produces a clear message in the
   * ordinary case. It is NOT the guarantee. Between that check and this
   * write, someone else can book the same slot; the gap is milliseconds and
   * it will eventually happen.
   *
   * The guarantee is the partial unique index on (agent, startAt) in
   * Viewing.js. If we lose the race, MongoDB rejects this insert with code
   * 11000 and the error handler turns it into a 409 saying the slot has just
   * been taken. Two defences: one for clarity, one for correctness.
   */
  const viewing = await Viewing.create({
    listing: listing._id,
    /* Copied, not referenced — this viewing belongs to whoever is the agent
       today, even if the property is reassigned next month. */
    agent: listing.agent._id,
    user: req.user._id,
    contact: {
      name: contact?.name || req.user.name,
      email: contact?.email || req.user.email,
      phone: contact?.phone || req.user.phone,
    },
    startAt: when,
    durationMinutes: listing.agent.slotMinutes || 30,
    notes: notes || '',
  })

  await viewing.populate([
    { path: 'listing', select: 'title slug address images price listingType' },
    { path: 'agent', select: 'name agency phone' },
  ])

  res.status(201).json(viewing)
})

/* GET /api/viewings/mine — the signed-in user's bookings */
export const myViewings = asyncHandler(async (req, res) => {
  const items = await Viewing.find({ user: req.user._id })
    .sort({ startAt: -1 })
    .populate('listing', 'title slug address images price listingType')
    .populate('agent', 'name agency phone')

  res.json({ items, total: items.length })
})

/**
 * GET /api/viewings/schedule?from=2026-09-14&days=7 — agent only
 *
 * The agent's own diary.
 */
export const agentSchedule = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 60)

  let startMs = parseDay(req.query.from)
  if (startMs === null) {
    const now = new Date()
    startMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  }

  const items = await Viewing.find({
    agent: req.user._id,
    startAt: { $gte: new Date(startMs), $lt: new Date(startMs + days * 86_400_000) },
  })
    .sort({ startAt: 1 })
    .populate('listing', 'title slug address images')
    .populate('user', 'name email phone')

  res.json({ items, total: items.length })
})

/* GET /api/viewings/:reference */
export const getViewing = asyncHandler(async (req, res) => {
  const viewing = await Viewing.findOne({ reference: req.params.reference.toUpperCase() })
    .populate('listing', 'title slug address images price listingType')
    .populate('agent', 'name agency phone')

  if (!viewing) throw new ApiError(404, 'Booking not found')

  /* Only the person who booked it, the agent, or an admin. A reference is
     short enough to guess, so it is not a password. */
  const isOwner = String(viewing.user) === String(req.user._id)
  const isAgent = String(viewing.agent._id) === String(req.user._id)
  if (!isOwner && !isAgent && req.user.role !== 'admin') {
    throw new ApiError(403, 'That booking is not yours')
  }

  res.json(viewing)
})

/**
 * PATCH /api/viewings/:reference/cancel
 *
 * Either side may cancel. The record is kept — status changes, nothing is
 * deleted — and because the unique index only covers active statuses, the
 * slot becomes bookable again the moment this saves.
 */
export const cancelViewing = asyncHandler(async (req, res) => {
  const viewing = await Viewing.findOne({ reference: req.params.reference.toUpperCase() })
  if (!viewing) throw new ApiError(404, 'Booking not found')

  const isOwner = String(viewing.user) === String(req.user._id)
  const isAgent = String(viewing.agent) === String(req.user._id)
  if (!isOwner && !isAgent && req.user.role !== 'admin') {
    throw new ApiError(403, 'That booking is not yours')
  }

  if (!ACTIVE_STATUSES.includes(viewing.status)) {
    throw new ApiError(409, `This booking is already ${viewing.status}`)
  }

  viewing.status = 'cancelled'
  viewing.cancelledAt = new Date()
  viewing.cancelledBy = req.user._id
  viewing.cancelReason = String(req.body.reason ?? '').slice(0, 300)
  await viewing.save()

  res.json(viewing)
})

/**
 * PATCH /api/viewings/:reference/status — agent only
 *
 * requested → confirmed | declined, and confirmed → completed.
 */
export const setViewingStatus = asyncHandler(async (req, res) => {
  const { status } = req.body
  if (!['confirmed', 'declined', 'completed'].includes(status)) {
    throw new ApiError(400, 'Status must be confirmed, declined or completed')
  }

  const viewing = await Viewing.findOne({ reference: req.params.reference.toUpperCase() })
  if (!viewing) throw new ApiError(404, 'Booking not found')

  if (String(viewing.agent) !== String(req.user._id) && req.user.role !== 'admin') {
    throw new ApiError(403, 'That booking belongs to another agent')
  }

  /* A state machine, so a cancelled booking can't be quietly confirmed. */
  const allowed = {
    requested: ['confirmed', 'declined'],
    confirmed: ['completed'],
    declined: [],
    cancelled: [],
    completed: [],
  }

  if (!allowed[viewing.status].includes(status)) {
    throw new ApiError(409, `Cannot go from ${viewing.status} to ${status}`)
  }

  viewing.status = status
  await viewing.save()

  res.json(viewing)
})