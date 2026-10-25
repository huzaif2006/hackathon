const analyticsService = require('../services/analytics.service')
const AppError = require('../utils/app-error')
const { dashboardQuerySchema } = require('../utils/analytics-validation')

function parseDashboardQuery(query) {
  const result = dashboardQuerySchema.safeParse(query)
  if (!result.success) {
    throw new AppError(422, result.error.issues[0]?.message || 'Dashboard filters are invalid')
  }
  return result.data
}

module.exports = {
  hrDashboard: async (req, res) => {
    const query = parseDashboardQuery(req.query)
    res.json(await analyticsService.getHrDashboard(req.user, query))
  },
  adminDashboard: async (req, res) => {
    const query = parseDashboardQuery(req.query)
    res.json(await analyticsService.getAdminDashboard(req.user, query))
  },
  employeeDashboard: async (req, res) => {
    res.json(await analyticsService.getEmployeeDashboard(req.user))
  },
}
