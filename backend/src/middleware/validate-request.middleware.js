const AppError = require('../utils/app-error')

function validateBody(schema) {
  return function validateRequestBody(req, _res, next) {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      return next(new AppError(422, 'Request body is invalid'))
    }

    req.body = result.data
    return next()
  }
}

module.exports = validateBody
