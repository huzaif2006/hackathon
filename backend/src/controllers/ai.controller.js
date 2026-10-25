const aiService = require('../services/ai.service')

module.exports = {
  chat: async (req, res) => {
    res.json(await aiService.chat(req.user, req.body))
  },
  dashboardSummary: async (req, res) => {
    res.json(await aiService.summarizeDashboard(req.user, req.body?.kpis))
  },
  smartLeave: async (req, res) => {
    res.json(await aiService.generateSmartLeave(req.user, req.body))
  },
}
