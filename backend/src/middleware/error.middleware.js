function errorHandler(error, _req, res, _next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      message: error.message,
      ...(error.details || {}),
    })
  }

  if (error.code === 11000) {
    const duplicateField = Object.keys(error.keyPattern || {})[0]
    const messages = {
      code: 'Employee code already exists',
      email: 'An account with this email already exists',
      nameKey: 'A record with this name already exists',
      date: 'A holiday already exists on this date',
    }
    return res.status(409).json({
      message: messages[duplicateField] || 'A record with these details already exists',
    })
  }

  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(422).json({ message: 'Submitted data is invalid' })
  }

  console.error('Request failed:', error.name || 'Error')
  return res.status(500).json({ message: 'An unexpected server error occurred' })
}

module.exports = errorHandler
