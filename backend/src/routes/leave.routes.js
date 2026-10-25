const express = require('express')
const leaveController = require('../controllers/leave.controller')
const { authorizeRoles } = require('../middleware/auth.middleware')
const asyncHandler = require('../utils/async-handler')

const router = express.Router()

router.post('/', authorizeRoles('employee'), asyncHandler(leaveController.create))
router.get('/balance', authorizeRoles('employee'), asyncHandler(leaveController.balance))
router.get('/my', authorizeRoles('employee'), asyncHandler(leaveController.mine))
router.get('/requests', authorizeRoles('admin', 'hr'), asyncHandler(leaveController.requests))
router.param('id', leaveController.validateId)
router.post('/:id/cancel', authorizeRoles('employee'), asyncHandler(leaveController.cancel))
router.post('/:id/approve', authorizeRoles('hr'), asyncHandler(leaveController.approve))
router.post('/:id/reject', authorizeRoles('hr'), asyncHandler(leaveController.reject))

module.exports = router
