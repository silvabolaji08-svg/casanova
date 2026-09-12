import Listing from '../models/Listing.js'
import { ApiError, asyncHandler } from '../middleware/error.js'

/* Mean Earth radius in km, as MongoDB uses it. $centerSphere wants a radius
   in RADIANS, not kilometres — dividing by this is the conversion. */
const EARTH_RADIUS_KM = 6378.1
const kmToRadians = (km) => km / EARTH_RADIUS_KM

const SORTS = {
  featured: { featured: -1, createdAt: -1 },
  newest: { createdAt: -1 },
  'price-asc': { price: 1 },
  'price-desc': { price: -1 },
  'beds-desc': { bedrooms: -1, price: 1 },
}

/* "-0.1426,51.5390" → [-0.1426, 51.539], or null if it isn't a valid pair.
   Order is [longitude, latitude], matching GeoJSON. */
function parsePoint(value) {
  if (!value) return null
  const parts = String(value).split(',').map(Number)
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null
  const [lng, lat] = parts
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null
  return [lng, lat]
}

/**
 * Turns a map viewport into a GeoJSON Polygon.
 *
 * Leaflet gives you a bounds object with a south-west and a north-east
 * corner. Four numbers describe the rectangle; a polygon needs its corners
 * walked in order and the ring CLOSED — the last point repeats the first.
 * An unclosed ring is rejected by MongoDB.
 */
function boundsToPolygon(value) {
  if (!value) return null
  const parts = String(value).split(',').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null

  const [swLng, swLat, neLng, neLat] = parts

  /**
   * A zero-area box is not a rectangle, and MongoDB says so loudly:
   * "Loop must have at least 3 different vertices". It arrives when a
   * client measures a map container that hasn't been laid out yet, so
   * treating it as "no constraint" is the right answer — the request is
   * meaningful without it.
   */
  if (swLng === neLng || swLat === neLat) return null

  /* Tolerate corners given the wrong way round rather than returning
     nothing for a query that was almost right. */
  const [west, east] = swLng < neLng ? [swLng, neLng] : [neLng, swLng]
  const [south, north] = swLat < neLat ? [swLat, neLat] : [neLat, swLat]

  return {
    type: 'Polygon',
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  }
}

/**
 * Parses a hand-drawn shape: "lng,lat;lng,lat;lng,lat".
 *
 * Closes the ring if the client didn't, so the frontend doesn't have to
 * remember. Needs at least three distinct points to enclose any area.
 */
function drawnPolygon(value) {
  if (!value) return null
  const points = String(value)
    .split(';')
    .map(parsePoint)
    .filter(Boolean)

  if (points.length < 3) return null

  const first = points[0]
  const last = points[points.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) points.push(first)

  return { type: 'Polygon', coordinates: [points] }
}

/**
 * Builds the Mongo filter from query parameters.
 *
 * Returns the filter plus a flag saying whether a geospatial constraint is
 * present, because that changes how we can handle a text search.
 */
