const { z } = require('zod')

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i)
const emailSchema = z.string().trim().email().transform((email) => email.toLowerCase())
const isoDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  }, 'Must be a valid ISO date (YYYY-MM-DD)')

const employeeFields = {
  code: z.string().trim().min(1).max(40).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  phone: z.string().trim().max(40).optional().default(''),
  address: z.string().trim().max(500).optional().default(''),
  gender: z.enum(['male', 'female', 'other']),
  department: objectIdSchema,
  designation: objectIdSchema,
  joinDate: isoDateSchema,
  status: z.enum(['active', 'probation', 'exited']).default('active'),
  exitDate: isoDateSchema.optional(),
  basicSalary: z.coerce.number().finite().positive(),
}

const createEmployeeSchema = z.object(employeeFields).strict()
const updateEmployeeSchema = z.object(employeeFields).partial().strict()
  .refine((fields) => Object.keys(fields).length > 0, 'At least one field is required')
const selfProfileSchema = z.object({
  phone: employeeFields.phone,
  address: employeeFields.address,
}).partial().strict()
  .refine((fields) => Object.keys(fields).length > 0, 'Phone or address is required')

const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  department: objectIdSchema.optional(),
  status: z.enum(['active', 'probation', 'exited']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
}).strict()

const importQuerySchema = z.object({
  dryRun: z.enum(['true', 'false']),
}).strict()

module.exports = {
  createEmployeeSchema,
  importQuerySchema,
  isoDateSchema,
  listQuerySchema,
  objectIdSchema,
  selfProfileSchema,
  updateEmployeeSchema,
}
