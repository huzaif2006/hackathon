const express = require('express')
const notificationController = require('../controllers/notification.controller')
const asyncHandler = require('../utils/async-handler')

const router = express.Router()

router.get('/', asyncHandler(notificationController.list))
router.post('/:id/read', asyncHandler(notificationController.markRead))

module.exports = router
