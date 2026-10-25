const bcrypt = require('bcryptjs')
const { randomBytes } = require('node:crypto')
const mongoose = require('mongoose')
const Department = require('../models/department.model')
const Designation = require('../models/designation.model')
const Employee = require('../models/employee.model')
const User = require('../models/user.model')
const AppError = require('../utils/app-error')
const { parseCsv, stringifyCsv } = require('../utils/csv')
const { createEmployeeSchema, isoDateSchema } = require('../utils/employee-validation')
const auditService = require('./audit.service')

const employeeCsvHeaders = [
  'code',
  'name',
  'email',
  'phone',
  'address',
  'gender',
  'department',
  'designation',
  'joinDate',
  'status',
  'exitDate',
  'basicSalary',
]

function toEmployeeDto(employee, { includeSalary = true } = {}) {
  const item = employee.toObject ? employee.toObject() : employee
  const result = {
    _id: String(item._id),
    code: item.code,
    name: item.name,
    email: item.email,
    phone: item.phone,
    address: item.address,
    gender: item.gender,
    department: item.department,
    designation: item.designation,
    joinDate: item.joinDate,
    status: item.status,
    exitDate: item.exitDate || null,
  }

  if (includeSalary) {
    result.basicSalary = item.basicSalary
  }

  return result
}

function toPublicEmployeeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  }
}

function createTemporaryPassword() {
  return randomBytes(18).toString('base64url')
}

function mapEmployeeInput(input) {
  const values = { ...input }
  if (values.code) values.code = values.code.toUpperCase()
  if (values.email) values.email = values.email.toLowerCase()
  if (values.joinDate) values.joinDate = new Date(`${values.joinDate}T00:00:00.000Z`)
  if (values.exitDate) values.exitDate = new Date(`${values.exitDate}T00:00:00.000Z`)
  return {
    ...values,
  }
}

async function withTransaction(operation) {
  const session = await mongoose.startSession()
  try {
    let result
    await session.withTransaction(async () => {
      result = await operation(session)
    })
    return result
  } finally {
    await session.endSession()
  }
}

async function createEmployeeWithLogin(input, session, actor) {
  const parsed = createEmployeeSchema.safeParse({
    ...input,
    ...(input.exitDate === '' ? { exitDate: undefined } : {}),
  })
  if (!parsed.success) {
    throw new AppError(422, 'Employee data is invalid')
  }

  const values = mapEmployeeInput(parsed.data)
  const existingEmployee = await Employee.findOne({
    $or: [{ code: values.code }, { email: values.email }],
  }).session(session)
  const existingUser = await User.findOne({ email: values.email }).session(session)
  if (existingEmployee) {
    throw new AppError(409, existingEmployee.code === values.code
      ? 'Employee code already exists'
      : 'Employee email already exists')
  }
  if (existingUser) {
    throw new AppError(409, 'An account with this email already exists')
  }

  const department = await Department.findById(values.department).session(session)
  const designation = await Designation.findById(values.designation).session(session)
  if (!department || !designation) {
    throw new AppError(422, 'Select a valid department and designation')
  }

  const temporaryPassword = createTemporaryPassword()
  const passwordHash = await bcrypt.hash(temporaryPassword, 12)
  const employee = new Employee(values)
  await employee.save({ session })

  const user = new User({
    name: employee.name,
    email: employee.email,
    passwordHash,
    role: 'employee',
    employeeId: employee.id,
    isActive: true,
    mustChangePassword: true,
  })
  await user.save({ session })
  await auditService.logAction({
    actor,
    action: 'employee.register',
    entityType: 'Employee',
    entityId: employee.id,
    after: employee,
    session,
  })

  return {
    employee: toEmployeeDto(employee),
    user: toPublicEmployeeUser(user),
    temporaryPassword,
  }
}

async function registerEmployee(input, actor) {
  return withTransaction((session) => createEmployeeWithLogin(input, session, actor))
}

