const mongoose = require('mongoose')
const Company = require('../models/company.model')
const Department = require('../models/department.model')
const Employee = require('../models/employee.model')
const Holiday = require('../models/holiday.model')
const LeaveRequest = require('../models/leave-request.model')
const LeaveType = require('../models/leave-type.model')
const Notification = require('../models/notification.model')
const User = require('../models/user.model')
const AppError = require('../utils/app-error')
const { weekdayForDateKey } = require('../utils/timezone')
const auditService = require('./audit.service')

async function getEmployeeForUser(user) {
  if (!user.employeeId || !mongoose.isValidObjectId(user.employeeId)) {
    throw new AppError(403, 'Employee account has no linked employee record')
  }
  const employee = await Employee.findById(user.employeeId).select('_id department name')
  if (!employee) {
    throw new AppError(403, 'Employee account has no linked employee record')
  }
  return employee
}

async function getLeaveCalendar() {
  const [company, holidayDocs] = await Promise.all([
    Company.findById('primary'),
    Holiday.find().select('date'),
  ])
  if (!company) {
    throw new AppError(404, 'Company setup has not been completed')
  }
  return {
    weekend: company.weekend,
    holidays: holidayDocs.map((holiday) => holiday.date.toISOString().slice(0, 10)),
  }
}

