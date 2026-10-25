const announcementService = require('../services/announcement.service')
const AppError = require('../utils/app-error')
const { announcementSchema, announcementsQuerySchema } = require('../utils/audit-validation')

module.exports = {
  create: async (req, res) => {
    const result = announcementSchema.safeParse(req.body)
    if (!result.success) {
      throw new AppError(422, result.error.issues[0]?.message || 'Announcement is invalid')
    }
    res.status(201).json(await announcementService.createAnnouncement(req.user, result.data))
  },
  list: async (req, res) => {
    const result = announcementsQuerySchema.safeParse(req.query)
    if (!result.success) {
      throw new AppError(422, result.error.issues[0]?.message || 'Announcement filters are invalid')
    }
    res.json(await announcementService.listAnnouncements(result.data.limit))
  },
}
