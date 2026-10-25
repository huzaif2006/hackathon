const Announcement = require('../models/announcement.model')
const auditService = require('./audit.service')

async function listAnnouncements(limit = 20) {
  const items = await Announcement.find()
    .populate('createdBy', 'name role')
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean()
  return { items }
}

async function createAnnouncement(user, data) {
  const announcement = await Announcement.create({ ...data, createdBy: user.userId })
  await auditService.logAction({
    actor: user.userId,
    action: 'announcement.create',
    entityType: 'Announcement',
    entityId: announcement.id,
    after: announcement,
  })
  return { announcement }
}

module.exports = { createAnnouncement, listAnnouncements }
