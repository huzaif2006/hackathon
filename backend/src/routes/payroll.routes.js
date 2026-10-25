const express = require('express')
const payrollController = require('../controllers/payroll.controller')
const { authorizeRoles } = require('../middleware/auth.middleware')
const validateBody = require('../middleware/validate-request.middleware')
const asyncHandler = require('../utils/async-handler')
const { createRunSchema } = require('../utils/payroll-validation')

const router = express.Router()

router.get('/payslips/my', authorizeRoles('employee'), asyncHandler(payrollController.myPayslips))
router.get(
  '/payslips/:id/pdf',
  authorizeRoles('employee', 'hr', 'admin'),
  asyncHandler(payrollController.downloadPdf),
)
router.get('/runs', authorizeRoles('hr', 'admin'), asyncHandler(payrollController.listRuns))
router.post(
  '/runs',
  authorizeRoles('hr'),
  validateBody(createRunSchema),
  asyncHandler(payrollController.createRun),
)
router.param('id', payrollController.validateId)
router.get('/runs/:id', authorizeRoles('hr', 'admin'), asyncHandler(payrollController.getRun))
router.post(
  '/runs/:id/regenerate',
  authorizeRoles('hr'),
  asyncHandler(payrollController.regenerate),
)
router.post(
  '/runs/:id/finalize',
  authorizeRoles('admin'),
  asyncHandler(payrollController.finalize),
)

module.exports = router
