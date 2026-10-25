const express = require('express')
const setupController = require('../controllers/setup.controller')
const validateBody = require('../middleware/validate-request.middleware')
const asyncHandler = require('../utils/async-handler')
const { setupSchema } = require('../utils/auth-validation')

const router = express.Router()

router.get('/status', asyncHandler(setupController.getSetupStatus))
router.post('/', validateBody(setupSchema), asyncHandler(setupController.createSetup))

module.exports = router
