const AppError = require('../utils/app-error')

const windowMs = 15 * 60 * 1000
const maxAttempts = 20
const attemptsByIp = new Map()

function loginRateLimit(req, _res, next) {
  const now = Date.now()
  const key = req.ip || req.socket.remoteAddress || 'unknown'
  let entry = attemptsByIp.get(key)
  if (!entry || now - entry.startedAt >= windowMs) {
    if (attemptsByIp.size >= 10000) {
      for (const [ip, current] of attemptsByIp) {
        if (now - current.startedAt >= windowMs) attemptsByIp.delete(ip)
      }
    }
    entry = { startedAt: now, count: 0 }
    attemptsByIp.set(key, entry)
  }
  entry.count += 1
  if (entry.count > maxAttempts) {
    return next(new AppError(429, 'Too many login attempts. Please try again later.'))
  }
  return next()
}

module.exports = loginRateLimit
