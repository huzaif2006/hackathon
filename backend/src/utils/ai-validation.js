const { z } = require('zod')
const { dashboardQuerySchema } = require('./analytics-validation')
const { dateSchema, monthSchema } = require('./attendance-validation')

const historyMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(4000),
}).strict()

const chatSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  history: z.array(historyMessageSchema).max(12).optional().default([]),
}).strict()

const dashboardSummarySchema = z.object({
  kpis: z.record(z.string(), z.unknown()),
}).strict().refine(
  (value) => {
    try {
      return JSON.stringify(value.kpis).length <= 20000
    } catch (_error) {
      return false
    }
  },
  { message: 'Dashboard KPI data is too large or invalid' },
)

const smartLeaveRequestSchema = z.object({
  text: z.string().trim().min(1).max(2000),
}).strict()

const smartLeaveSuggestionSchema = (leaveTypeIds) => z.object({
  type: z.string().refine((value) => leaveTypeIds.has(value), 'Choose a configured leave type'),
  start: dateSchema,
  end: dateSchema,
  reason: z.string().trim().min(1).max(500),
}).strict().refine(
  (value) => value.end >= value.start,
  { message: 'End date must be on or after start date' },
)

const dashboardToolArgsSchema = dashboardQuerySchema
const employeeAttendanceToolArgsSchema = z.object({
  month: monthSchema.optional(),
}).strict()
const employeeSearchToolArgsSchema = z.object({
  query: z.string().trim().min(1).max(100),
}).strict()
const emptyToolArgsSchema = z.object({}).strict()

module.exports = {
  chatSchema,
  dashboardSummarySchema,
  dashboardToolArgsSchema,
  employeeAttendanceToolArgsSchema,
  employeeSearchToolArgsSchema,
  emptyToolArgsSchema,
  smartLeaveRequestSchema,
  smartLeaveSuggestionSchema,
}
