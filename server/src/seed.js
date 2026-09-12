import 'dotenv/config'
import mongoose from 'mongoose'

import { connectDB, syncIndexes } from './config/db.js'
import Listing from './models/Listing.js'
import User from './models/User.js'
import Viewing from './models/Viewing.js'

import { demoUsers } from './data/users.js'
import { listings } from './data/listings.js'
import { imagesFor } from './data/images.js'

const EARTH_RADIUS_KM = 6378.1
const kmToRadians = (km) => km / EARTH_RADIUS_KM

async function importData() {
  await Promise.all([Listing.deleteMany(), User.deleteMany(), Viewing.deleteMany()])
  console.log('Cleared existing data')

  /**
   * create() in a loop, NOT insertMany().
   *
   * insertMany bypasses Mongoose middleware, so the pre('save') bcrypt hook
   * never runs and every password goes into the database as plaintext. It is
   * a quiet trap — the seed succeeds, nothing warns you, and logging in fails
   * because bcrypt.compare is being handed a raw string.
   */
  const users = []
  for (const u of demoUsers) {
    users.push(await User.create(u))
  }
  console.log(`Created ${users.length} users`)

  /* email → ObjectId, so the data files never mention ObjectIds. */
  const agentByEmail = new Map(users.map((u) => [u.email, u._id]))

  const docs = listings.map(({ agentEmail, ...rest }, index) => {
    const agent = agentByEmail.get(agentEmail)
    if (!agent) throw new Error(`No user found for agentEmail "${agentEmail}"`)
    /* Photography is assigned here, not stored in listings.js — so the
       placeholder paths in that file are replaced, not appended to. */
    return { ...rest, agent, images: imagesFor(rest, index) }
  })

  /**
   * Listings CAN use insertMany — there is no save hook carrying security
   * weight here. But the pre('validate') slug hook doesn't run either, so
   * slugs have to be generated up front. Using create() in a loop keeps the
   * model as the single source of truth for slugs.
   */
  const created = []
  for (const doc of docs) {
    created.push(await Listing.create(doc))
  }
  console.log(`Created ${created.length} listings`)

  /**
   * Build the geospatial and text indexes explicitly.
   *
   * Mongoose declares them but builds them in the background, so there is a
   * window where a $geoWithin query runs against a collection that has no
   * 2dsphere index yet. For geospatial that isn't slow — it throws. Doing it
   * here means the indexes exist before anything queries them.
   */
  const indexed = await syncIndexes()
  console.log(`Built indexes for: ${indexed.join(', ')}`)

  await seedViewings(users, created)
}

/**
 * A handful of bookings so the agent dashboard isn't empty.
 *
 * Each one is placed on a day the agent actually works, at a time inside
 * their hours — so the data is consistent with what the availability
 * endpoint would offer, rather than impossible appointments that only exist
 * because the seed wrote them directly.
 */
async function seedViewings(users, createdListings) {
  const buyers = users.filter((u) => u.role === 'buyer')
  const agents = new Map(users.filter((u) => u.role === 'agent').map((a) => [String(a._id), a]))

  /* Walk forward from tomorrow to the nth day this agent works. */
  function nthWorkingDay(agent, n) {
    const now = new Date()
    let ms = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + 86_400_000
    let found = 0
    for (let i = 0; i < 40; i += 1) {
      if (agent.workingDays.includes(new Date(ms).getUTCDay())) {
        found += 1
        if (found === n) return ms
      }
      ms += 86_400_000
    }
    return null
  }

  /* Times that sit inside every demo agent's hours. */
  const hours = [11, 14]

  const plan = []
  let i = 0

  for (const listing of createdListings.filter((l) => l.status === 'available').slice(0, 6)) {
    const agent = agents.get(String(listing.agent))
    if (!agent) continue

    const dayMs = nthWorkingDay(agent, (i % 3) + 1)
    if (dayMs === null) continue

    const hour = hours[i % hours.length]
    const startAt = new Date(dayMs + hour * 3_600_000)

    plan.push({
      listing: listing._id,
      agent: agent._id,
      user: buyers[i % buyers.length]._id,
      contact: {
        name: buyers[i % buyers.length].name,
        email: buyers[i % buyers.length].email,
        phone: buyers[i % buyers.length].phone,
      },
      startAt,
      durationMinutes: agent.slotMinutes,
      status: i % 3 === 0 ? 'confirmed' : 'requested',
      notes: i % 2 === 0 ? 'Interested in the garden and the local schools.' : '',
    })

    i += 1
  }

  const made = []
  for (const v of plan) {
    /**
     * A try/catch per booking, because the unique index is live here too.
     *
     * If two seeded viewings land on the same agent at the same time, Mongo
     * rejects the second with code 11000. Skipping it is correct — the whole
     * point of the index is that a clash cannot be written, seed included.
     */
    try {
      made.push(await Viewing.create(v))
    } catch (err) {
      if (err.code === 11000) {
        console.log(`  skipped a clashing viewing at ${v.startAt.toISOString()}`)
      } else {
        throw err
      }
    }
  }

  console.log(`Created ${made.length} viewings`)
}

