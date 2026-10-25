const bcrypt = require('bcryptjs')
const { randomBytes } = require('node:crypto')
const mongoose = require('mongoose')
const Company = require('../models/company.model')
const Department = require('../models/department.model')
const Designation = require('../models/designation.model')
const Holiday = require('../models/holiday.model')
const LeaveType = require('../models/leave-type.model')
const User = require('../models/user.model')
const AppError = require('../utils/app-error')
const auditService = require('./audit.service')

const referenceFields = {
  Department: 'department',
  Designation: 'designation',
  LeaveType: 'leaveType',
}

function toCompanySettings(company) {
  return {
    name: company.name,
    officeStart: company.officeStart,
    graceMinutes: company.graceMinutes,
    halfDayHours: company.halfDayHours,
    weekend: company.weekend,
    latitude: company.latitude,
    longitude: company.longitude,
    radiusMeters: company.radiusMeters,
    timezone: company.timezone || 'Asia/Karachi',
  }
}

async function getCompanySettings() {
  const company = await Company.findById('primary')
  if (!company) {
    throw new AppError(404, 'Company setup has not been completed')
  }

  return toCompanySettings(company)
}

async function getAttendancePolicy() {
  const settings = await getCompanySettings()
  return {
    officeStart: settings.officeStart,
    graceMinutes: settings.graceMinutes,
    halfDayHours: settings.halfDayHours,
    weekend: settings.weekend,
    timezone: settings.timezone,
  }
}

async function getLeaveTypes() {
  return listRecords(LeaveType)
}

async function updateCompanySettings(settings, actor) {
  const company = await Company.findById('primary')
  if (!company) {
    throw new AppError(404, 'Company setup has not been completed')
  }
  const before = toCompanySettings(company)
  Object.assign(company, settings)
  await company.save()
  const after = toCompanySettings(company)
  await auditService.logAction({
    actor,
    action: 'company.settings.update',
    entityType: 'Company',
    entityId: company.id,
    before,
    after,
  })
  return after
}

function listRecords(Model, sort = { name: 1 }) {
  return Model.find().sort(sort)
}

function getRecord(Model, id) {
  return Model.findById(id).orFail(new AppError(404, 'Record not found'))
}

async function createRecord(Model, data, actor) {
  const [record] = await Model.create([data])
  await auditService.logAction({
    actor,
    action: `${Model.modelName.toLowerCase()}.create`,
    entityType: Model.modelName,
    entityId: record.id,
    after: record,
  })
  return record
}

async function updateRecord(Model, id, data, actor) {
  const record = await getRecord(Model, id)
  const before = record.toObject()
  Object.assign(record, data)
  await record.save()
  await auditService.logAction({
    actor,
    action: `${Model.modelName.toLowerCase()}.update`,
    entityType: Model.modelName,
    entityId: record.id,
    before,
    after: record,
  })
  return record
}

async function recordIsInUse(Model, id) {
  const singular = referenceFields[Model.modelName]
  const references = []

  for (const RegisteredModel of mongoose.modelNames().map((name) => mongoose.model(name))) {
    if (RegisteredModel === Model) {
      continue
    }

    RegisteredModel.schema.eachPath((pathName, pathType) => {
      const referencedModel = pathType.options && pathType.options.ref
      const normalizedPath = pathName.toLowerCase()
      const referencesTarget = referencedModel === Model.modelName
        || normalizedPath === `${singular}id`
        || (referencedModel && normalizedPath === singular)

      if (referencesTarget) {
        references.push(RegisteredModel.exists({ [pathName]: id }))
      }
    })
  }

  const results = await Promise.all(references)
  return results.some(Boolean)
}

async function deleteRecord(Model, id, actor) {
  const record = await getRecord(Model, id)

  if (await recordIsInUse(Model, id)) {
    throw new AppError(409, 'This record is in use and cannot be deleted')
  }

  const before = record.toObject()
  await record.deleteOne()
  await auditService.logAction({
    actor,
    action: `${Model.modelName.toLowerCase()}.delete`,
    entityType: Model.modelName,
    entityId: record.id,
    before,
  })
}

function toPublicUser(user) {
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

async function createHrUser({ name, email }, actor) {
  const temporaryPassword = createTemporaryPassword()
  const passwordHash = await bcrypt.hash(temporaryPassword, 12)
  const user = await User.create({
    name,
    email,
    passwordHash,
    role: 'hr',
    isActive: true,
    mustChangePassword: true,
  })

  const publicUser = toPublicUser(user)
  await auditService.logAction({
    actor,
    action: 'hr-user.create',
    entityType: 'User',
    entityId: user.id,
    after: publicUser,
  })
  return { user: publicUser, temporaryPassword }
}

async function deactivateHrUser(id, actor) {
  const user = await User.findById(id).select('+tokenVersion')
  if (!user || user.role !== 'hr') {
    throw new AppError(404, 'HR user not found')
  }

  const before = toPublicUser(user)
  user.isActive = false
  user.tokenVersion = (user.tokenVersion || 0) + 1
  await user.save()
  const publicUser = toPublicUser(user)
  await auditService.logAction({
    actor,
    action: 'hr-user.deactivate',
    entityType: 'User',
    entityId: user.id,
    before,
    after: publicUser,
  })
  return publicUser
}

async function resetHrPassword(id, actor) {
  const user = await User.findById(id).select('+tokenVersion')
  if (!user || user.role !== 'hr') {
    throw new AppError(404, 'HR user not found')
  }

  const before = toPublicUser(user)
  const temporaryPassword = createTemporaryPassword()
  user.passwordHash = await bcrypt.hash(temporaryPassword, 12)
  user.mustChangePassword = true
  user.tokenVersion = (user.tokenVersion || 0) + 1
  await user.save()

  const publicUser = toPublicUser(user)
  await auditService.logAction({
    actor,
    action: 'hr-user.reset-password',
    entityType: 'User',
    entityId: user.id,
    before,
    after: publicUser,
  })
  return { user: publicUser, temporaryPassword }
}

async function getHrUsers() {
  const users = await User.find({ role: 'hr' }).sort({ name: 1 })
  return users.map(toPublicUser)
}

module.exports = {
  createHrUser,
  createRecord,
  deactivateHrUser,
  deleteRecord,
  getCompanySettings,
  getAttendancePolicy,
  getLeaveTypes,
  getHrUsers,
  getRecord,
  listRecords,
  resetHrPassword,
  updateCompanySettings,
  updateRecord,
}
