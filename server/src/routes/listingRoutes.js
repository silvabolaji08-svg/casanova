import { Router } from 'express'
import {
  listListings,
  listingPins,
  listingMeta,
  getListing,
  nearbyListings,
  myListings,
  createListing,
  updateListing,
  deleteListing,
} from '../controllers/listingController.js'
import { protect, optionalAuth, agentOnly } from '../middleware/auth.js'

const router = Router()

/**
 * ORDER MATTERS AND IT IS NOT OPTIONAL.
 *
 * Express matches routes top to bottom and stops at the first hit. `/:slug`
 * matches literally any single segment — including "pins", "meta" and
 * "mine". Declared after those, it would swallow them, and you'd get
 * "Property not found" for /api/listings/meta with nothing obviously wrong.
 *
 * Specific paths first. Always.
 */
router.get('/pins', listingPins)
router.get('/meta', listingMeta)
router.get('/mine', protect, agentOnly, myListings)
router.get('/nearby/:slug', nearbyListings)

router.route('/').get(listListings).post(protect, agentOnly, createListing)

/* optionalAuth, not protect — a guest sees the property, a signed-in user
   also learns whether they've saved it. */
router.get('/:slug', optionalAuth, getListing)

router
  .route('/:id')
  .put(protect, agentOnly, updateListing)
  .delete(protect, agentOnly, deleteListing)

export default router