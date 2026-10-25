const mongoose = require('mongoose')
const Attendance = require('../models/attendance.model')
const AttendanceCorrection = require('../models/attendance-correction.model')
const Company = require('../models/company.model')
const Employee = require('../models/employee.model')
const Holiday = require('../models/holiday.model')
const LeaveRequest = require('../models/leave-request.model')
const AppError = require('../utils/app-error')
const auditService = require('./audit.service')
const {
  dateKeyInTimezone,
  monthDateKeys,
  startOfUtcDay,
  weekdayForDateKey,
  zonedLocalTimeToUtc,
} = require('../utils/timezone')

async function getCompany() {
  const company = await Company.findById('primary')
  if (!company) {
    throw new AppError(404, 'Company setup has not been completed')
  }
  return company
}

async function getEmployeeForUser(user) {
  if (!user.employeeId || !mongoose.isValidObjectId(user.employeeId)) {
    throw new AppError(403, 'Employee account has no linked employee record')
  }
  const employee = await Employee.findById(user.employeeId)
  if (!employee) {
    throw new AppError(403, 'Employee account has no linked employee record')
  }
  return employee
}

async function isHoliday(dateKey) {
  const day = startOfUtcDay(dateKey)
  const nextDay = new Date(day.valueOf() + 24 * 60 * 60 * 1000)
  return Boolean(await Holiday.exists({ date: { $gte: day, $lt: nextDay } }))
}

function isWeekend(company, dateKey) {
  return company.weekend.includes(weekdayForDateKey(dateKey))
}

function toAttendancePayload(attendance) {
  return {
    _id: attendance.id,
    employee: String(attendance.employee),
    date: attendance.date,
    checkIn: attendance.checkIn,
    checkOut: attendance.checkOut,
    status: attendance.status,
    workedHours: attendance.workedHours,
    source: attendance.source,
    note: attendance.note,
  }
}

async function createCheckIn(user) {
  const [company, employee] = await Promise.all([getCompany(), getEmployeeForUser(user)])
  const now = new Date()
  const date = dateKeyInTimezone(now, company.timezone || 'Asia/Karachi')
  if (await Attendance.exists({ employee: employee.id, date })) {
    throw new AppError(409, 'A check-in already exists for this day')
  }

  const lateAfter = zonedLocalTimeToUtc(
    date,
    company.officeStart,
    company.timezone || 'Asia/Karachi',
  )
  lateAfter.setMinutes(lateAfter.getMinutes() + company.graceMinutes)
  const weekend = isWeekend(company, date)
  const holiday = await isHoliday(date)
  const notes = []
  if (weekend) notes.push('Check-in recorded on a weekend')
  if (holiday) notes.push('Check-in recorded on a holiday')

  try {
    const attendance = await Attendance.create({
      employee: employee.id,
      date,
      checkIn: now,
      status: now > lateAfter ? 'late' : 'present',
      source: 'web',
      note: notes.join('. '),
      settingsSnapshot: {
        timezone: company.timezone || 'Asia/Karachi',
        officeStart: company.officeStart,
        graceMinutes: company.graceMinutes,
        halfDayHours: company.halfDayHours,
      },
    })
    return {
      attendance: toAttendancePayload(attendance),
      note: attendance.note,
      timezone: company.timezone || 'Asia/Karachi',
    }
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(409, 'A check-in already exists for this day')
    }
    throw error
  }
}

async function createCheckOut(user) {
  const company = await getCompany()
  const employee = await getEmployeeForUser(user)
  const now = new Date()
  const date = dateKeyInTimezone(now, company.timezone || 'Asia/Karachi')
  const attendance = await Attendance.findOne({ employee: employee.id, date })

  if (!attendance) {
    throw new AppError(409, 'Check in before checking out')
  }
  if (attendance.checkOut) {
    throw new AppError(409, 'A check-out already exists for this day')
  }
  if (now < attendance.checkIn) {
    throw new AppError(422, 'Check-out cannot be earlier than check-in')
  }

  attendance.checkOut = now
  attendance.workedHours = Math.round(((now - attendance.checkIn) / 3600000) * 100) / 100
  if (attendance.workedHours < (attendance.settingsSnapshot?.halfDayHours ?? company.halfDayHours)) {
    attendance.status = 'half_day'
  }
  await attendance.save()
  return {
    attendance: toAttendancePayload(attendance),
    timezone: company.timezone || 'Asia/Karachi',
  }
}

