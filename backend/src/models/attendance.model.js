const mongoose = require('mongoose')

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    checkIn: {
      type: Date,
      required: true,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['present', 'late', 'half_day', 'absent', 'missing_checkout', 'on_leave'],
      required: true,
    },
    workedHours: {
      type: Number,
      default: 0,
      min: 0,
    },
    source: {
      type: String,
      enum: ['web'],
      default: 'web',
      required: true,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
    settingsSnapshot: {
      timezone: { type: String, default: 'Asia/Karachi' },
      officeStart: { type: String, default: '09:00' },
      graceMinutes: { type: Number, default: 15 },
      halfDayHours: { type: Number, default: 5 },
    },
  },
  { timestamps: true },
)

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true })
attendanceSchema.index({ date: 1, status: 1 })

module.exports = mongoose.model('Attendance', attendanceSchema)
