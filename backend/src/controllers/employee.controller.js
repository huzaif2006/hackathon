const Department = require('../models/department.model')
const Designation = require('../models/designation.model')
const employeeService = require('../services/employee.service')
const AppError = require('../utils/app-error')
const {
  importQuerySchema,
  listQuerySchema,
  objectIdSchema,
  selfProfileSchema,
} = require('../utils/employee-validation')

function validateId(req, _res, next, id) {
  const result = objectIdSchema.safeParse(id)
  if (!result.success) {
    return next(new AppError(422, 'Employee ID is invalid'))
  }
  return next()
}

async function listEmployees(req, res) {
  const filters = listQuerySchema.safeParse(req.query)
  if (!filters.success) {
    throw new AppError(422, 'Employee filters are invalid')
  }
  res.json(await employeeService.listEmployees(filters.data))
}

async function registerEmployee(req, res) {
  const result = await employeeService.registerEmployee(req.body, req.user.userId)
  res.status(201).json(result)
}

async function getEmployee(req, res) {
  res.json({ employee: await employeeService.getEmployee(req.params.id, req.user) })
}

async function updateEmployee(req, res) {
  const body = req.body || {}
  if (
    req.user.role === 'employee'
    && Object.keys(body).some((field) => !['phone', 'address'].includes(field))
  ) {
    throw new AppError(403, 'Employees may only update their phone and address')
  }

  let fields = body
  if (req.user.role === 'employee') {
    const parsed = selfProfileSchema.safeParse(body)
    if (!parsed.success) {
      throw new AppError(422, 'Profile update is invalid')
    }
    fields = parsed.data
  }
  const employee = await employeeService.updateEmployee(req.params.id, fields, req.user)
  res.json({ employee })
}

async function getMyProfile(req, res) {
  if (!req.user.employeeId) {
    throw new AppError(403, 'Employee account has no linked employee record')
  }
  res.json({ employee: await employeeService.getEmployee(req.user.employeeId, req.user) })
}

async function updateMyProfile(req, res) {
  const body = req.body || {}
  if (!req.user.employeeId) {
    throw new AppError(403, 'Employee account has no linked employee record')
  }

  if (Object.keys(body).some((field) => !['phone', 'address'].includes(field))) {
    throw new AppError(403, 'Employees may only update their phone and address')
  }

  const parsed = selfProfileSchema.safeParse(body)
  if (!parsed.success) {
    throw new AppError(422, 'Profile update is invalid')
  }

  const employee = await employeeService.updateEmployee(req.user.employeeId, parsed.data, req.user)
  res.json({ employee })
}

async function deactivateEmployeeLogin(req, res) {
  res.json({ user: await employeeService.deactivateEmployeeLogin(req.params.id, req.user.userId) })
}

async function resetEmployeePassword(req, res) {
  res.json(await employeeService.resetEmployeePassword(req.params.id, req.user.userId))
}

async function exportEmployees(_req, res) {
  const csv = await employeeService.exportEmployees()
  res.type('text/csv')
    .attachment('employees.csv')
    .send(csv)
}

async function importEmployees(req, res) {
  const query = importQuerySchema.safeParse(req.query)
  if (!query.success) {
    throw new AppError(422, 'dryRun must be either true or false')
  }
  if (typeof req.body !== 'string') {
    throw new AppError(422, 'Upload a CSV file using the text/csv content type')
  }

  const result = await employeeService.importEmployees(req.body, query.data.dryRun === 'true', req.user.userId)
  res.status(query.data.dryRun === 'true' ? 200 : 201).json(result)
}

async function listDepartments(_req, res) {
  const departments = await Department.find().select('_id name').sort({ name: 1 }).lean()
  res.json({ items: departments })
}

async function listDesignations(_req, res) {
  const designations = await Designation.find().select('_id name').sort({ name: 1 }).lean()
  res.json({ items: designations })
}

module.exports = {
  deactivateEmployeeLogin,
  exportEmployees,
  getEmployee,
  getMyProfile,
  importEmployees,
  listDepartments,
  listDesignations,
  listEmployees,
  registerEmployee,
  resetEmployeePassword,
  updateEmployee,
  updateMyProfile,
  validateId,
}
