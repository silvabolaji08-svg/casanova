import { Router } from 'express'
import {
  getAvailability,
  getAvailabilityRange,
  createViewing,
  myViewings,
  agentSchedule,
  getViewing,
  cancelViewing,
  setViewingStatus,
} from '../controllers/viewingController.js'
import { protect, agentOnly } from '../middleware/auth.js'

const router = Router()

/* Availability is public — someone should be able to see when a property can
   be viewed before deciding whether to create an account. */
router.get('/availability/range', getAvailabilityRange)
router.get('/availability', getAvailability)

/* Literal paths before /:reference, or "mine" and "schedule" get read as
   booking references. */
router.get('/mine', protect, myViewings)
router.get('/schedule', protect, agentOnly, agentSchedule)

router.post('/', protect, createViewing)

router.get('/:reference', protect, getViewing)
router.patch('/:reference/cancel', protect, cancelViewing)
router.patch('/:reference/status', protect, agentOnly, setViewingStatus)

export default router