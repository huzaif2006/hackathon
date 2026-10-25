const express = require('express')
const auditController = require('../controllers/audit.controller')
const { authorizeRoles } = require('../middleware/auth.middleware')
const asyncHandler = require('../utils/async-handler')

const router = express.Router()

router.use(authorizeRoles('admin'))
router.get('/', asyncHandler(auditController.list))

module.exports = router
