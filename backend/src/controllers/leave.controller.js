const mongoose = require('mongoose')
const leaveService = require('../services/leave.service')
const AppError = require('../utils/app-error')
const {
  createLeaveSchema,
  idSchema,
  leaveRequestsQuerySchema,
  reviewLeaveSchema,
} = require('../utils/leave-validation')

function parse(schema, value, message) {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new AppError(422, result.error.issues[0]?.message || message)
  }
  return result.data
}

function validateId(req, _res, next, id) {
  if (!idSchema.safeParse(id).success || !mongoose.isValidObjectId(id)) {
    return next(new AppError(422, 'Leave request ID is invalid'))
  }
  return next()
}

module.exports = {
  create: async (req, res) => {
    const data = parse(createLeaveSchema, req.body, 'Leave request body is invalid')
    const result = await leaveService.createLeaveRequest(req.user, data)
    res.status(201).json(result)
  },
  balance: async (req, res) => res.json(await leaveService.getLeaveBalance(req.user)),
  mine: async (req, res) => res.json(await leaveService.getMyLeave(req.user)),
  cancel: async (req, res) => res.json(await leaveService.cancelLeave(req.user, req.params.id)),
  requests: async (req, res) => {
    const query = parse(leaveRequestsQuerySchema, req.query, 'Leave request filters are invalid')
    res.json(await leaveService.getLeaveRequests(query))
  },
  approve: async (req, res) => {
    const { comment } = parse(reviewLeaveSchema, req.body, 'Review comment is required')
    res.json(await leaveService.reviewLeaveRequest(req.user, req.params.id, 'approved', comment))
  },
  reject: async (req, res) => {
    const { comment } = parse(reviewLeaveSchema, req.body, 'Review comment is required')
    res.json(await leaveService.reviewLeaveRequest(req.user, req.params.id, 'rejected', comment))
  },
  validateId,
}