async function listEmployees(filters) {
  const query = {}
  if (filters.search) {
    const search = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    query.$or = [{ name: search }, { code: search }, { email: search }]
  }
  if (filters.department) {
    query.department = filters.department
  }
  if (filters.status) {
    query.status = filters.status
  }

  const skip = (filters.page - 1) * filters.limit
  const [items, total] = await Promise.all([
    Employee.find(query)
      .populate('department', 'name')
      .populate('designation', 'name')
      .sort({ name: 1, _id: 1 })
      .skip(skip)
      .limit(filters.limit)
      .lean(),
    Employee.countDocuments(query),
  ])

  return {
    items: items.map((item) => toEmployeeDto(item)),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      pages: Math.ceil(total / filters.limit),
    },
  }
}

async function getEmployee(id, user) {
  const employee = await Employee.findById(id)
    .populate('department', 'name')
    .populate('designation', 'name')
    .lean()

  if (!employee) {
    throw new AppError(404, 'Employee not found')
  }

  if (user.role === 'employee' && user.employeeId !== String(employee._id)) {
    throw new AppError(403, 'You cannot access another employee profile')
  }

  return toEmployeeDto(employee, { includeSalary: user.role !== 'employee' })
}

async function updateEmployee(id, input, user) {
  if (user.role === 'employee') {
    if (user.employeeId !== id) {
      throw new AppError(403, 'You cannot edit another employee profile')
    }
    const fields = Object.keys(input)
    if (fields.some((field) => !['phone', 'address'].includes(field))) {
      throw new AppError(403, 'Employees may only update their phone and address')
    }

    const before = await Employee.findById(id).lean()
    if (!before) throw new AppError(404, 'Employee not found')
    const employee = await Employee.findByIdAndUpdate(id, input, {
      returnDocument: 'after',
      runValidators: true,
    })
      .populate('department', 'name')
      .populate('designation', 'name')
      .lean()
    if (!employee) {
      throw new AppError(404, 'Employee not found')
    }
    await auditService.logAction({
      actor: user.userId,
      action: 'employee.update',
      entityType: 'Employee',
      entityId: id,
      before,
      after: employee,
    })
    return toEmployeeDto(employee, { includeSalary: false })
  }

  const session = await mongoose.startSession()
  try {
    let result
    await session.withTransaction(async () => {
      const employee = await Employee.findById(id).session(session)
      if (!employee) {
        throw new AppError(404, 'Employee not found')
      }

      const before = employee.toObject()
      const parsed = createEmployeeSchema.partial().strict().safeParse({
        ...input,
        ...(input.exitDate === '' ? { exitDate: undefined } : {}),
      })
      if (!parsed.success || Object.keys(parsed.data).length === 0) {
        throw new AppError(422, 'Employee update is invalid')
      }

      const fields = mapEmployeeInput(parsed.data)
      if (fields.department && !(await Department.findById(fields.department).session(session))) {
        throw new AppError(422, 'Select a valid department')
      }
      if (fields.designation && !(await Designation.findById(fields.designation).session(session))) {
        throw new AppError(422, 'Select a valid designation')
      }

      Object.assign(employee, fields)
      await employee.save({ session })

      if (fields.name || fields.email) {
        const account = await User.findOne({ employeeId: employee.id }).session(session)
        if (account) {
          if (fields.name) account.name = fields.name
          if (fields.email) account.email = fields.email
          await account.save({ session })
        }
      }

      const updatedEmployee = await Employee.findById(employee.id)
        .populate('department', 'name')
        .populate('designation', 'name')
        .session(session)
        .lean()
      await auditService.logAction({
        actor: user.userId,
        action: fields.basicSalary !== undefined ? 'employee.salary.update' : 'employee.update',
        entityType: 'Employee',
        entityId: employee.id,
        before,
        after: updatedEmployee,
        session,
      })
      result = toEmployeeDto(updatedEmployee)
    })
    return result
  } finally {
    await session.endSession()
  }
}

async function deactivateEmployeeLogin(id, actor) {
  const employee = await Employee.findById(id).lean()
  if (!employee) {
    throw new AppError(404, 'Employee not found')
  }
  const user = await User.findOne({ employeeId: String(employee._id), role: 'employee' }).select('+tokenVersion')
  if (!user) {
    throw new AppError(404, 'Employee login not found')
  }
  const before = toPublicEmployeeUser(user)
  user.isActive = false
  user.tokenVersion = (user.tokenVersion || 0) + 1
  await user.save()
  const publicUser = toPublicEmployeeUser(user)
  await auditService.logAction({
    actor,
    action: 'employee-login.deactivate',
    entityType: 'User',
    entityId: user.id,
    before,
    after: publicUser,
  })
  return publicUser
}

