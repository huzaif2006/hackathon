const express = require('express')
const aiController = require('../controllers/ai.controller')
const { authorizeRoles } = require('../middleware/auth.middleware')
const asyncHandler = require('../utils/async-handler')

const router = express.Router()

router.post('/chat', authorizeRoles('admin', 'hr', 'employee'), asyncHandler(aiController.chat))
router.post('/dashboard-summary', authorizeRoles('admin', 'hr'), asyncHandler(aiController.dashboardSummary))
router.post('/smart-leave', authorizeRoles('employee'), asyncHandler(aiController.smartLeave))

module.exports = router
