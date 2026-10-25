const express = require('express')
const authController = require('../controllers/auth.controller')
const {
  authenticate,
  requirePasswordChangeComplete,
} = require('../middleware/auth.middleware')
const validateBody = require('../middleware/validate-request.middleware')
const asyncHandler = require('../utils/async-handler')
const { changePasswordSchema, loginSchema } = require('../utils/auth-validation')
const loginRateLimit = require('../middleware/login-rate-limit.middleware')

const router = express.Router()

router.post('/login', loginRateLimit, validateBody(loginSchema), asyncHandler(authController.login))
router.get('/me', authenticate, asyncHandler(authController.getCurrentUser))
router.post(
  '/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  asyncHandler(authController.changePassword),
)
router.use(authenticate, requirePasswordChangeComplete)

module.exports = router
