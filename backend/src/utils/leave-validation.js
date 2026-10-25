const { z } = require('zod')
const { dateSchema, objectIdSchema } = require('./attendance-validation')

const createLeaveSchema = z.object({
  leaveType: objectIdSchema,
  startDate: dateSchema,
  endDate: dateSchema,
  reason: z.string().trim().min(1).max(1000),
}).strict().refine(
  (value) => value.startDate <= value.endDate,
  { message: 'Start date must be on or before end date' },
)

const leaveRequestsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
  department: objectIdSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
}).strict()

const reviewLeaveSchema = z.object({
  comment: z.string().trim().min(1).max(500),
}).strict()

const idSchema = objectIdSchema

module.exports = {
  createLeaveSchema,
  idSchema,
  leaveRequestsQuerySchema,
  reviewLeaveSchema,
}
