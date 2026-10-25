const { z } = require('zod')
const { dateSchema, objectIdSchema } = require('./attendance-validation')

const dashboardQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  department: objectIdSchema.optional(),
}).strict().refine(
  (value) => !value.from || !value.to || value.from <= value.to,
  { message: '`from` must be on or before `to`' },
).refine(
  (value) => !value.from || !value.to
    || (new Date(`${value.to}T00:00:00.000Z`) - new Date(`${value.from}T00:00:00.000Z`)) <= 366 * 24 * 60 * 60 * 1000,
  { message: 'Dashboard date range cannot exceed 367 days' },
)

module.exports = { dashboardQuerySchema }
