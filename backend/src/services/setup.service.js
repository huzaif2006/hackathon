const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')
const Company = require('../models/company.model')
const User = require('../models/user.model')
const AppError = require('../utils/app-error')

async function getSetupStatus() {
  return { setupComplete: Boolean(await User.exists({})) }
}

async function createInitialAdmin({ companyName, name, email, password }) {
  const session = await mongoose.startSession()
  let response
  try {
    await session.withTransaction(async () => {
      if (await User.exists({}).session(session)) {
        throw new AppError(403, 'Initial setup has already been completed')
      }
      const [company] = await Company.create([{ _id: 'primary', name: companyName }], { session })
      const passwordHash = await bcrypt.hash(password, 12)
      const [user] = await User.create([{
        name,
        email,
        passwordHash,
        role: 'admin',
        isActive: true,
        mustChangePassword: false,
      }], { session })

      response = {
        company: { name: company.name },
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          employeeId: user.employeeId || null,
          mustChangePassword: user.mustChangePassword,
        },
      }
    })
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern?._id) {
        throw new AppError(403, 'Initial setup has already been completed')
      }
      throw new AppError(409, 'An account with this email already exists')
    }
    throw error
  } finally {
    await session.endSession()
  }
  return response
}

module.exports = { createInitialAdmin, getSetupStatus }