function buildFilter(query) {
  const {
    q,
    listingType,
    propertyType,
    minPrice,
    maxPrice,
    minBeds,
    maxBeds,
    minBaths,
    city,
    features,
    status,
    near,
    radiusKm,
    bounds,
    polygon,
  } = query

  const filter = {}

  /* Buyers should not see sold or let properties unless they ask. */
  filter.status = status && status !== 'all' ? status : { $in: ['available', 'under-offer'] }

  if (listingType && listingType !== 'all') filter.listingType = listingType

  if (propertyType && propertyType !== 'all') {
    filter.propertyType = { $in: String(propertyType).split(',') }
  }

  if (minPrice || maxPrice) {
    filter.price = {}
    if (minPrice) filter.price.$gte = Number(minPrice)
    if (maxPrice) filter.price.$lte = Number(maxPrice)
  }

  if (minBeds || maxBeds) {
    filter.bedrooms = {}
    if (minBeds) filter.bedrooms.$gte = Number(minBeds)
    if (maxBeds) filter.bedrooms.$lte = Number(maxBeds)
  }

  if (minBaths) filter.bathrooms = { $gte: Number(minBaths) }

  if (city) filter['address.city'] = new RegExp(`^${escapeRegex(city)}$`, 'i')

  /* Every named feature must be present, not just one of them. */
  if (features) filter.features = { $all: String(features).split(',') }

  /* ---- the geospatial part ---- */

  const drawn = drawnPolygon(polygon)
  const box = boundsToPolygon(bounds)
  const centre = parsePoint(near)

  let hasGeo = false

  if (drawn) {
    /* A hand-drawn shape wins over everything else — it is the most
       explicit thing the user can express. */
    filter.location = { $geoWithin: { $geometry: drawn } }
    hasGeo = true
  } else if (box) {
    /* "Show me what's on screen." */
    filter.location = { $geoWithin: { $geometry: box } }
    hasGeo = true
  } else if (centre) {
    /**
     * "Within N km of here."
     *
     * $centerSphere rather than $near, deliberately. $near sorts its results
     * by distance, which fights with the user's chosen sort order, and
     * countDocuments() refuses to run with it at all — so pagination becomes
     * impossible. $geoWithin is a pure filter: it composes with sort, skip,
     * limit and count like any ordinary condition.
     *
     * The radius must be in radians. 5 km is 0.00078 rad, not 5.
     */
    const km = Number(radiusKm) > 0 ? Number(radiusKm) : 3
    filter.location = { $geoWithin: { $centerSphere: [centre, kmToRadians(km)] } }
    hasGeo = true
  }

  /* ---- the search term ---- */

  if (q) {
    if (hasGeo) {
      /**
       * MongoDB will not run $text alongside a geospatial operator in the
       * same query. So when a map area is active we fall back to a regex
       * across the fields a person actually types into.
       *
       * A regex can't use the text index, but it is scanning an already
       * geo-narrowed set of documents, so the cost is small.
       */
      const rx = new RegExp(escapeRegex(q), 'i')
      filter.$or = [{ title: rx }, { 'address.city': rx }, { 'address.postcode': rx }]
    } else {
      filter.$text = { $search: q }
    }
  }

  return { filter, hasGeo, usedText: Boolean(q) && !hasGeo }
}

/* User input goes into a RegExp, so metacharacters must be neutralised —
   otherwise a search for "3+" throws, and a crafted term could be expensive. */
function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/* GET /api/listings */
export const listListings = asyncHandler(async (req, res) => {
  const { sort, page = 1, limit = 24 } = req.query
  const { filter, usedText } = buildFilter(req.query)

  const perPage = Math.min(Math.max(Number(limit) || 24, 1), 100)
  const currentPage = Math.max(Number(page) || 1, 1)
  const skip = (currentPage - 1) * perPage

  /* A text search with no explicit sort should rank by relevance. */
  let order = SORTS[sort] ?? SORTS.featured
  let projection = null
  if (usedText && !sort) {
    order = { score: { $meta: 'textScore' } }
    projection = { score: { $meta: 'textScore' } }
  }

  const [items, total] = await Promise.all([
    Listing.find(filter, projection)
      .sort(order)
      .skip(skip)
      .limit(perPage)
      .populate('agent', 'name agency avatar phone'),
    Listing.countDocuments(filter),
  ])

  res.json({
    items,
    total,
    page: currentPage,
    pages: Math.ceil(total / perPage) || 1,
  })
})

/**
 * GET /api/listings/pins
 *
 * Every match in the area, but only the fields a marker needs.
 *
 * The list beside the map is paginated; the map itself is not — hiding pins
 * would misrepresent what's for sale. So this can return several hundred
 * documents, which is exactly why it returns five fields instead of forty.
 * .lean() skips building Mongoose documents for objects nobody will modify.
 */
export const listingPins = asyncHandler(async (req, res) => {
  const { filter } = buildFilter(req.query)

  const pins = await Listing.find(filter)
    .select('slug title price listingType location')
    .limit(1000)
    .lean()

  res.json({
    items: pins.map((p) => ({
      id: String(p._id),
      slug: p.slug,
      title: p.title,
      price: p.price,
      listingType: p.listingType,
      /* Unpacked by name so no component has to remember the order. */
      lng: p.location.coordinates[0],
      lat: p.location.coordinates[1],
    })),
    total: pins.length,
  })
})

