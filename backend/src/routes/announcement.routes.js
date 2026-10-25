const express = require('express')
const announcementController = require('../controllers/announcement.controller')
const { authorizeRoles } = require('../middleware/auth.middleware')
const asyncHandler = require('../utils/async-handler')

const router = express.Router()

router.get('/', asyncHandler(announcementController.list))
router.post('/', authorizeRoles('admin', 'hr'), asyncHandler(announcementController.create))

module.exports = router
