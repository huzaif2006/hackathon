const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/user.model')
const AppError = require('../utils/app-error')

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId || null,
    mustChangePassword: user.mustChangePassword,
  }
}

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required')
  }

  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      employeeId: user.employeeId || null,
      tokenVersion: user.tokenVersion || 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: '12h' },
  )
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash +tokenVersion')

  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, 'Invalid email or password')
  }

  return {
    token: createToken(user),
    user: toPublicUser(user),
  }
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash +tokenVersion')

  if (!user || !user.isActive) {
    throw new AppError(401, 'Invalid or inactive account')
  }

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError(401, 'Current password is incorrect')
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12)
  user.mustChangePassword = false
  user.tokenVersion = (user.tokenVersion || 0) + 1
  await user.save()

  return toPublicUser(user)
}

module.exports = { changePassword, login, toPublicUser }