async function resetEmployeePassword(id, actor) {
  const employee = await Employee.findById(id).lean()
  if (!employee) {
    throw new AppError(404, 'Employee not found')
  }
  const user = await User.findOne({ employeeId: String(employee._id), role: 'employee' })
    .select('+passwordHash +tokenVersion')
  if (!user) {
    throw new AppError(404, 'Employee login not found')
  }
  const before = toPublicEmployeeUser(user)
  const temporaryPassword = createTemporaryPassword()
  user.passwordHash = await bcrypt.hash(temporaryPassword, 12)
  user.mustChangePassword = true
  user.tokenVersion = (user.tokenVersion || 0) + 1
  await user.save()
  const publicUser = toPublicEmployeeUser(user)
  await auditService.logAction({
    actor,
    action: 'employee-login.reset-password',
    entityType: 'User',
    entityId: user.id,
    before,
    after: publicUser,
  })
  return { user: publicUser, temporaryPassword }
}

function makeExportRow(employee) {
  const row = {
    ...employee,
    department: employee.department && employee.department.name,
    designation: employee.designation && employee.designation.name,
    joinDate: employee.joinDate.toISOString().slice(0, 10),
    exitDate: employee.exitDate ? employee.exitDate.toISOString().slice(0, 10) : '',
  }
  return row
}

async function exportEmployees() {
  const employees = await Employee.find()
    .populate('department', 'name')
    .populate('designation', 'name')
    .sort({ name: 1 })
    .lean()

  const rows = employees.map((employee) => makeExportRow(toEmployeeDto(employee)))
  return stringifyCsv(employeeCsvHeaders, rows)
}

function validateCsvRows(parsed, knownDepartments, knownDesignations, existingCodes, existingEmails) {
  const errors = []
  const seenCodes = new Set()
  const seenEmails = new Set()
  const valid = []
  const required = ['code', 'name', 'email', 'gender', 'department', 'designation', 'joinDate', 'basicSalary']
  const requiredHeaders = ['code', 'name', 'email', 'gender', 'department', 'designation', 'joinDate', 'basicSalary']

  if (parsed.headers.length === 0) {
    return { errors: [{ row: 1, field: 'header', reason: 'CSV is empty' }], valid, totalRows: 0 }
  }

  for (const header of requiredHeaders) {
    if (!parsed.headers.includes(header)) {
      errors.push({ row: 1, field: header, reason: 'Required column is missing' })
    }
  }
  for (const header of parsed.headers) {
    if (!employeeCsvHeaders.includes(header)) {
      errors.push({ row: 1, field: header, reason: 'Unexpected column' })
    }
  }

  for (const entry of parsed.rows) {
    const { rowNumber, values } = entry
    const rowErrorFields = new Set()
    const addRowError = (field, reason) => {
      errors.push({ row: rowNumber, field, reason })
      rowErrorFields.add(field)
    }

    if (entry.extraColumn) {
      addRowError('row', 'Unexpected extra column')
    }

    for (const field of required) {
      if (!values[field]) {
        addRowError(field, 'Required value is missing')
      }
    }

    const code = values.code && values.code.toUpperCase()
    const email = values.email && values.email.toLowerCase()
    if (code && (existingCodes.has(code) || seenCodes.has(code))) {
      addRowError('code', 'Employee code already exists')
    }
    if (email && (existingEmails.has(email) || seenEmails.has(email))) {
      addRowError('email', 'Email already exists')
    }
    if (code) seenCodes.add(code)
    if (email) seenEmails.add(email)

    if (values.email && !createEmployeeSchema.shape.email.safeParse(values.email).success) {
      addRowError('email', 'Must be a valid email address')
    }
    if (values.department && !knownDepartments.has(values.department.toLowerCase())) {
      addRowError('department', 'Department was not found')
    }
    if (values.designation && !knownDesignations.has(values.designation.toLowerCase())) {
      addRowError('designation', 'Designation was not found')
    }
    if (values.joinDate && !isoDateSchema.safeParse(values.joinDate).success) {
      addRowError('joinDate', 'Must be a valid ISO date (YYYY-MM-DD)')
    }
    if (values.exitDate && !isoDateSchema.safeParse(values.exitDate).success) {
      addRowError('exitDate', 'Must be a valid ISO date (YYYY-MM-DD)')
    }
    if (values.basicSalary && (!Number.isFinite(Number(values.basicSalary)) || Number(values.basicSalary) <= 0)) {
      addRowError('basicSalary', 'Salary must be greater than zero')
    }
    if (values.gender && !['male', 'female', 'other'].includes(values.gender.toLowerCase())) {
      addRowError('gender', 'Must be male, female, or other')
    }
    if (values.status && !['active', 'probation', 'exited'].includes(values.status.toLowerCase())) {
      addRowError('status', 'Must be active, probation, or exited')
    }

    const department = knownDepartments.get((values.department || '').toLowerCase())
    const designation = knownDesignations.get((values.designation || '').toLowerCase())
    if (department && designation) {
      const { exitDate, ...valuesWithoutExitDate } = values
      const candidate = {
        ...valuesWithoutExitDate,
        gender: values.gender && values.gender.toLowerCase(),
        status: values.status ? values.status.toLowerCase() : 'active',
        department: String(department._id),
        designation: String(designation._id),
        basicSalary: Number(values.basicSalary),
        ...(exitDate ? { exitDate } : {}),
      }
      const parsedEmployee = createEmployeeSchema.safeParse(candidate)
      if (!parsedEmployee.success) {
        for (const issue of parsedEmployee.error.issues) {
          const field = String(issue.path[0] || 'row')
          if (!rowErrorFields.has(field)) {
            addRowError(field, issue.message)
          }
        }
      } else if (rowErrorFields.size === 0) {
        valid.push({ row: rowNumber, employee: parsedEmployee.data })
      }
    }
  }

  return { errors, valid, totalRows: parsed.rows.length }
}

