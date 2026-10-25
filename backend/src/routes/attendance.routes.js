const express = require('express')
const attendanceController = require('../controllers/attendance.controller')
const { authorizeRoles } = require('../middleware/auth.middleware')
const asyncHandler = require('../utils/async-handler')

const router = express.Router()

router.post('/check-in', authorizeRoles('employee'), asyncHandler(attendanceController.checkIn))
router.post('/check-out', authorizeRoles('employee'), asyncHandler(attendanceController.checkOut))
router.get('/my', authorizeRoles('employee'), asyncHandler(attendanceController.myAttendance))
router.get('/board', authorizeRoles('admin', 'hr'), asyncHandler(attendanceController.board))
router.post('/corrections', authorizeRoles('employee'), asyncHandler(attendanceController.createCorrection))
router.get('/corrections', authorizeRoles('admin', 'hr', 'employee'), asyncHandler(attendanceController.corrections))
router.param('id', attendanceController.validateId)
router.post(
  '/corrections/:id/approve',
  authorizeRoles('hr'),
  asyncHandler(attendanceController.approveCorrection),
)
router.post(
  '/corrections/:id/reject',
  authorizeRoles('hr'),
  asyncHandler(attendanceController.rejectCorrection),
)

module.exports = router
