const mongoose = require('mongoose')

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)

announcementSchema.index({ createdAt: -1 })

module.exports = mongoose.model('Announcement', announcementSchema)
