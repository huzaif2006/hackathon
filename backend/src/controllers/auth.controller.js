const authService = require('../services/auth.service')

async function login(req, res) {
  res.json(await authService.login(req.body))
}

async function getCurrentUser(req, res) {
  res.json({ user: req.user })
}

async function changePassword(req, res) {
  const user = await authService.changePassword(req.user.userId, req.body)
  res.json({ user })
}

module.exports = { changePassword, getCurrentUser, login }
