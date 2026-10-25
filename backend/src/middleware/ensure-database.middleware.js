const { connectToDatabase } = require('../db/connect')

async function ensureDatabase(req, res, next) {
  try {
    await connectToDatabase()
    return next()
  } catch (error) {
    console.error('Database connection unavailable:', error.name || 'Error')
    return res.status(503).json({
      message: 'The database is temporarily unavailable. Please try again shortly.',
    })
  }
}

module.exports = ensureDatabase