async function monthForEmployee(employeeId, month, company) {
  const dateKeys = monthDateKeys(month)
  const today = dateKeyInTimezone(new Date(), company.timezone || 'Asia/Karachi')
  const [records, holidayDocs, approvedLeaveRequests] = await Promise.all([
    Attendance.find({ employee: employeeId, date: { $in: dateKeys } }).sort({ date: 1 }),
    Holiday.find({
      date: {
        $gte: startOfUtcDay(dateKeys[0]),
        $lt: new Date(startOfUtcDay(dateKeys[dateKeys.length - 1]).valueOf() + 86400000),
      },
    }),
    LeaveRequest.find({
      employee: employeeId,
      status: 'approved',
      startDate: { $lte: dateKeys[dateKeys.length - 1] },
      endDate: { $gte: dateKeys[0] },
    }).select('startDate endDate'),
  ])
  const byDate = new Map(records.map((record) => [record.date, record]))
  const holidays = new Set(holidayDocs.map((holiday) => dateKeyInTimezone(holiday.date, 'UTC')))
  const days = []

  for (const date of dateKeys) {
    const record = byDate.get(date)
    const weekend = isWeekend(company, date)
    const holiday = holidays.has(date)
    let status
    const onLeave = approvedLeaveRequests.some((request) => (
      request.startDate <= date && request.endDate >= date
    ))
    if (!weekend && !holiday && onLeave) {
      status = 'on_leave'
    } else if (record) {
      status = record.checkOut ? record.status : 'missing_checkout'
    } else if (holiday) {
      status = 'holiday'
    } else if (weekend) {
      status = 'weekend'
    } else if (date <= today) {
      status = 'absent'
    } else {
      status = 'scheduled'
    }

    days.push({
      date,
      status,
      checkIn: record ? record.checkIn : null,
      checkOut: record ? record.checkOut : null,
      workedHours: record ? record.workedHours : 0,
      note: record ? record.note : '',
    })
  }
  return days
}

async function getMyAttendance(user, month) {
  const [company, employee] = await Promise.all([getCompany(), getEmployeeForUser(user)])
  const timezone = company.timezone || 'Asia/Karachi'
  const selectedMonth = month || dateKeyInTimezone(new Date(), timezone).slice(0, 7)
  return {
    days: await monthForEmployee(employee.id, selectedMonth, company),
    timezone,
  }
}

async function getAttendanceBoard(date, department) {
  const company = await getCompany()
  const timezone = company.timezone || 'Asia/Karachi'
  const selectedDate = date || dateKeyInTimezone(new Date(), timezone)
  const employeeFilter = {
    status: { $in: ['active', 'probation'] },
    ...(department ? { department } : {}),
  }
  const employees = await Employee.find(employeeFilter)
    .select('name code department designation')
    .populate('department', 'name')
    .populate('designation', 'name')
    .sort({ name: 1 })
  const [records, approvedLeaveEmployeeIds] = await Promise.all([
    Attendance.find({
      employee: { $in: employees.map((employee) => employee.id) },
      date: selectedDate,
    }),
    LeaveRequest.distinct('employee', {
      employee: { $in: employees.map((employee) => employee.id) },
      status: 'approved',
      startDate: { $lte: selectedDate },
      endDate: { $gte: selectedDate },
    }),
  ])
  const byEmployee = new Map(records.map((record) => [String(record.employee), record]))
  const onLeaveEmployees = new Set(approvedLeaveEmployeeIds.map(String))
  const holiday = await isHoliday(selectedDate)
  const weekend = isWeekend(company, selectedDate)
  const today = dateKeyInTimezone(new Date(), timezone)
  const items = await Promise.all(employees.map(async (employee) => {
    const record = byEmployee.get(employee.id)
    let status
    if (!weekend && !holiday && onLeaveEmployees.has(employee.id)) {
      status = 'on_leave'
    } else if (record) {
      status = record.checkOut ? record.status : 'missing_checkout'
    } else if (holiday) {
      status = 'holiday'
    } else if (weekend) {
      status = 'weekend'
    } else {
      status = selectedDate > today ? 'scheduled' : 'absent'
    }

    return {
      employee: {
        id: employee.id,
        name: employee.name,
        code: employee.code,
        department: employee.department,
        designation: employee.designation,
      },
      date: selectedDate,
      status,
      checkIn: record ? record.checkIn : null,
      checkOut: record ? record.checkOut : null,
      workedHours: record ? record.workedHours : 0,
      note: record ? record.note : '',
    }
  }))
  return { date: selectedDate, timezone, items }
}

