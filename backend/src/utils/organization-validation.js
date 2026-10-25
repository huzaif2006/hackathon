const { z } = require('zod')

const nameSchema = z.string().trim().min(1).max(100)
const idSchema = z.string().regex(/^[a-f\d]{24}$/i)
const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  })

const departmentSchema = z.object({ name: nameSchema }).strict()
const designationSchema = z.object({ name: nameSchema }).strict()
const leaveTypeSchema = z.object({
  name: nameSchema,
  yearlyQuota: z.number().min(0).max(366),
  isUnlimited: z.boolean(),
  isPaid: z.boolean(),
}).strict()
const holidaySchema = z.object({
  date: dateSchema,
  name: nameSchema,
}).strict()
const hrUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
}).strict()

const companySettingsSchema = z.object({
  name: nameSchema,
  officeStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  graceMinutes: z.number().int().min(0).max(240),
  halfDayHours: z.number().min(0.25).max(24),
  weekend: z.array(z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']))
    .max(7)
    .refine((days) => new Set(days).size === days.length),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  radiusMeters: z.number().int().min(1).max(100000),
  timezone: z.string().trim().min(1).refine((timezone) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone })
      return true
    } catch {
      return false
    }
  }, 'Must be a valid IANA timezone'),
}).strict().refine(
  (settings) => (settings.latitude === null) === (settings.longitude === null),
  { message: 'Office latitude and longitude must both be set or both be empty' },
)

module.exports = {
  companySettingsSchema,
  dateSchema,
  departmentSchema,
  designationSchema,
  holidaySchema,
  hrUserSchema,
  idSchema,
  leaveTypeSchema,
}
