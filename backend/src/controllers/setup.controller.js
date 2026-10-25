const setupService = require('../services/setup.service')

async function getSetupStatus(_req, res) {
  res.json(await setupService.getSetupStatus())
}

async function createSetup(req, res) {
  const result = await setupService.createInitialAdmin(req.body)
  res.status(201).json(result)
}

module.exports = { createSetup, getSetupStatus }
