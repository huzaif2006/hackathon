const mongoose = require('mongoose')

const companySchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: 'primary',
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    officeStart: {
      type: String,
      default: '09:00',
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    graceMinutes: {
      type: Number,
      default: 15,
      min: 0,
    },
    halfDayHours: {
      type: Number,
      default: 5,
      min: 0,
    },
    weekend: {
      type: [String],
      default: ['Sat', 'Sun'],
      enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
    latitude: {
      type: Number,
      default: null,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      default: null,
      min: -180,
      max: 180,
    },
    radiusMeters: {
      type: Number,
      default: 150,
      min: 1,
    },
    timezone: {
      type: String,
      default: 'Asia/Karachi',
      trim: true,
    },
  },
  { timestamps: true },
)

module.exports = mongoose.model('Company', companySchema)