async function createCorrection(user, data) {
  const employee = await getEmployeeForUser(user)
  try {
    const correction = await AttendanceCorrection.create({
      employee: employee.id,
      ...data,
    })
    return correction
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(409, 'A pending correction already exists for this day')
    }
    throw error
  }
}

async function listCorrections(user) {
  const employee = user.role === 'employee' ? await getEmployeeForUser(user) : null
  const filter = user.role === 'employee'
    ? { employee: employee.id }
    : { status: 'pending' }
  const corrections = await AttendanceCorrection.find(filter)
    .populate('employee', 'name code department')
    .populate('reviewedBy', 'name')
    .sort({ createdAt: -1 })
  return { items: corrections }
}

async function reviewCorrection(user, id, status, comment) {
  const session = await mongoose.startSession()
  let response
  try {
    await session.withTransaction(async () => {
      const correction = await AttendanceCorrection.findById(id).session(session)
      if (!correction) {
        throw new AppError(404, 'Correction request not found')
      }
      if (correction.status !== 'pending') {
        throw new AppError(409, 'Correction request has already been reviewed')
      }
      const before = correction.toObject()

      if (status === 'approved') {
        const company = await getCompany()
        const current = await Attendance.findOne({
          employee: correction.employee,
          date: correction.date,
        }).session(session)
        const checkIn = correction.requestedCheckIn
          ? zonedLocalTimeToUtc(correction.date, correction.requestedCheckIn, company.timezone || 'Asia/Karachi')
          : current && current.checkIn
        const checkOut = correction.requestedCheckOut
          ? zonedLocalTimeToUtc(correction.date, correction.requestedCheckOut, company.timezone || 'Asia/Karachi')
          : current && current.checkOut

        if (!checkIn || (checkOut && checkOut < checkIn)) {
          throw new AppError(422, 'Correction times are invalid')
        }

        const settings = current?.settingsSnapshot || {
          timezone: company.timezone || 'Asia/Karachi',
          officeStart: company.officeStart,
          graceMinutes: company.graceMinutes,
          halfDayHours: company.halfDayHours,
        }
        const lateAfter = zonedLocalTimeToUtc(
          correction.date,
          settings.officeStart,
          settings.timezone,
        )
        lateAfter.setMinutes(lateAfter.getMinutes() + settings.graceMinutes)
        const workedHours = checkOut
          ? Math.round(((checkOut - checkIn) / 3600000) * 100) / 100
          : 0
        const attendanceStatus = checkOut && workedHours < settings.halfDayHours
          ? 'half_day'
          : checkIn > lateAfter ? 'late' : 'present'
        const setValues = {
          checkIn,
          checkOut: checkOut || null,
          workedHours,
          status: attendanceStatus,
          source: 'web',
          settingsSnapshot: settings,
        }
        if (current) {
          Object.assign(current, setValues)
          await current.save({ session })
        } else {
          await Attendance.create([{ employee: correction.employee, date: correction.date, ...setValues }], { session })
        }
      }

      correction.status = status
      correction.comment = comment
      correction.reviewedBy = user.userId
      correction.reviewedAt = new Date()
      await correction.save({ session })
      await auditService.logAction({
        actor: user.userId,
        action: `attendance-correction.${status}`,
        entityType: 'AttendanceCorrection',
        entityId: correction.id,
        before,
        after: correction,
        session,
      })
      response = correction
    })
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(409, 'An attendance record already exists for this day')
    }
    throw error
  } finally {
    await session.endSession()
  }
  return response
}

module.exports = {
  createCheckIn,
  createCheckOut,
  createCorrection,
  getAttendanceBoard,
  getMyAttendance,
  listCorrections,
  reviewCorrection,
}
