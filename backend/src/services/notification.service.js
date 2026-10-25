const mongoose = require('mongoose')
const Notification = require('../models/notification.model')
const AppError = require('../utils/app-error')

async function listNotifications(user) {
  const [items, unreadCount] = await Promise.all([
    Notification.find({ user: user.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('title message isRead createdAt'),
    Notification.countDocuments({ user: user.userId, isRead: false }),
  ])
  return { items, unreadCount }
}

async function markNotificationRead(user, id) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(422, 'Notification ID is invalid')
  }
  const notification = await Notification.findOneAndUpdate(
    { _id: id, user: user.userId },
    { $set: { isRead: true } },
    { returnDocument: 'after', runValidators: true },
  ).select('title message isRead createdAt')
  if (!notification) {
    throw new AppError(404, 'Notification not found')
  }
  return { notification }
}

module.exports = { listNotifications, markNotificationRead }
