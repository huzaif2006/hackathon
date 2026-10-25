const express = require('express')
const analyticsController = require('../controllers/analytics.controller')
const { authorizeRoles } = require('../middleware/auth.middleware')
const asyncHandler = require('../utils/async-handler')

const router = express.Router()

router.get('/hr', authorizeRoles('admin', 'hr'), asyncHandler(analyticsController.hrDashboard))
router.get('/admin', authorizeRoles('admin'), asyncHandler(analyticsController.adminDashboard))
router.get('/employee', authorizeRoles('employee'), asyncHandler(analyticsController.employeeDashboard))

module.exports = router
