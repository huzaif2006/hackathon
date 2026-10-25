const notificationService = require('../services/notification.service')

module.exports = {
  list: async (req, res) => res.json(await notificationService.listNotifications(req.user)),
  markRead: async (req, res) => res.json(await notificationService.markNotificationRead(req.user, req.params.id)),
}
