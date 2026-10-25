const mongoose = require('mongoose')
const Attendance = require('../models/attendance.model')
const AttendanceCorrection = require('../models/attendance-correction.model')
const Company = require('../models/company.model')
const Employee = require('../models/employee.model')
const Holiday = require('../models/holiday.model')
const LeaveRequest = require('../models/leave-request.model')
const LeaveType = require('../models/leave-type.model')
const PayrollItem = require('../models/payroll-item.model')
const auditService = require('./audit.service')
const announcementService = require('./announcement.service')
const AppError = require('../utils/app-error')
const leaveService = require('./leave.service')
const { dateKeyInTimezone, weekdayForDateKey } = require('../utils/timezone')

function dateRangeDefaults(query, timezone) {
  const today = dateKeyInTimezone(new Date(), timezone)
  const to = query.to || today
  const from = query.from || `${to.slice(0, 7)}-01`
  const rangeDays = (new Date(`${to}T00:00:00.000Z`) - new Date(`${from}T00:00:00.000Z`)) / (24 * 60 * 60 * 1000)
  if (rangeDays < 0) throw new AppError(422, '`from` must be on or before `to`')
  if (rangeDays > 366) throw new AppError(422, 'Dashboard date range cannot exceed 367 days')
  return { from, to, today }
}

function datesBetween(from, to) {
  const dates = []
  const cursor = new Date(`${from}T00:00:00.000Z`)
  const end = new Date(`${to}T00:00:00.000Z`)
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

function startOfWeek(dateKey) {
  const date = new Date(`${dateKey}T00:00:00.000Z`)
  const daysFromMonday = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - daysFromMonday)
  return date.toISOString().slice(0, 10)
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function matchDepartment(department) {
  return department ? { department: new mongoose.Types.ObjectId(department) } : {}
}

function employedAtMatch(date, department) {
  return {
    joinDate: { $lte: new Date(`${date}T23:59:59.999Z`) },
    $or: [
      { exitDate: { $exists: false } },
      { exitDate: null },
      { exitDate: { $gte: new Date(`${date}T00:00:00.000Z`) } },
    ],
    ...matchDepartment(department),
  }
}

async function getCompany() {
  const company = await Company.findById('primary')
  if (!company) throw new AppError(404, 'Company setup has not been completed')
  return company
}

async function getHolidayKeys(from, to) {
  const holidays = await Holiday.aggregate([
    {
      $match: {
        date: {
          $gte: new Date(`${from}T00:00:00.000Z`),
          $lt: new Date(`${addDays(to, 1)}T00:00:00.000Z`),
        },
      },
    },
    { $project: { dateKey: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'UTC' } } } },
  ])
  return new Set(holidays.map((holiday) => holiday.dateKey))
}

function eligibleAt(date, employee) {
  const joinDate = employee.joinDate instanceof Date
    ? employee.joinDate.toISOString().slice(0, 10)
    : String(employee.joinDate).slice(0, 10)
  const exitDate = employee.exitDate
    ? employee.exitDate instanceof Date
      ? employee.exitDate.toISOString().slice(0, 10)
      : String(employee.exitDate).slice(0, 10)
    : null
  return joinDate <= date && (!exitDate || exitDate >= date)
}

async function getAttendanceStatusRows(from, to, department) {
  return Attendance.aggregate([
    { $match: { date: { $gte: from, $lte: to } } },
    { $lookup: { from: 'employees', localField: 'employee', foreignField: '_id', as: 'employeeDoc' } },
    { $unwind: '$employeeDoc' },
    ...(department ? [{ $match: { 'employeeDoc.department': new mongoose.Types.ObjectId(department) } }] : []),
    {
      $project: {
        date: 1,
        employee: '$employee',
        department: '$employeeDoc.department',
        status: {
          $cond: [
            { $eq: ['$checkOut', null] },
            'missing_checkout',
            '$status',
          ],
        },
        workedHours: 1,
      },
    },
    {
      $group: {
        _id: { date: '$date', employee: '$employee', department: '$department' },
        status: { $last: '$status' },
        workedHours: { $last: '$workedHours' },
      },
    },
  ])
}

