const auditService = require('../services/audit.service')
const AppError = require('../utils/app-error')
const { auditQuerySchema } = require('../utils/audit-validation')

async function list(req, res) {
  const result = auditQuerySchema.safeParse(req.query)
  if (!result.success) {
    throw new AppError(422, result.error.issues[0]?.message || 'Audit filters are invalid')
  }
  res.json(await auditService.listAuditLogs(result.data))
}

module.exports = { list }
