import mongoose from 'mongoose'

const { Schema } = mongoose

/* Human-readable booking reference, e.g. CV-7K2M9Q. Ambiguous characters
   (0/O, 1/I) are left out so people can read it over the phone. */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

function makeReference() {
  let out = ''
  for (let i = 0; i < 6; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return `CV-${out}`
}

export const VIEWING_STATUSES = ['requested', 'confirmed', 'declined', 'cancelled', 'completed']

/* The statuses that still occupy the slot. A cancelled viewing frees it. */
export const ACTIVE_STATUSES = ['requested', 'confirmed']

const viewingSchema = new Schema(
  {
    reference: { type: String, unique: true, index: true, uppercase: true, trim: true },

    listing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },

    /**
     * Copied from the listing at booking time, not looked up later.
     *
     * If the property is reassigned to another agent next month, this viewing
     * still belongs to the agent who agreed to it. Derive live data, copy
     * historical data.
     */
    agent: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    /* Also copied — the contact details as given for this booking, so editing
       a profile later doesn't rewrite past appointments. */
    contact: {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      phone: { type: String, trim: true, default: '' },
    },

    /* Stored as real Date objects, which Mongo keeps in UTC. Always compare
       instants in UTC; convert to local only when displaying. */
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: 30, min: 15 },

    status: { type: String, enum: VIEWING_STATUSES, default: 'requested', index: true },

    notes: { type: String, trim: true, default: '', maxlength: 500 },

    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    cancelReason: { type: String, trim: true, default: '' },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
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
 * THE IMPORTANT LINE IN THIS FILE.
 *
 * A unique index on (agent, startAt), applied only to viewings that still
 * occupy the slot. MongoDB itself now refuses a second booking for the same
 * agent at the same moment — the guarantee lives in the database, not in a
 * controller that might forget to check.
 *
 * `partialFilterExpression` is what makes it workable: a cancelled or declined
 * viewing falls outside the index, so the slot becomes bookable again without
 * deleting any history.
 */
viewingSchema.index(
  { agent: 1, startAt: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ACTIVE_STATUSES } },
  }
)

/* The agent's schedule view: their appointments in date order. */
viewingSchema.index({ agent: 1, startAt: 1, status: 1 })

viewingSchema.virtual('isPast').get(function () {
  return this.endAt ? this.endAt.getTime() < Date.now() : false
})

viewingSchema.virtual('isActive').get(function () {
  return ACTIVE_STATUSES.includes(this.status)
})

/* Fill in the reference and derive endAt from startAt + duration, so the two
   can never disagree. */
viewingSchema.pre('validate', function (next) {
  if (!this.reference) this.reference = makeReference()
  if (this.startAt && this.durationMinutes) {
    this.endAt = new Date(this.startAt.getTime() + this.durationMinutes * 60_000)
  }
  next()
})

const Viewing = mongoose.model('Viewing', viewingSchema)

export default Viewing