async function getApprovedLeaveRows(from, to, department) {
  return LeaveRequest.aggregate([
    { $match: { status: 'approved', startDate: { $lte: to }, endDate: { $gte: from } } },
    { $lookup: { from: 'employees', localField: 'employee', foreignField: '_id', as: 'employeeDoc' } },
    { $unwind: '$employeeDoc' },
    ...(department ? [{ $match: { 'employeeDoc.department': new mongoose.Types.ObjectId(department) } }] : []),
    {
      $lookup: {
        from: 'leavetypes',
        localField: 'leaveType',
        foreignField: '_id',
        as: 'leaveTypeDoc',
      },
    },
    { $unwind: { path: '$leaveTypeDoc', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        employee: 1,
        department: '$employeeDoc.department',
        startDate: 1,
        endDate: 1,
        days: 1,
        yearlyDays: 1,
        leaveType: '$leaveType',
        leaveTypeName: '$leaveTypeDoc.name',
        yearlyQuota: '$leaveTypeDoc.yearlyQuota',
        isUnlimited: '$leaveTypeDoc.isUnlimited',
        isPaid: '$leaveTypeDoc.isPaid',
      },
    },
  ])
}

function workingDaysWithinRange(from, to, weekend, holidays) {
  return datesBetween(from, to).filter((date) => (
    !weekend.includes(weekdayForDateKey(date)) && !holidays.has(date)
  ))
}

function approvedDaysInRange(leave, from, to, weekend, holidays) {
  const start = leave.startDate > from ? leave.startDate : from
  const end = leave.endDate < to ? leave.endDate : to
  if (start > end) return 0
  return workingDaysWithinRange(start, end, weekend, holidays).length
}

async function headcountAt(date, department) {
  const [result] = await Employee.aggregate([
    { $match: employedAtMatch(date, department) },
    { $count: 'count' },
  ])
  return result?.count || 0
}

async function attendanceAggregates(from, to, department) {
  const [attendance, leaves] = await Promise.all([
    getAttendanceStatusRows(from, to, department),
    getApprovedLeaveRows(from, to, department),
  ])
  return { attendance, leaves }
}

function makeAttendanceIndex(attendance) {
  const index = new Map()
  for (const row of attendance) {
    const date = row._id.date
    if (!index.has(date)) index.set(date, [])
    index.get(date).push({
      employeeId: String(row._id.employee),
      departmentId: String(row._id.department),
      status: row.status,
      workedHours: row.workedHours || 0,
    })
  }
  return index
}

function approvedLeaveForDate(leaves, date) {
  return leaves.filter((leave) => leave.startDate <= date && leave.endDate >= date)
}

function attendanceRateForDate(date, expectedEmployees, attendanceRows, leaveRows, weekend, holidays) {
  if (weekend.includes(weekdayForDateKey(date)) || holidays.has(date)) {
    return { rate: 0, present: 0, late: 0, missingCheckout: 0, halfDay: 0, absent: 0, onLeave: 0, expected: 0 }
  }
  const leaveByEmployee = new Set(leaveRows.map((leave) => String(leave.employee)))
  const eligibleEmployees = expectedEmployees.filter((employee) => eligibleAt(date, employee))
  const onLeave = eligibleEmployees.filter((employee) => leaveByEmployee.has(employee.id)).length
  const expected = Math.max(0, eligibleEmployees.length - onLeave)
  const dateRows = attendanceRows.filter((row) => (
    eligibleEmployees.some((employee) => employee.id === row.employeeId)
      && !leaveByEmployee.has(row.employeeId)
  ))
  const present = dateRows.filter((row) => row.status === 'present').length
  const late = dateRows.filter((row) => row.status === 'late').length
  const missingCheckout = dateRows.filter((row) => row.status === 'missing_checkout').length
  const halfDay = dateRows.filter((row) => row.status === 'half_day').length
  const absent = Math.max(0, expected - dateRows.length)
  const numerator = present + late + missingCheckout + (0.5 * halfDay)
  return {
    rate: expected ? (numerator / expected) * 100 : 0,
    present,
    late,
    missingCheckout,
    halfDay,
    absent,
    onLeave,
    expected,
  }
}

async function getHeadcount({ from, to, department }) {
  const [atEnd, atStart] = await Promise.all([
    headcountAt(to, department),
    headcountAt(from, department),
  ])
  return { headcount: atEnd, headcountAtStart: atStart }
}

