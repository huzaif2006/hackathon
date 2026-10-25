const mongoose = require('mongoose')

const connectionCacheKey = '__hcmLiteMongoConnection'

async function connectToDatabase() {
  const uri = process.env.MONGO_URI
  if (!uri) {
    throw new Error('MONGO_URI is required')
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection
  }

  const cached = globalThis[connectionCacheKey]
  if (cached?.uri === uri && cached.promise) {
    await cached.promise
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection
    }
  }

  const connection = {
    uri,
    promise: mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 }),
  }
  globalThis[connectionCacheKey] = connection

  try {
    await connection.promise
    return mongoose.connection
  } catch (error) {
    if (globalThis[connectionCacheKey] === connection) {
      delete globalThis[connectionCacheKey]
    }
    throw error
  }
}

module.exports = { connectToDatabase }
