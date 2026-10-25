const organizationService = require('../services/organization.service')

async function getCompanySettings(_req, res) {
  const company = await organizationService.getCompanySettings()
  res.json({ company })
}

async function updateCompanySettings(req, res) {
  const company = await organizationService.updateCompanySettings(req.body, req.user.userId)
  res.json({ company })
}

module.exports = { getCompanySettings, updateCompanySettings }