async function validateEmployeeImport(csvText) {
  let parsed
  try {
    parsed = parseCsv(csvText)
  } catch (error) {
    return { errors: [{ row: 1, field: 'csv', reason: error.message }], valid: [], totalRows: 0 }
  }

  const [departments, designations, existing, existingUsers] = await Promise.all([
    Department.find().select('_id name').lean(),
    Designation.find().select('_id name').lean(),
    Employee.find({}, { code: 1, email: 1 }).lean(),
    User.find({}, { email: 1 }).lean(),
  ])
  const knownDepartments = new Map(departments.map((item) => [item.name.toLowerCase(), item]))
  const knownDesignations = new Map(designations.map((item) => [item.name.toLowerCase(), item]))
  const existingCodes = new Set(existing.map((employee) => employee.code.toUpperCase()))
  const existingEmails = new Set([
    ...existing.map((employee) => employee.email.toLowerCase()),
    ...existingUsers.map((user) => user.email.toLowerCase()),
  ])

  return validateCsvRows(parsed, knownDepartments, knownDesignations, existingCodes, existingEmails)
}

async function importEmployees(csvText, dryRun, actor) {
  const validation = await validateEmployeeImport(csvText)
  const totalRows = validation.totalRows

  if (dryRun) {
    return {
      dryRun: true,
      totalRows,
      validRows: validation.valid.length,
      errors: validation.errors,
    }
  }

  if (validation.errors.length > 0) {
    throw new AppError(422, 'CSV contains invalid rows', {
      errors: validation.errors,
      totalRows,
      validRows: validation.valid.length,
    })
  }

  const created = await withTransaction(async (session) => {
    const results = []
    for (const row of validation.valid) {
      results.push(await createEmployeeWithLogin(row.employee, session, actor))
    }
    return results
  })

  return { dryRun: false, created }
}

module.exports = {
  deactivateEmployeeLogin,
  exportEmployees,
  getEmployee,
  importEmployees,
  listEmployees,
  registerEmployee,
  resetEmployeePassword,
  updateEmployee,
}
