import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const { Schema } = mongoose

const userSchema = new Schema(
  {
    name: { type: String, required: [true, 'A name is required'], trim: true },
    email: {
      type: String,
      required: [true, 'An email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'That email address does not look valid'],
    },
    password: {
      type: String,
      required: [true, 'A password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      /* Never returned by a query unless explicitly asked for with
         .select('+password'). One line that makes leaking it by accident
         almost impossible. */
      select: false,
    },
    phone: { type: String, trim: true, default: '' },

    role: {
      type: String,
      enum: ['buyer', 'agent', 'admin'],
      default: 'buyer',
      index: true,
    },

    /* Buyers: the properties they've hearted. */
    savedListings: [{ type: Schema.Types.ObjectId, ref: 'Listing' }],

    /* Agents only. */
    agency: { type: String, trim: true, default: '' },
    bio: { type: String, trim: true, default: '' },
    avatar: { type: String, default: '' },

    /**
     * When this agent will show properties.
     *
     * Days are JavaScript's own numbering: 0 = Sunday, 6 = Saturday, so the
     * default [1,2,3,4,5] is Monday to Friday. Hours are local wall-clock
     * strings because "I work 9 to 6" is a statement about the clock on the
     * wall, not about a moment in time.
     */
    workingDays: { type: [Number], default: [1, 2, 3, 4, 5] },
    workingHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '18:00' },
    },
    /* How long one viewing takes, in minutes. Also the slot spacing. */
    slotMinutes: { type: Number, default: 30, min: 15 },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id
        delete ret._id
        delete ret.__v
        /* Belt and braces — select:false already prevents this, but a
           document built in memory could still carry it. */
        delete ret.password
        return ret
      },
    },
  }
)

/**
 * Hash the password before it is written.
 *
 * Living here rather than in a controller means no route can store plaintext,
 * including routes written a year from now by someone who forgot.
 */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
  next()
})

userSchema.methods.matchPassword = function (candidate) {
  return bcrypt.compare(candidate, this.password)
}

const User = mongoose.model('User', userSchema)

export default User