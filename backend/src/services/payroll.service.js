const mongoose = require('mongoose')
const Attendance = require('../models/attendance.model')
const Company = require('../models/company.model')
const Employee = require('../models/employee.model')
const Holiday = require('../models/holiday.model')
const LeaveRequest = require('../models/leave-request.model')
const PayrollItem = require('../models/payroll-item.model')
const PayrollRun = require('../models/payroll-run.model')
const Notification = require('../models/notification.model')
const User = require('../models/user.model')
const AppError = require('../utils/app-error')
const { weekdayForDateKey } = require('../utils/timezone')
const auditService = require('./audit.service')

function monthDates(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return Array.from({ length: daysInMonth }, (_, index) => (
    `${year}-${String(monthNumber).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`
  ))
}

function dateKey(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function calculateAnnualTax(annualGross) {
  if (annualGross <= 600000) return 0
  if (annualGross <= 1200000) return roundMoney((annualGross - 600000) * 0.05)
  if (annualGross <= 2400000) return roundMoney(30000 + (annualGross - 1200000) * 0.15)
  if (annualGross <= 3600000) return roundMoney(210000 + (annualGross - 2400000) * 0.25)
  return roundMoney(510000 + (annualGross - 3600000) * 0.35)
}

function getEmploymentDates(employee, dates) {
  const joinDate = dateKey(employee.joinDate)
  const exitDate = employee.exitDate ? dateKey(employee.exitDate) : dates[dates.length - 1]
  const first = dates[0]
  const last = dates[dates.length - 1]
  return {
    start: joinDate > first ? joinDate : first,
    end: exitDate < last ? exitDate : last,
  }
}

function isWorkingDate(date, weekend, holidays) {
  return !weekend.includes(weekdayForDateKey(date)) && !holidays.has(date)
}

function computeEmployeePayroll(employee, run, dates, workingDates, attendanceByDate, approvedLeaves) {
  const { start, end } = getEmploymentDates(employee, dates)
  const employmentWorkingDates = start <= end
    ? workingDates.filter((date) => date >= start && date <= end)
    : []
  const eligibleDates = new Set(employmentWorkingDates)
  const unpaidLeaveDates = new Set()
  for (const leave of approvedLeaves) {
    if (!leave.leaveType || leave.leaveType.isPaid) continue
    for (const date of dates) {
      if (eligibleDates.has(date) && date >= leave.startDate && date <= leave.endDate) {
        unpaidLeaveDates.add(date)
      }
    }
  }

  let absentDays = 0
  let halfDays = 0
  for (const date of employmentWorkingDates) {
    const record = attendanceByDate.get(date)
    if (!record && !approvedLeaves.some((leave) => leave.startDate <= date && leave.endDate >= date)) {
      absentDays += 1
    }
    if (record && record.status === 'half_day') {
      halfDays += 1
    }
  }

  const fullBasic = roundMoney(employee.basicSalary)
  const fullHra = roundMoney(fullBasic * 0.4)
  const fullMedical = roundMoney(fullBasic * 0.1)
  const fullGross = roundMoney(fullBasic + fullHra + fullMedical)
  const workingDayCount = workingDates.length
  const daysPayable = employmentWorkingDates.length
  const prorateFactor = workingDayCount ? daysPayable / workingDayCount : 0
  const basic = roundMoney(fullBasic * prorateFactor)
  const hra = roundMoney(fullHra * prorateFactor)
  const medical = roundMoney(fullMedical * prorateFactor)
  const gross = roundMoney(basic + hra + medical)
  const perDay = workingDayCount ? fullGross / workingDayCount : 0
  const deduction = roundMoney(
    (absentDays + unpaidLeaveDates.size + (0.5 * halfDays)) * perDay,
  )
  const annualTax = calculateAnnualTax(fullGross * 12)
  const monthlyTax = roundMoney(annualTax / 12)
  const netPay = roundMoney(gross - deduction - monthlyTax)

  return {
    run: run.id,
    employee: employee.id,
    basic,
    hra,
    medical,
    gross,
    workingDays: workingDayCount,
    absentDays,
    unpaidLeaveDays: unpaidLeaveDates.size,
    halfDays,
    deduction,
    annualTax,
    monthlyTax,
    netPay,
    daysPayable,
    employeeSnapshot: {
      name: employee.name,
      code: employee.code,
      department: employee.department?.name || '',
      designation: employee.designation?.name || '',
    },
  }
}

async function loadPayrollInputs(month, session) {
  const [company, holidayDocs] = await Promise.all([
    Company.findById('primary').session(session),
    Holiday.find().select('date').session(session),
  ])
  if (!company) {
    throw new AppError(404, 'Company setup has not been completed')
  }
  const dates = monthDates(month)
  const holidays = new Set(holidayDocs.map((holiday) => dateKey(holiday.date)))
  const workingDates = dates.filter((date) => isWorkingDate(date, company.weekend, holidays))
  if (workingDates.length === 0) {
    throw new AppError(422, 'The selected month has no working days')
  }

  const monthStart = dates[0]
  const monthEnd = dates[dates.length - 1]
  const employees = await Employee.find({
    joinDate: { $lte: new Date(`${monthEnd}T23:59:59.999Z`) },
    $or: [
      { status: { $in: ['active', 'probation'] } },
      {
        status: 'exited',
        exitDate: {
          $gte: new Date(`${monthStart}T00:00:00.000Z`),
          $lte: new Date(`${monthEnd}T23:59:59.999Z`),
        },
      },
    ],
  })
    .populate('department', 'name')
    .populate('designation', 'name')
    .session(session)

  const employeeIds = employees.map((employee) => employee.id)
  const attendance = await Attendance.find({
    employee: { $in: employeeIds },
    date: { $in: dates },
  }).session(session)
  const leaves = await LeaveRequest.find({
    employee: { $in: employeeIds },
    status: 'approved',
    startDate: { $lte: monthEnd },
    endDate: { $gte: monthStart },
  }).populate('leaveType', 'isPaid').session(session)

  const attendanceByEmployee = new Map()
  for (const record of attendance) {
    const employeeId = String(record.employee)
    if (!attendanceByEmployee.has(employeeId)) attendanceByEmployee.set(employeeId, new Map())
    attendanceByEmployee.get(employeeId).set(record.date, record)
  }
  const leavesByEmployee = new Map()
  for (const leave of leaves) {
    const employeeId = String(leave.employee)
    if (!leavesByEmployee.has(employeeId)) leavesByEmployee.set(employeeId, [])
    leavesByEmployee.get(employeeId).push(leave)
  }

  return {
    company,
    dates,
    workingDates,
    employees,
    attendanceByEmployee,
    leavesByEmployee,
    calendar: { weekend: company.weekend, holidays },
  }
}

async function buildItems(run, session) {
  const input = await loadPayrollInputs(run.month, session)
  const documents = input.employees.map((employee) => computeEmployeePayroll(
    employee,
    run,
    input.dates,
    input.workingDates,
    input.attendanceByEmployee.get(employee.id) || new Map(),
    input.leavesByEmployee.get(employee.id) || [],
    input.calendar,
  ))
  if (documents.length) {
    await PayrollItem.insertMany(documents, { session })
  }
  return documents.length
}

async function createPayrollRun(user, month) {
  const session = await mongoose.startSession()
  let result
  try {
    await session.withTransaction(async () => {
      const [existing] = await PayrollRun.create([{
        month,
        status: 'draft',
        createdBy: user.userId,
      }], { session })
      await buildItems(existing, session)
      await auditService.logAction({
        actor: user.userId,
        action: 'payroll-run.create',
        entityType: 'PayrollRun',
        entityId: existing.id,
        after: existing,
        session,
      })
      result = existing
    })
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(409, 'A payroll run already exists for this month')
    }
    throw error
  } finally {
    await session.endSession()
  }
  return getPayrollRun(result.id)
}