async function getTodayAttendanceKpis(today, department, company) {
  const [rows, leaves, expectedHeadcount] = await Promise.all([
    getAttendanceStatusRows(today, today, department),
    getApprovedLeaveRows(today, today, department),
    headcountAt(today, department),
  ])
  const holidayKeys = await getHolidayKeys(today, today)
  const isWorkingDay = !company.weekend.includes(weekdayForDateKey(today)) && !holidayKeys.has(today)
  const onLeaveIds = isWorkingDay
    ? new Set(leaves.filter((leave) => leave.startDate <= today && leave.endDate >= today).map((leave) => String(leave.employee)))
    : new Set()
  const attendedEmployeeIds = new Set(rows.map((row) => String(row._id.employee)))
  const present = rows.filter((row) => row.status === 'present').length
  const late = rows.filter((row) => row.status === 'late').length
  const onLeave = onLeaveIds.size
  const absent = isWorkingDay ? Math.max(0, expectedHeadcount - onLeave - attendedEmployeeIds.size) : 0
  return {
    present,
    late,
    onLeave,
    absent,
  }
}

async function getAttendanceTrend({ from, to, department }, company) {
  const dates = datesBetween(from, to)
  const holidayKeys = await getHolidayKeys(from, to)
  const [employees, aggregates] = await Promise.all([
    Employee.aggregate([
      { $match: { joinDate: { $lte: new Date(`${to}T23:59:59.999Z`) }, ...matchDepartment(department) } },
      { $project: { _id: 1, joinDate: 1, exitDate: 1, department: 1 } },
    ]),
    attendanceAggregates(from, to, department),
  ])
  const index = makeAttendanceIndex(aggregates.attendance)
  const trend = []
  for (const date of dates) {
    const dateLeaves = approvedLeaveForDate(aggregates.leaves, date)
    const metrics = attendanceRateForDate(
      date,
      employees.map((employee) => ({
        id: String(employee._id),
        joinDate: employee.joinDate,
        exitDate: employee.exitDate,
      })),
      index.get(date) || [],
      dateLeaves,
      company.weekend,
      holidayKeys,
    )
    trend.push({
      date,
      attendanceRate: Math.round(metrics.rate * 100) / 100,
      present: metrics.present,
      late: metrics.late,
      missingCheckout: metrics.missingCheckout,
      halfDay: metrics.halfDay,
      absent: metrics.absent,
      onLeave: metrics.onLeave,
    })
  }
  return trend
}

async function getAbsenteeismByDepartment({ from, to, department }, company) {
  const dates = datesBetween(from, to)
  const holidayKeys = await getHolidayKeys(from, to)
  const workingDates = workingDaysWithinRange(from, to, company.weekend, holidayKeys)
  const [employees, attendance, leaves] = await Promise.all([
    Employee.aggregate([
      { $match: {
        joinDate: { $lte: new Date(`${to}T23:59:59.999Z`) },
        ...matchDepartment(department),
      } },
      { $lookup: { from: 'departments', localField: 'department', foreignField: '_id', as: 'departmentDoc' } },
      { $unwind: { path: '$departmentDoc', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 1, name: 1, code: 1, joinDate: 1, exitDate: 1, department: 1, departmentName: { $ifNull: ['$departmentDoc.name', 'Unassigned'] } } },
    ]),
    Attendance.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      { $lookup: { from: 'employees', localField: 'employee', foreignField: '_id', as: 'employeeDoc' } },
      { $unwind: '$employeeDoc' },
      { $group: { _id: { employee: '$employee', department: '$employeeDoc.department', date: '$date' }, status: { $last: '$status' }, checkOut: { $last: '$checkOut' } } },
    ]),
    getApprovedLeaveRows(from, to),
  ])
  const departments = new Map()
  for (const employee of employees) {
    if (!departments.has(String(employee.department))) {
      departments.set(String(employee.department), { department: employee.departmentName, employees: [] })
    }
    departments.get(String(employee.department)).employees.push({
      id: String(employee._id),
      joinDate: employee.joinDate,
      exitDate: employee.exitDate,
    })
  }

  const attendanceByDayEmployee = new Map(attendance.map((row) => [
    `${row._id.date}:${String(row._id.employee)}`,
    row.checkOut ? row.status : 'missing_checkout',
  ]))
  const result = []
  for (const group of departments.values()) {
    let expectedDays = 0
    let absentDays = 0
    const departmentEmployeeIds = new Set(group.employees.map((employee) => employee.id))
    const departmentLeaves = leaves.filter((leave) => departmentEmployeeIds.has(String(leave.employee)))
    for (const date of dates) {
      if (!workingDates.includes(date)) continue
      const onLeaveEmployees = new Set(departmentLeaves
        .filter((leave) => leave.startDate <= date && leave.endDate >= date)
        .map((leave) => String(leave.employee)))
      for (const employee of group.employees) {
        if (!eligibleAt(date, employee) || onLeaveEmployees.has(employee.id)) continue
        expectedDays += 1
        if (!attendanceByDayEmployee.has(`${date}:${employee.id}`)) absentDays += 1
      }
    }
    result.push({
      department: group.department,
      expectedWorkingDays: expectedDays,
      absentDays,
      absenteeismRate: expectedDays ? Math.round((absentDays / expectedDays) * 10000) / 100 : 0,
    })
  }
  return result.sort((a, b) => b.absenteeismRate - a.absenteeismRate)
}