function dateKeysBetween(startDate, endDate) {
  const dates = []
  const cursor = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(`${endDate}T00:00:00.000Z`)
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

function countWorkingDays(startDate, endDate, calendar) {
  const holidaySet = new Set(calendar.holidays)
  const dates = dateKeysBetween(startDate, endDate)
  return dates.filter((date) => (
    !calendar.weekend.includes(weekdayForDateKey(date))
    && !holidaySet.has(date)
  )).length
}

function calculateWorkingDays(startDate, endDate, calendar) {
  const holidaySet = new Set(calendar.holidays)
  const dates = dateKeysBetween(startDate, endDate)
  const workingDates = dates.filter((date) => (
    !calendar.weekend.includes(weekdayForDateKey(date))
    && !holidaySet.has(date)
  ))
  if (workingDates.length === 0) {
    throw new AppError(422, 'The selected dates contain no working days')
  }
  return {
    days: workingDates.length,
    yearlyDays: [...new Set(workingDates.map((date) => Number(date.slice(0, 4))))]
      .map((year) => ({
        year,
        days: workingDates.filter((date) => Number(date.slice(0, 4)) === year).length,
      })),
  }
}

async function findOverlap(employeeId, startDate, endDate, excludeId, session) {
  const filter = {
    employee: employeeId,
    status: { $in: ['pending', 'approved'] },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }
  let query = LeaveRequest.findOne(filter)
  if (session) query = query.session(session)
  return query
}

async function yearlyApprovedUsage(employeeId, leaveTypeId, year, calendar, session) {
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  let query = LeaveRequest.find({
    employee: employeeId,
    leaveType: leaveTypeId,
    status: 'approved',
    startDate: { $lte: yearEnd },
    endDate: { $gte: yearStart },
  })
  if (session) query = query.session(session)
  const approvedRequests = await query.select('startDate endDate days yearlyDays')

  return approvedRequests.reduce((used, request) => {
    const storedYear = request.yearlyDays.find((entry) => entry.year === year)
    if (storedYear) return used + storedYear.days
    if (request.yearlyDays.length) return used
    const overlapStart = request.startDate > yearStart ? request.startDate : yearStart
    const overlapEnd = request.endDate < yearEnd ? request.endDate : yearEnd
    return used + Math.min(request.days, countWorkingDays(overlapStart, overlapEnd, calendar))
  }, 0)
}

async function getLeaveBalance(user) {
  const employee = await getEmployeeForUser(user)
  const calendar = await getLeaveCalendar()
  const year = new Date().getUTCFullYear()
  const leaveTypes = await LeaveType.find().sort({ name: 1 })
  const balances = await Promise.all(leaveTypes.map(async (leaveType) => {
    const used = await yearlyApprovedUsage(employee.id, leaveType.id, year, calendar)
    const unlimited = leaveType.isUnlimited
    return {
      leaveType: {
        id: leaveType.id,
        name: leaveType.name,
        yearlyQuota: leaveType.yearlyQuota,
        isUnlimited: unlimited,
        isPaid: leaveType.isPaid,
      },
      quota: unlimited ? null : leaveType.yearlyQuota,
      used,
      remaining: unlimited ? null : Math.max(0, leaveType.yearlyQuota - used),
    }
  }))
  return { year, balances, calendar }
}

async function createLeaveRequest(user, data) {
  const employee = await getEmployeeForUser(user)
  const calendar = await getLeaveCalendar()
  const { days, yearlyDays } = calculateWorkingDays(data.startDate, data.endDate, calendar)
  const leaveType = await LeaveType.findById(data.leaveType)
  if (!leaveType) {
    throw new AppError(422, 'Selected leave type does not exist')
  }

  if (await findOverlap(employee.id, data.startDate, data.endDate)) {
    throw new AppError(422, 'Leave dates overlap a pending or approved leave request')
  }

  if (!leaveType.isUnlimited) {
    for (const yearly of yearlyDays) {
      const used = await yearlyApprovedUsage(employee.id, leaveType.id, yearly.year, calendar)
      if (used + yearly.days > leaveType.yearlyQuota) {
        throw new AppError(422, `Leave balance exceeded for ${yearly.year}: ${Math.max(0, leaveType.yearlyQuota - used)} day(s) remaining`)
      }
    }
  }

  const leaveRequest = await LeaveRequest.create({
    employee: employee.id,
    leaveType: leaveType.id,
    ...data,
    days,
    yearlyDays,
  })
  return { leaveRequest }
}

async function getMyLeave(user) {
  const employee = await getEmployeeForUser(user)
  const items = await LeaveRequest.find({ employee: employee.id })
    .populate('leaveType', 'name yearlyQuota isUnlimited isPaid')
    .populate('reviewedBy', 'name')
    .sort({ startDate: -1, createdAt: -1 })
  return { items }
}

async function cancelLeave(user, id) {
  const employee = await getEmployeeForUser(user)
  const leaveRequest = await LeaveRequest.findOne({ _id: id, employee: employee.id })
  if (!leaveRequest) {
    throw new AppError(404, 'Leave request not found')
  }
  if (leaveRequest.status !== 'pending') {
    throw new AppError(409, 'Only pending leave requests can be cancelled')
  }
  const before = leaveRequest.toObject()
  leaveRequest.status = 'cancelled'
  await leaveRequest.save()
  await auditService.logAction({
    actor: user.userId,
    action: 'leave.cancel',
    entityType: 'LeaveRequest',
    entityId: leaveRequest.id,
    before,
    after: leaveRequest,
  })
  return { leaveRequest }
}

async function getLeaveRequests({ status, department, page, limit }) {
  let employeeIds
  if (department) {
    if (!await Department.exists({ _id: department })) {
      throw new AppError(422, 'Department does not exist')
    }
    employeeIds = await Employee.find({ department }).distinct('_id')
  }

  const filter = {
    ...(status ? { status } : { status: 'pending' }),
    ...(department ? { employee: { $in: employeeIds } } : {}),
  }
  const [items, total] = await Promise.all([
    LeaveRequest.find(filter)
      .populate({ path: 'employee', select: 'name code department', populate: { path: 'department', select: 'name' } })
      .populate('leaveType', 'name yearlyQuota isUnlimited isPaid')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    LeaveRequest.countDocuments(filter),
  ])
  return {
    items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

async function notifyEmployee(employeeId, title, message, session) {
  const user = await User.findOne({ employeeId: String(employeeId), role: 'employee' })
    .select('_id')
    .session(session)
  if (user) {
    await Notification.create([{
      user: user.id,
      title,
      message,
    }], { session })
  }
}

async function reviewLeaveRequest(user, id, decision, comment) {
  const session = await mongoose.startSession()
  let result
  try {
    await session.withTransaction(async () => {
      const leaveRequest = await LeaveRequest.findById(id).session(session)
      if (!leaveRequest) {
        throw new AppError(404, 'Leave request not found')
      }
      if (leaveRequest.status !== 'pending') {
        throw new AppError(409, 'Leave request has already been reviewed')
      }
      const before = leaveRequest.toObject()

      if (decision === 'approved') {
        const overlap = await findOverlap(
          leaveRequest.employee,
          leaveRequest.startDate,
          leaveRequest.endDate,
          leaveRequest.id,
          session,
        )
        if (overlap) {
          throw new AppError(422, 'Leave dates overlap another pending or approved leave request')
        }

        const leaveType = await LeaveType.findById(leaveRequest.leaveType).session(session)
        if (!leaveType) {
          throw new AppError(422, 'Leave type no longer exists')
        }

        const calendar = await getLeaveCalendar()
        const { days, yearlyDays } = calculateWorkingDays(
          leaveRequest.startDate,
          leaveRequest.endDate,
          calendar,
        )
        if (!leaveType.isUnlimited) {
          for (const yearly of yearlyDays) {
            const used = await yearlyApprovedUsage(
              leaveRequest.employee,
              leaveType.id,
              yearly.year,
              calendar,
              session,
            )
            if (used + yearly.days > leaveType.yearlyQuota) {
              throw new AppError(422, `Leave balance exceeded for ${yearly.year}: ${Math.max(0, leaveType.yearlyQuota - used)} day(s) remaining`)
            }
          }
        }
        leaveRequest.days = days
        leaveRequest.yearlyDays = yearlyDays
      }

      leaveRequest.status = decision
      leaveRequest.reviewedBy = user.userId
      leaveRequest.reviewedAt = new Date()
      leaveRequest.reviewComment = comment
      await leaveRequest.save({ session })
      await notifyEmployee(
        leaveRequest.employee,
        `Leave request ${decision}`,
        `Your leave request from ${leaveRequest.startDate} to ${leaveRequest.endDate} was ${decision}.`,
        session,
      )
      await auditService.logAction({
        actor: user.userId,
        action: `leave.${decision}`,
        entityType: 'LeaveRequest',
        entityId: leaveRequest.id,
        before,
        after: leaveRequest,
        session,
      })
      result = leaveRequest
    })
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(409, 'Leave request was updated by another reviewer')
    }
    throw error
  } finally {
    await session.endSession()
  }
  return { leaveRequest: result }
}

module.exports = {
  cancelLeave,
  calculateWorkingDays,
  createLeaveRequest,
  countWorkingDays,
  getLeaveBalance,
  getLeaveRequests,
  getMyLeave,
  reviewLeaveRequest,
}
