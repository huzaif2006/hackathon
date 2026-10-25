const { z } = require('zod')
const { objectIdSchema } = require('./attendance-validation')

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM')
const createRunSchema = z.object({ month: monthSchema }).strict()
const idSchema = objectIdSchema

module.exports = { createRunSchema, idSchema, monthSchema }
