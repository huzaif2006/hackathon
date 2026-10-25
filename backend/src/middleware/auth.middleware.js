const jwt = require('jsonwebtoken')
const User = require('../models/user.model')
const AppError = require('../utils/app-error')

function authenticate(req, res, next) {
  const authorization = req.get('authorization')
  const [scheme, token] = authorization ? authorization.split(' ') : []

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError(401, 'Authentication required'))
  }

  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET)

    if (!claims.userId || !claims.role) {
      return next(new AppError(401, 'Invalid or expired token'))
    }

    User.findById(claims.userId).select('+tokenVersion')
      .then((user) => {
        if (!user || !user.isActive) {
          return next(new AppError(401, 'Invalid or inactive account'))
        }

        if (claims.tokenVersion !== (user.tokenVersion || 0)) {
          return next(new AppError(401, 'Session expired; please sign in again'))
        }

        req.user = {
          userId: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          employeeId: user.employeeId || null,
          mustChangePassword: user.mustChangePassword,
        }

        return next()
      })
      .catch(next)
  } catch (_error) {
    return next(new AppError(401, 'Invalid or expired token'))
  }
}

function authorizeRoles(...roles) {
  return function authorizeRequest(req, _res, next) {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required'))
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'You do not have permission to access this resource'))
    }

    return next()
  }
}

function requirePasswordChangeComplete(req, _res, next) {
  if (req.user.mustChangePassword) {
    return next(new AppError(403, 'Change your password before using this resource'))
  }

  return next()
}

function getEmployeeIdScope(user, requestedEmployeeId) {
  if (user.role !== 'employee') {
    return requestedEmployeeId || undefined
  }

  if (!user.employeeId) {
    throw new AppError(403, 'Employee account has no linked employee record')
  }

  if (requestedEmployeeId && requestedEmployeeId !== user.employeeId) {
    throw new AppError(403, 'You cannot access another employee record')
  }

  return user.employeeId
}

function scopeEmployeeId(req, _res, next) {
  const requestedEmployeeId = req.params.employeeId
    || req.query.employeeId
    || (req.body && req.body.employeeId)

  try {
    req.employeeIdScope = getEmployeeIdScope(req.user, requestedEmployeeId)
    return next()
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  authenticate,
  authorizeRoles,
  getEmployeeIdScope,
  requirePasswordChangeComplete,
  scopeEmployeeId,
}
