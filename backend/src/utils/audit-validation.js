const { z } = require('zod')
const { dateSchema, objectIdSchema } = require('./attendance-validation')

const auditQuerySchema = z.object({
  actor: objectIdSchema.optional(),
  action: z.string().trim().min(1).max(100).optional(),
  entityType: z.string().trim().min(1).max(100).optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict().refine(
  (filters) => !filters.from || !filters.to || filters.from <= filters.to,
  { message: '`from` must be on or before `to`' },
)

const announcementSchema = z.object({
  title: z.string().trim().min(1).max(160),
  message: z.string().trim().min(1).max(4000),
}).strict()

const announcementsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict()

module.exports = { announcementSchema, announcementsQuerySchema, auditQuerySchema }
