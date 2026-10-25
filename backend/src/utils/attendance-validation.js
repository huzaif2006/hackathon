const { z } = require('zod')

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i)
const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  }, 'Must be a real date in YYYY-MM-DD format')
const monthSchema = z.string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const optionalTimeSchema = z.union([timeSchema, z.literal('')])

const myAttendanceQuerySchema = z.object({ month: monthSchema.optional() }).strict()
const boardQuerySchema = z.object({
  date: dateSchema.optional(),
  department: objectIdSchema.optional(),
}).strict()
const correctionSchema = z.object({
  date: dateSchema,
  requestedCheckIn: optionalTimeSchema.optional().default(''),
  requestedCheckOut: optionalTimeSchema.optional().default(''),
  reason: z.string().trim().min(1).max(500),
}).strict().refine(
  (value) => value.requestedCheckIn || value.requestedCheckOut,
  { message: 'Provide a requested check-in or check-out time' },
).refine(
  (value) => !value.requestedCheckIn
    || !value.requestedCheckOut
    || value.requestedCheckOut > value.requestedCheckIn,
  { message: 'Requested check-out must be later than check-in' },
)
const correctionReviewSchema = z.object({
  comment: z.string().trim().min(1).max(500),
}).strict()

module.exports = {
  boardQuerySchema,
  correctionReviewSchema,
  correctionSchema,
  dateSchema,
  monthSchema,
  myAttendanceQuerySchema,
  objectIdSchema,
  timeSchema,
}