async function getLeaveByType({ from, to, department }, company) {
  const [leaves, leaveTypes, holidayKeys] = await Promise.all([
    getApprovedLeaveRows(from, to, department),
    LeaveType.aggregate([
      { $project: { name: 1, yearlyQuota: 1, isUnlimited: 1 } },
    ]),
    getHolidayKeys(from, to),
  ])
  const leavesByType = new Map()
  for (const leave of leaves) {
    const key = String(leave.leaveType)
    if (!leavesByType.has(key)) {
      leavesByType.set(key, { name: leave.leaveTypeName || 'Unknown', days: 0 })
    }
    leavesByType.get(key).days += approvedDaysInRange(leave, from, to, company.weekend, holidayKeys)
  }

  const typesById = new Map(leaveTypes.map((leaveType) => [String(leaveType._id), leaveType]))
  return [...typesById.entries()].map(([id, type]) => {
    const info = leavesByType.get(id) || { name: type.name, days: 0 }
    const quotaForRange = type.isUnlimited ? null : type.yearlyQuota
    return {
      leaveTypeId: id,
      leaveType: info.name,
      approvedDays: info.days,
      quota: quotaForRange === null ? null : Math.round(quotaForRange * 100) / 100,
      utilizationRate: quotaForRange ? Math.round((info.days / quotaForRange) * 10000) / 100 : null,
    }
  }).sort((a, b) => b.approvedDays - a.approvedDays)
}

