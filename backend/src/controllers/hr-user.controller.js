const organizationService = require('../services/organization.service')

async function getHrUsers(_req, res) {
  res.json({ users: await organizationService.getHrUsers() })
}

async function createHrUser(req, res) {
  res.status(201).json(await organizationService.createHrUser(req.body, req.user.userId))
}

async function deactivateHrUser(req, res) {
  res.json({ user: await organizationService.deactivateHrUser(req.params.id, req.user.userId) })
}

async function resetHrPassword(req, res) {
  res.json(await organizationService.resetHrPassword(req.params.id, req.user.userId))
}

module.exports = { createHrUser, deactivateHrUser, getHrUsers, resetHrPassword }