/**
 * Proves the seed worked by asking the questions the app will ask.
 *
 * A count of documents only proves rows exist. These queries prove the
 * indexes are built and the coordinates are the right way round — which is
 * the failure this project is most likely to have.
 */
async function verify() {
  console.log('\n--- verification ---')

  const total = await Listing.countDocuments()
  const visible = await Listing.countDocuments({ status: { $in: ['available', 'under-offer'] } })
  console.log(`listings: ${total} total, ${visible} visible in a default search`)

  /* Camden Town. A 3 km circle should catch north London and nothing south. */
  const camden = [-0.1426, 51.539]
  const near3 = await Listing.find({
    location: { $geoWithin: { $centerSphere: [camden, kmToRadians(3)] } },
  }).select('title address.postcode')

  console.log(`\nwithin 3 km of Camden Town: ${near3.length}`)
  near3.forEach((l) => console.log(`  ${l.address.postcode.padEnd(9)} ${l.title}`))

  const near15 = await Listing.countDocuments({
    location: { $geoWithin: { $centerSphere: [camden, kmToRadians(15)] } },
  })
  console.log(`within 15 km of Camden Town: ${near15}`)

  /* A rectangle over central and west London. */
  const box = {
    type: 'Polygon',
    coordinates: [
      [
        [-0.21, 51.48],
        [-0.08, 51.48],
        [-0.08, 51.56],
        [-0.21, 51.56],
        [-0.21, 51.48],
      ],
    ],
  }
  const inBox = await Listing.countDocuments({ location: { $geoWithin: { $geometry: box } } })
  console.log(`\ninside the test bounding box: ${inBox}`)

  /* The text index. */
  const textHits = await Listing.countDocuments({ $text: { $search: 'garden' } })
  console.log(`text search for "garden": ${textHits}`)

  /**
   * And confirm the photography actually got applied.
   *
   * Added because the first run of this seed reported "Created 24 listings"
   * while every image was still a placeholder path — a count proves rows
   * exist, not that they are right.
   */
  const withPhotos = await Listing.countDocuments({
    images: { $regex: '^https://images.unsplash.com/' },
  })
  const withPlaceholders = await Listing.countDocuments({ images: { $regex: '^/listings/' } })
  console.log(`\nlistings with real photos: ${withPhotos} / ${total}`)
  if (withPlaceholders > 0) {
    console.log(`WARNING: ${withPlaceholders} listings still have placeholder image paths`)
  }

  const sample = await Listing.findOne().select('title images')
  console.log(`sample: ${sample.title}`)
  sample.images.forEach((src) => console.log(`  ${src}`))

  /* And confirm the indexes are really there rather than merely declared. */
  const indexes = await Listing.collection.indexes()
  const names = indexes.map((ix) => ix.name)
  console.log(`\nlisting indexes: ${names.join(', ')}`)
  console.log(`2dsphere present: ${names.some((n) => n.includes('location'))}`)

  const viewingIndexes = await Viewing.collection.indexes()
  const partial = viewingIndexes.find((ix) => ix.unique && ix.partialFilterExpression)
  console.log(`viewing double-booking guard: ${partial ? partial.name : 'MISSING'}`)
}

async function destroyData() {
  await Promise.all([Listing.deleteMany(), User.deleteMany(), Viewing.deleteMany()])
  console.log('All collections emptied')
}

async function run() {
  try {
    await connectDB()

    if (process.argv.includes('--destroy')) {
      await destroyData()
    } else {
      await importData()
      await verify()
    }

    await mongoose.connection.close()
    process.exit(0)
  } catch (err) {
    console.error('\nSeed failed:', err.message)
    if (err.errors) {
      for (const [path, e] of Object.entries(err.errors)) {
        console.error(`  ${path}: ${e.message}`)
      }
    }
    process.exit(1)
  }
}

run()