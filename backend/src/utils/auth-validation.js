const { z } = require('zod')

const emailSchema = z.string().trim().email().transform((email) => email.toLowerCase())
const passwordSchema = z.string().min(8).max(128)

const setupSchema = z.object({
  companyName: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  password: passwordSchema,
}).strict()

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
}).strict()

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
}).strict()

module.exports = { setupSchema, loginSchema, changePasswordSchema }