/**
 * GET /api/listings/meta
 *
 * Everything the filter sidebar needs to render itself, in one request.
 */
export const listingMeta = asyncHandler(async (_req, res) => {
  const active = { status: { $in: ['available', 'under-offer'] } }

  const [cities, propertyTypes, featureList, bounds] = await Promise.all([
    Listing.distinct('address.city', active),
    Listing.distinct('propertyType', active),
    Listing.distinct('features', active),
    Listing.aggregate([
      { $match: active },
      {
        $group: {
          _id: '$listingType',
          min: { $min: '$price' },
          max: { $max: '$price' },
          count: { $sum: 1 },
        },
      },
    ]),
  ])

  const byType = {}
  for (const row of bounds) {
    byType[row._id] = {
      min: Math.floor(row.min ?? 0),
      max: Math.ceil(row.max ?? 0),
      count: row.count,
    }
  }

  res.json({
    cities: cities.sort(),
    propertyTypes: propertyTypes.sort(),
    features: featureList.sort(),
    priceBounds: byType,
  })
})

/* GET /api/listings/:slug */
export const getListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findOne({ slug: req.params.slug }).populate(
    'agent',
    'name agency avatar phone bio workingDays workingHours slotMinutes'
  )

  if (!listing) throw new ApiError(404, 'Property not found')

  /* optionalAuth means req.user may or may not exist — a guest sees the same
     property, just without the saved flag. */
  const saved = req.user
    ? req.user.savedListings.some((id) => String(id) === String(listing._id))
    : false

  res.json({ listing, saved })
})

/* GET /api/listings/nearby/:slug — "similar properties close by" */
export const nearbyListings = asyncHandler(async (req, res) => {
  const listing = await Listing.findOne({ slug: req.params.slug }).select('location listingType')
  if (!listing) throw new ApiError(404, 'Property not found')

  const km = Number(req.query.radiusKm) > 0 ? Number(req.query.radiusKm) : 2

  const items = await Listing.find({
    _id: { $ne: listing._id },
    listingType: listing.listingType,
    status: { $in: ['available', 'under-offer'] },
    location: {
      $geoWithin: { $centerSphere: [listing.location.coordinates, kmToRadians(km)] },
    },
  })
    .limit(6)
    .populate('agent', 'name agency')

  res.json({ items, total: items.length })
})

/* GET /api/listings/mine — an agent's own portfolio, including sold/let */
export const myListings = asyncHandler(async (req, res) => {
  const items = await Listing.find({ agent: req.user._id }).sort({ createdAt: -1 })
  res.json({ items, total: items.length })
})

/* POST /api/listings — agent only */
export const createListing = asyncHandler(async (req, res) => {
  const listing = await Listing.create({
    ...req.body,
    /* The agent is taken from the token, never from the body — otherwise one
       agent could file listings under another's name. */
    agent: req.user._id,
  })
  res.status(201).json(listing)
})

/* PUT /api/listings/:id — agent only, and only their own */
export const updateListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.params.id)
  if (!listing) throw new ApiError(404, 'Property not found')

  /* An agent may edit their own listings; an admin may edit any. */
  if (String(listing.agent) !== String(req.user._id) && req.user.role !== 'admin') {
    throw new ApiError(403, 'That listing belongs to another agent')
  }

  /* Ownership can never be reassigned through an edit. */
  const { agent: _ignored, ...updates } = req.body
  Object.assign(listing, updates)
  await listing.save()

  res.json(listing)
})

/* DELETE /api/listings/:id — agent only, and only their own */
export const deleteListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.params.id)
  if (!listing) throw new ApiError(404, 'Property not found')

  if (String(listing.agent) !== String(req.user._id) && req.user.role !== 'admin') {
    throw new ApiError(403, 'That listing belongs to another agent')
  }

  await listing.deleteOne()
  res.status(204).end()
})