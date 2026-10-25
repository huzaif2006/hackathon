const express = require('express')
const Company = require('../models/company.model')
const Department = require('../models/department.model')
const Designation = require('../models/designation.model')
const Holiday = require('../models/holiday.model')
const LeaveType = require('../models/leave-type.model')
const companyController = require('../controllers/company-settings.controller')
const hrUserController = require('../controllers/hr-user.controller')
const { createCrudController } = require('../controllers/organization.controller')
const { authorizeRoles } = require('../middleware/auth.middleware')
const validateBody = require('../middleware/validate-request.middleware')
const AppError = require('../utils/app-error')
const asyncHandler = require('../utils/async-handler')
const {
  companySettingsSchema,
  departmentSchema,
  designationSchema,
  holidaySchema,
  hrUserSchema,
  idSchema,
  leaveTypeSchema,
} = require('../utils/organization-validation')

const router = express.Router()

router.use(authorizeRoles('admin', 'hr'))

router.route('/company')
  .get(asyncHandler(companyController.getCompanySettings))
  .put(
    authorizeRoles('admin'),
    validateBody(companySettingsSchema),
    asyncHandler(companyController.updateCompanySettings),
  )

function addCrudRoutes(path, Model, schema) {
  const controller = createCrudController(Model)
  router.route(path)
    .get(asyncHandler(controller.list))
    .post(
      authorizeRoles('admin'),
      validateBody(schema),
      asyncHandler(controller.create),
    )
  router.route(`${path}/:id`)
    .put(
      authorizeRoles('admin'),
      validateBody(schema),
      asyncHandler(controller.update),
    )
    .delete(
      authorizeRoles('admin'),
      asyncHandler(controller.remove),
    )
}

router.param('id', (req, _res, next, id) => {
  const result = idSchema.safeParse(id)
  if (!result.success) {
    return next(new AppError(422, 'Record ID is invalid'))
  }
  return next()
})

addCrudRoutes('/departments', Department, departmentSchema)
addCrudRoutes('/designations', Designation, designationSchema)
addCrudRoutes('/leave-types', LeaveType, leaveTypeSchema)
addCrudRoutes('/holidays', Holiday, holidaySchema)

router.route('/hr-users')
  .get(authorizeRoles('admin'), asyncHandler(hrUserController.getHrUsers))
  .post(
    authorizeRoles('admin'),
    validateBody(hrUserSchema),
    asyncHandler(hrUserController.createHrUser),
  )
router.post('/hr-users/:id/deactivate', authorizeRoles('admin'), asyncHandler(hrUserController.deactivateHrUser))
router.post('/hr-users/:id/reset-password', authorizeRoles('admin'), asyncHandler(hrUserController.resetHrPassword))

module.exports = router
