require('dotenv').config()

const app = require('./app')
const { connectToDatabase } = require('./db/connect')

const port = Number(process.env.PORT || 5000)

async function startServer() {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port')
  }

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required')
  }

  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required')
  }

  await connectToDatabase()
  app.listen(port, () => {
    console.log(`HCM Lite backend listening on port ${port}`)
  })
}

startServer().catch((error) => {
  console.error('Failed to start backend:', error)
  process.exit(1)
})