async function regeneratePayrollRun(id, user) {
  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      const run = await PayrollRun.findById(id).session(session)
      if (!run) throw new AppError(404, 'Payroll run not found')
      if (run.status === 'finalized') {
        throw new AppError(409, 'Finalized payroll runs are locked and cannot be regenerated')
      }
      const previousRevision = run.revision
      const updated = await PayrollRun.updateOne(
        { _id: run.id, status: 'draft' },
        { $inc: { revision: 1 }, $set: { updatedAt: new Date() } },
        { session },
      )
      if (!updated.modifiedCount) {
        throw new AppError(409, 'Payroll run is no longer a draft')
      }
      await PayrollItem.deleteMany({ run: run.id }, { session })
      await buildItems(run, session)
      await auditService.logAction({
        actor: user.userId,
        action: 'payroll-run.regenerate',
        entityType: 'PayrollRun',
        entityId: run.id,
        before: { month: run.month, status: run.status, revision: previousRevision },
        after: { month: run.month, status: run.status, revision: previousRevision + 1 },
        session,
      })
    })
  } finally {
    await session.endSession()
  }
  return getPayrollRun(id)
}

function itemTotals(items) {
  return items.reduce((totals, item) => {
    totals.basic += item.basic
    totals.hra += item.hra
    totals.medical += item.medical
    totals.gross += item.gross
    totals.deduction += item.deduction
    totals.annualTax += item.annualTax
    totals.monthlyTax += item.monthlyTax
    totals.netPay += item.netPay
    return totals
  }, {
    basic: 0,
    hra: 0,
    medical: 0,
    gross: 0,
    deduction: 0,
    annualTax: 0,
    monthlyTax: 0,
    netPay: 0,
  })
}

