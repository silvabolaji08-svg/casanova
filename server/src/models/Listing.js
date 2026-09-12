import mongoose from 'mongoose'

const { Schema } = mongoose

/* Turns "Two-Bed Flat, Camden" into "two-bed-flat-camden". */
function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

/**
 * A GeoJSON Point.
 *
 * MongoDB understands this exact shape and nothing else for geospatial
 * queries: an object with a `type` of "Point" and a `coordinates` array.
 *
 * The coordinate order is [longitude, latitude] — NOT latitude first.
 * This is the single most common mistake in geospatial code. See the notes
 * below the file.
 */
const pointSchema = new Schema(
  {
    /* `type` is a reserved word in Mongoose schema definitions, so to declare
       a field actually named "type" you have to nest its own definition. */
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true,
    },
    coordinates: {
      type: [Number],
      required: [true, 'Coordinates are required'],
      validate: {
        validator(value) {
          if (!Array.isArray(value) || value.length !== 2) return false
          const [lng, lat] = value
          if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false
          /* Catches gross errors and some swapped pairs. Not all of them —
             see the notes. */
          return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90
        },
        message: 'Coordinates must be [longitude, latitude] within valid ranges',
      },
    },
  },
  { _id: false }
)

const addressSchema = new Schema(
  {
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true, default: '' },
    city: { type: String, required: true, trim: true },
    postcode: { type: String, required: true, trim: true, uppercase: true },
    country: { type: String, trim: true, default: 'United Kingdom' },
  },
  { _id: false }
)

const listingSchema = new Schema(
  {
    title: { type: String, required: [true, 'A title is required'], trim: true },
    slug: { type: String, unique: true, index: true, lowercase: true, trim: true },
    description: { type: String, required: true, trim: true },

    /* Stored in whole pounds. Keeping money as an integer avoids the floating
       point rounding that bites you the moment you start summing values. */
    price: { type: Number, required: true, min: 0 },
    listingType: { type: String, enum: ['sale', 'rent'], required: true, index: true },
    /* Only meaningful when listingType is "rent". */
    rentPeriod: { type: String, enum: ['month', 'week', null], default: null },

    propertyType: {
      type: String,
      enum: ['house', 'flat', 'bungalow', 'studio', 'land'],
      required: true,
      index: true,
    },
    bedrooms: { type: Number, required: true, min: 0, index: true },
    bathrooms: { type: Number, required: true, min: 0 },
    /* Square metres. */
    floorArea: { type: Number, min: 0, default: null },

    address: { type: addressSchema, required: true },
    location: { type: pointSchema, required: true },

    features: { type: [String], default: [] },
    images: { type: [String], default: [] },

    status: {
      type: String,
      enum: ['available', 'under-offer', 'sold', 'let'],
      default: 'available',
      index: true,
    },

    agent: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    featured: { type: Boolean, default: false },
    yearBuilt: { type: Number, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      /* Adapt at the boundary: the client sees `id`, never `_id` or `__v`. */
      transform(_doc, ret) {
        ret.id = ret._id
        delete ret._id
        delete ret.__v
        return ret
      },
    },
    toObject: { virtuals: true },
  }
)

/**
 * The 2dsphere index. Without this, $near and $geoWithin do not run slowly —
 * they throw. Mongoose declares it here but builds it in the background, which
 * is why the seed script calls syncIndexes() explicitly.
 */
listingSchema.index({ location: '2dsphere' })

/* Full-text search across the fields a buyer would actually type into a
   search box. Weights make a title match count more than a description match. */
listingSchema.index(
  { title: 'text', description: 'text', 'address.city': 'text', 'address.postcode': 'text' },
  { weights: { title: 10, 'address.city': 6, 'address.postcode': 6, description: 1 } }
)

/* The common filter combination, so the usual query reads one index. */
listingSchema.index({ listingType: 1, price: 1 })

/* Convenience for the UI — computed, never stored, so it can't go stale. */
listingSchema.virtual('pricePerSqm').get(function () {
  if (!this.floorArea || !this.price) return null
  return Math.round(this.price / this.floorArea)
})

listingSchema.virtual('latitude').get(function () {
  return this.location?.coordinates?.[1] ?? null
})

listingSchema.virtual('longitude').get(function () {
  return this.location?.coordinates?.[0] ?? null
})

/* Fill in the slug from the title when one wasn't supplied. Runs on validate
   rather than save so the `required`/`unique` checks see the final value. */
listingSchema.pre('validate', function (next) {
  if (!this.slug && this.title) this.slug = slugify(this.title)
  next()
})

/* A sale listing has no rent period. Enforced here so no route has to
   remember it. */
listingSchema.pre('save', function (next) {
  if (this.listingType === 'sale') this.rentPeriod = null
  else if (!this.rentPeriod) this.rentPeriod = 'month'
  next()
})

const Listing = mongoose.model('Listing', listingSchema)

export default Listing