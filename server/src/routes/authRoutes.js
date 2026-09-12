import { Router } from 'express'
import {
  register,
  login,
  me,
  updateProfile,
  getSaved,
  toggleSaved,
} from '../controllers/authController.js'
import { protect } from '../middleware/auth.js'

const router = Router()

router.post('/register', register)
router.post('/login', login)

router.route('/me').get(protect, me).put(protect, updateProfile)

router.get('/saved', protect, getSaved)
router.post('/saved/:id', protect, toggleSaved)

export default router