async function serializeRun(run, includeItems) {
  const items = await PayrollItem.find({ run: run.id })
    .populate('employee', 'name code')
    .sort({ 'employeeSnapshot.name': 1 })
    .lean()
  const totals = itemTotals(items)
  const payload = {
    id: run.id,
    month: run.month,
    status: run.status,
    createdBy: run.createdBy,
    finalizedBy: run.finalizedBy,
    finalizedAt: run.finalizedAt,
    createdAt: run.createdAt,
    itemCount: items.length,
    totals: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, roundMoney(value)])),
  }
  if (includeItems) payload.items = items
  return payload
}

async function listPayrollRuns() {
  const runs = await PayrollRun.find().sort({ month: -1 })
  return { items: await Promise.all(runs.map((run) => serializeRun(run, false))) }
}

async function getPayrollRun(id) {
  const run = await PayrollRun.findById(id)
  if (!run) throw new AppError(404, 'Payroll run not found')
  return { run: await serializeRun(run, true) }
}

async function finalizePayrollRun(user, id) {
  const session = await mongoose.startSession()
  let run
  try {
    await session.withTransaction(async () => {
      const existing = await PayrollRun.findById(id).session(session)
      if (!existing) throw new AppError(404, 'Payroll run not found')
      if (existing.status !== 'draft') throw new AppError(409, 'Payroll run has already been finalized')
      const finalizedAt = new Date()
      const update = await PayrollRun.updateOne(
        { _id: id, status: 'draft' },
        { $set: { status: 'finalized', finalizedBy: user.userId, finalizedAt } },
        { session },
      )
      if (!update.modifiedCount) throw new AppError(409, 'Payroll run has already been finalized')
      const items = await PayrollItem.find({ run: id }).select('employee').session(session)
      const finalizedRun = await PayrollRun.findById(id).session(session)
      const employees = items.map((item) => String(item.employee))
      const users = await User.find({ role: 'employee', employeeId: { $in: employees }, isActive: true })
        .select('_id employeeId')
        .session(session)
      const notifications = users.map((employeeUser) => ({
        user: employeeUser.id,
        title: 'Payslip available',
        message: `Your ${finalizedRun.month} payslip is now available to download.`,
      }))
      if (notifications.length) await Notification.create(notifications, { session, ordered: true })
      await auditService.logAction({
        actor: user.userId,
        action: 'payroll-run.finalize',
        entityType: 'PayrollRun',
        entityId: finalizedRun.id,
        before: existing,
        after: finalizedRun,
        session,
      })
      run = finalizedRun
    })
  } finally {
    await session.endSession()
  }
  return getPayrollRun(id)
}

async function getMyPayslips(user) {
  if (!user.employeeId || !mongoose.isValidObjectId(user.employeeId)) {
    throw new AppError(403, 'Employee account has no linked employee record')
  }
  const items = await PayrollItem.find({ employee: user.employeeId })
    .populate({
      path: 'run',
      match: { status: 'finalized' },
      select: 'month status finalizedAt',
    })
    .sort({ createdAt: -1 })
  const payslips = items.filter((item) => item.run).map((item) => ({
    id: item.id,
    month: item.run.month,
    status: item.run.status,
    basic: item.basic,
    hra: item.hra,
    medical: item.medical,
    gross: item.gross,
    deduction: item.deduction,
    annualTax: item.annualTax,
    monthlyTax: item.monthlyTax,
    netPay: item.netPay,
    daysPayable: item.daysPayable,
    finalizedAt: item.run.finalizedAt,
  }))
  return { items: payslips }
}

async function getPayslipForDownload(user, itemId) {
  const item = await PayrollItem.findById(itemId)
    .populate('run')
    .populate('employee', 'name code email department designation')
  if (!item || !item.run) throw new AppError(404, 'Payslip not found')
  if (user.role === 'employee') {
    if (String(item.employee?._id) !== user.employeeId) {
      throw new AppError(404, 'Payslip not found')
    }
    if (item.run.status !== 'finalized') {
      throw new AppError(404, 'Payslip not found')
    }
  }
  if (!item.employee) throw new AppError(404, 'Payslip employee record not found')
  return item
}

async function getCompanyName() {
  const company = await Company.findById('primary').select('name')
  if (!company) throw new AppError(404, 'Company setup has not been completed')
  return company.name
}

module.exports = {
  calculateAnnualTax,
  computeEmployeePayroll,
  createPayrollRun,
  finalizePayrollRun,
  getCompanyName,
  getMyPayslips,
  getPayrollRun,
  getPayslipForDownload,
  listPayrollRuns,
  regeneratePayrollRun,
}