async function getTopLateComers({ from, to, department }) {
  return Attendance.aggregate([
    { $match: { date: { $gte: from, $lte: to }, status: 'late' } },
    { $lookup: { from: 'employees', localField: 'employee', foreignField: '_id', as: 'employeeDoc' } },
    { $unwind: '$employeeDoc' },
    ...(department ? [{ $match: { 'employeeDoc.department': new mongoose.Types.ObjectId(department) } }] : []),
    {
      $group: {
        _id: '$employee',
        lateCount: { $sum: 1 },
        name: { $first: '$employeeDoc.name' },
        code: { $first: '$employeeDoc.code' },
        departmentId: { $first: '$employeeDoc.department' },
        lastLateDate: { $max: '$date' },
      },
    },
    { $sort: { lateCount: -1, name: 1 } },
    { $limit: 5 },
    { $lookup: { from: 'departments', localField: 'departmentId', foreignField: '_id', as: 'department' } },
    { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
    { $project: { employeeId: '$_id', name: 1, code: 1, lateCount: 1, lastLateDate: 1, department: { $ifNull: ['$department.name', 'Unassigned'] } } },
  ])
}

async function getLatePercentage({ from, to, department }) {
  const [result] = await Attendance.aggregate([
    { $match: { date: { $gte: from, $lte: to }, status: { $in: ['present', 'late'] } } },
    { $lookup: { from: 'employees', localField: 'employee', foreignField: '_id', as: 'employeeDoc' } },
    { $unwind: '$employeeDoc' },
    ...(department ? [{ $match: { 'employeeDoc.department': new mongoose.Types.ObjectId(department) } }] : []),
    {
      $group: {
        _id: null,
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        present: 1,
        late: 1,
        latePercentage: {
          $cond: [
            { $gt: [{ $add: ['$present', '$late'] }, 0] },
            { $multiply: [{ $divide: ['$late', { $add: ['$present', '$late'] }] }, 100] },
            0,
          ],
        },
      },
    },
  ])
  return {
    present: result?.present || 0,
    late: result?.late || 0,
    percentage: Math.round((result?.latePercentage || 0) * 100) / 100,
  }
}

async function getPendingApprovalCount(department) {
  const [leaveRows, correctionRows] = await Promise.all([
    LeaveRequest.aggregate([
      { $match: { status: 'pending' } },
      { $lookup: { from: 'employees', localField: 'employee', foreignField: '_id', as: 'employeeDoc' } },
      { $unwind: '$employeeDoc' },
      ...(department ? [{ $match: { 'employeeDoc.department': new mongoose.Types.ObjectId(department) } }] : []),
      { $count: 'count' },
    ]),
    AttendanceCorrection.aggregate([
      { $match: { status: 'pending' } },
      { $lookup: { from: 'employees', localField: 'employee', foreignField: '_id', as: 'employeeDoc' } },
      { $unwind: '$employeeDoc' },
      ...(department ? [{ $match: { 'employeeDoc.department': new mongoose.Types.ObjectId(department) } }] : []),
      { $count: 'count' },
    ]),
  ])
  return (leaveRows[0]?.count || 0) + (correctionRows[0]?.count || 0)
}

async function getHrDashboard(user, query) {
  if (!['admin', 'hr'].includes(user.role)) {
    throw new AppError(403, 'HR dashboard is not available to this role')
  }
  const company = await getCompany()
  const range = dateRangeDefaults(query, company.timezone || 'Asia/Karachi')
  const [headcount, today, trend, absenteeismByDepartment, leaveByType, topLateComers, pendingApprovals, latePercentage, announcements] = await Promise.all([
    getHeadcount({ ...range, department: query.department }),
    getTodayAttendanceKpis(range.today, query.department, company),
    getAttendanceTrend({ ...range, department: query.department }, company),
    getAbsenteeismByDepartment({ ...range, department: query.department }, company),
    getLeaveByType({ ...range, department: query.department }, company),
    getTopLateComers({ ...range, department: query.department }),
    getPendingApprovalCount(query.department),
    getLatePercentage({ ...range, department: query.department }),
    announcementService.listAnnouncements(5),
  ])
  return {
    filters: { from: range.from, to: range.to, department: query.department || null },
    headcount: headcount.headcount,
    presentToday: today.present,
    onLeaveToday: today.onLeave,
    lateToday: today.late,
    latePercentage: latePercentage.percentage,
    pendingApprovals,
    attendanceTrend: trend,
    absenteeismByDepartment,
    leaveByType,
    topLateComers,
    announcements: announcements.items,
  }
}

async function getPayrollCost(from, to, department) {
  const pipeline = [
    { $lookup: { from: 'payrollruns', localField: 'run', foreignField: '_id', as: 'runDoc' } },
    { $unwind: '$runDoc' },
    { $match: { 'runDoc.status': 'finalized', 'runDoc.month': { $gte: from.slice(0, 7), $lte: to.slice(0, 7) } } },
    { $lookup: { from: 'employees', localField: 'employee', foreignField: '_id', as: 'employeeDoc' } },
    { $unwind: '$employeeDoc' },
    ...(department ? [{ $match: { 'employeeDoc.department': new mongoose.Types.ObjectId(department) } }] : []),
    {
      $group: {
        _id: {
          month: '$runDoc.month',
          department: '$employeeDoc.department',
        },
        gross: { $sum: '$gross' },
        net: { $sum: '$netPay' },
      },
    },
    { $lookup: { from: 'departments', localField: '_id.department', foreignField: '_id', as: 'departmentDoc' } },
    { $unwind: { path: '$departmentDoc', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        month: '$_id.month',
        departmentId: '$_id.department',
        department: { $ifNull: ['$departmentDoc.name', 'Unassigned'] },
        gross: 1,
        net: 1,
      },
    },
    { $sort: { month: 1, department: 1 } },
  ]
  const monthly = await PayrollItem.aggregate(pipeline)
  const totals = monthly.reduce((result, row) => ({
    gross: result.gross + row.gross,
    net: result.net + row.net,
  }), { gross: 0, net: 0 })
  const departmentMap = new Map()
  for (const row of monthly) {
    if (!departmentMap.has(row.department)) {
      departmentMap.set(row.department, { department: row.department, gross: 0, net: 0 })
    }
    const summary = departmentMap.get(row.department)
    summary.gross += row.gross
    summary.net += row.net
  }
  return {
    gross: Math.round(totals.gross * 100) / 100,
    net: Math.round(totals.net * 100) / 100,
    monthly,
    byDepartment: [...departmentMap.values()],
  }
}

async function getAdminDashboard(user, query) {
  if (user.role !== 'admin') {
    throw new AppError(403, 'Admin dashboard is only available to Admin')
  }
  const company = await getCompany()
  const range = dateRangeDefaults(query, company.timezone || 'Asia/Karachi')
  const currentYear = Number(range.to.slice(0, 4))
  const yearStart = `${currentYear}-01-01`
  const [headcount, headcountAtStart, exits, avgSalaryGroups, departmentHeadcounts, payrollCost, gender, tenure, recentAuditFeed, announcements] = await Promise.all([
    headcountAt(range.to, query.department),
    headcountAt(yearStart, query.department),
    Employee.aggregate([
      { $match: { status: 'exited', exitDate: { $gte: new Date(`${yearStart}T00:00:00.000Z`), $lte: new Date(`${range.to}T23:59:59.999Z`) }, ...matchDepartment(query.department) } },
      { $count: 'count' },
    ]),
    Employee.aggregate([
      { $match: employedAtMatch(range.to, query.department) },
      { $group: { _id: { department: '$department', designation: '$designation' }, averageGross: { $avg: { $multiply: ['$basicSalary', 1.5] } }, employees: { $sum: 1 } } },
      { $lookup: { from: 'departments', localField: '_id.department', foreignField: '_id', as: 'departmentDoc' } },
      { $unwind: { path: '$departmentDoc', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'designations', localField: '_id.designation', foreignField: '_id', as: 'designationDoc' } },
      { $unwind: { path: '$designationDoc', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, department: { $ifNull: ['$departmentDoc.name', 'Unassigned'] }, designation: { $ifNull: ['$designationDoc.name', 'Unassigned'] }, averageGross: 1, employees: 1 } },
      { $sort: { department: 1, designation: 1 } },
    ]),
    Employee.aggregate([
      { $match: employedAtMatch(range.to, query.department) },
      { $group: { _id: '$department', headcount: { $sum: 1 } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'departmentDoc' } },
      { $unwind: { path: '$departmentDoc', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, department: { $ifNull: ['$departmentDoc.name', 'Unassigned'] }, headcount: 1 } },
      { $sort: { headcount: -1 } },
    ]),
    getPayrollCost(range.from, range.to, query.department),
    Employee.aggregate([
      { $match: employedAtMatch(range.to, query.department) },
      { $group: { _id: '$gender', headcount: { $sum: 1 } } },
      { $project: { _id: 0, gender: { $ifNull: ['$_id', 'unknown'] }, headcount: 1 } },
      { $sort: { gender: 1 } },
    ]),
    Employee.aggregate([
      { $match: employedAtMatch(range.to, query.department) },
      { $project: { tenureYears: { $divide: [{ $subtract: [new Date(`${range.to}T00:00:00.000Z`), '$joinDate'] }, 31557600000] } } },
      { $bucket: { groupBy: '$tenureYears', boundaries: [0, 1, 3, 5, 10, 100], default: '10+', output: { headcount: { $sum: 1 } } } },
      { $project: { _id: 0, range: { $switch: { branches: [
        { case: { $eq: ['$_id', 0] }, then: '<1 year' },
        { case: { $eq: ['$_id', 1] }, then: '1-2 years' },
        { case: { $eq: ['$_id', 3] }, then: '3-4 years' },
        { case: { $eq: ['$_id', 5] }, then: '5-9 years' },
      ], default: '10+ years' } }, headcount: 1 } },
    ]),
    auditService.getRecentAuditLogs(10),
    announcementService.listAnnouncements(5),
  ])
  const averageHeadcount = (headcount + headcountAtStart) / 2
  const attritionRate = averageHeadcount
    ? Math.round(((exits[0]?.count || 0) / averageHeadcount) * 10000) / 100
    : 0
  const salaryTotal = avgSalaryGroups.reduce((sum, group) => sum + (group.averageGross * group.employees), 0)
  const salaryCount = avgSalaryGroups.reduce((sum, group) => sum + group.employees, 0)
  return {
    filters: { from: range.from, to: range.to, department: query.department || null },
    headcount,
    attritionYtd: {
      exits: exits[0]?.count || 0,
      averageHeadcount: Math.round(averageHeadcount * 100) / 100,
      rate: attritionRate,
    },
    payrollCost,
    averageSalary: {
      gross: salaryCount ? Math.round((salaryTotal / salaryCount) * 100) / 100 : 0,
      byDepartmentDesignation: avgSalaryGroups,
    },
    headcountByDepartment: departmentHeadcounts,
    payrollCostByDepartment: payrollCost.byDepartment,
    genderBreakdown: gender,
    tenureBreakdown: tenure,
    recentAuditFeed,
    announcements: announcements.items,
  }
}

async function getEmployeeDashboard(user) {
  if (user.role !== 'employee' || !user.employeeId || !mongoose.isValidObjectId(user.employeeId)) {
    throw new AppError(403, 'Employee dashboard is not available to this account')
  }
  const [company, employee] = await Promise.all([
    getCompany(),
    Employee.findById(user.employeeId).select('_id joinDate exitDate'),
  ])
  if (!employee) throw new AppError(403, 'Employee account has no linked employee record')
  const timezone = company.timezone || 'Asia/Karachi'
  const today = dateKeyInTimezone(new Date(), timezone)
  const monthFrom = `${today.slice(0, 7)}-01`
  const weekFrom = startOfWeek(today)
  const [todayAttendance, attendanceWeek, lateCount, leaveBalance, lastPayslip, announcements] = await Promise.all([
    Attendance.findOne({ employee: employee.id, date: today }).select('date checkIn checkOut status workedHours'),
    Attendance.aggregate([
      { $match: { employee: employee._id, date: { $gte: weekFrom, $lte: today } } },
      { $group: { _id: null, workedHours: { $sum: '$workedHours' } } },
    ]),
    Attendance.aggregate([
      { $match: { employee: employee._id, date: { $gte: monthFrom, $lte: today }, status: 'late' } },
      { $count: 'count' },
    ]),
    leaveService.getLeaveBalance(user),
    PayrollItem.aggregate([
      { $match: { employee: employee._id } },
      { $lookup: { from: 'payrollruns', localField: 'run', foreignField: '_id', as: 'runDoc' } },
      { $unwind: '$runDoc' },
      { $match: { 'runDoc.status': 'finalized' } },
      { $sort: { 'runDoc.month': -1 } },
      { $limit: 1 },
      { $project: { month: '$runDoc.month', basic: 1, hra: 1, medical: 1, gross: 1, deduction: 1, monthlyTax: 1, netPay: 1, daysPayable: 1 } },
    ]),
    announcementService.listAnnouncements(5),
  ])
  const runningHours = todayAttendance && !todayAttendance.checkOut
    ? Math.max(0, (Date.now() - todayAttendance.checkIn.getTime()) / 3600000)
    : 0
  const workedHours = (attendanceWeek[0]?.workedHours || 0) + runningHours
  return {
    timezone,
    today: {
      date: today,
      attendance: todayAttendance ? {
        checkIn: todayAttendance.checkIn,
        checkOut: todayAttendance.checkOut,
        status: todayAttendance.status,
        workedHours: todayAttendance.workedHours,
      } : null,
    },
    hoursThisWeek: { worked: Math.round(workedHours * 100) / 100, target: 40 },
    lateCountThisMonth: lateCount[0]?.count || 0,
    leaveBalance: leaveBalance.balances,
    lastFinalizedPayslip: lastPayslip[0] || null,
    announcements: announcements.items,
  }
}

module.exports = {
  getAdminDashboard,
  getEmployeeDashboard,
  getHeadcount,
  getHrDashboard,
}
