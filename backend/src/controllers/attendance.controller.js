const mongoose = require('mongoose')
const attendanceService = require('../services/attendance.service')
const AppError = require('../utils/app-error')
const {
  boardQuerySchema,
  correctionReviewSchema,
  correctionSchema,
  myAttendanceQuerySchema,
  objectIdSchema,
} = require('../utils/attendance-validation')

function parseQuery(schema, query) {
  const result = schema.safeParse(query)
  if (!result.success) {
    throw new AppError(422, 'Query parameters are invalid')
  }
  return result.data
}

function parseBody(schema, body) {
  const result = schema.safeParse(body)
  if (!result.success) {
    throw new AppError(422, 'Request body is invalid')
  }
  return result.data
}

function validateId(req, _res, next, id) {
  if (!objectIdSchema.safeParse(id).success || !mongoose.isValidObjectId(id)) {
    return next(new AppError(422, 'Invalid correction request ID'))
  }
  return next()
}

module.exports = {
  checkIn: async (req, res) => res.status(201).json(await attendanceService.createCheckIn(req.user)),
  checkOut: async (req, res) => res.json(await attendanceService.createCheckOut(req.user)),
  myAttendance: async (req, res) => {
    const { month } = parseQuery(myAttendanceQuerySchema, req.query)
    res.json(await attendanceService.getMyAttendance(req.user, month))
  },
  board: async (req, res) => {
    const { date, department } = parseQuery(boardQuerySchema, req.query)
    res.json(await attendanceService.getAttendanceBoard(date, department))
  },
  createCorrection: async (req, res) => {
    const data = parseBody(correctionSchema, req.body)
    const correction = await attendanceService.createCorrection(req.user, data)
    res.status(201).json({ correction })
  },
  corrections: async (req, res) => res.json(await attendanceService.listCorrections(req.user)),
  approveCorrection: async (req, res) => {
    const { comment } = parseBody(correctionReviewSchema, req.body)
    const correction = await attendanceService.reviewCorrection(req.user, req.params.id, 'approved', comment)
    res.json({ correction })
  },
  rejectCorrection: async (req, res) => {
    const { comment } = parseBody(correctionReviewSchema, req.body)
    const correction = await attendanceService.reviewCorrection(req.user, req.params.id, 'rejected', comment)
    res.json({ correction })
  },
  validateId,
}
