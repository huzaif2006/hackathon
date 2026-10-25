const express = require('express')
const employeeController = require('../controllers/employee.controller')
const { authorizeRoles } = require('../middleware/auth.middleware')
const validateBody = require('../middleware/validate-request.middleware')
const asyncHandler = require('../utils/async-handler')
const {
  createEmployeeSchema,
  updateEmployeeSchema,
} = require('../utils/employee-validation')

const router = express.Router()

router.get('/departments', authorizeRoles('admin', 'hr'), asyncHandler(employeeController.listDepartments))
router.get('/designations', authorizeRoles('admin', 'hr'), asyncHandler(employeeController.listDesignations))

router.get('/my-profile', authorizeRoles('employee'), asyncHandler(employeeController.getMyProfile))
router.put('/my-profile', authorizeRoles('employee'), asyncHandler(employeeController.updateMyProfile))

router.get('/export', authorizeRoles('hr'), asyncHandler(employeeController.exportEmployees))
router.post(
  '/import',
  authorizeRoles('hr'),
  express.text({ type: ['text/csv', 'text/plain'], limit: '2mb' }),
  asyncHandler(employeeController.importEmployees),
)

router.get('/', authorizeRoles('admin', 'hr'), asyncHandler(employeeController.listEmployees))
router.post(
  '/',
  authorizeRoles('hr'),
  validateBody(createEmployeeSchema),
  asyncHandler(employeeController.registerEmployee),
)

router.param('id', employeeController.validateId)
router.get('/:id', authorizeRoles('admin', 'hr', 'employee'), asyncHandler(employeeController.getEmployee))
router.put(
  '/:id',
  authorizeRoles('hr', 'employee'),
  asyncHandler(employeeController.updateEmployee),
)
router.post(
  '/:id/deactivate',
  authorizeRoles('hr'),
  asyncHandler(employeeController.deactivateEmployeeLogin),
)
router.post(
  '/:id/reset-password',
  authorizeRoles('hr'),
  asyncHandler(employeeController.resetEmployeePassword),
)

module.exports = router
