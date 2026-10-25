const mongoose = require('mongoose')

const attendanceCorrectionSchema = new mongoose.Schema(
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
    requestedCheckIn: {
      type: String,
      default: '',
      match: /^$|^([01]\d|2[0-3]):[0-5]\d$/,
    },
    requestedCheckOut: {
      type: String,
      default: '',
      match: /^$|^([01]\d|2[0-3]):[0-5]\d$/,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      required: true,
    },
    comment: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
)

attendanceCorrectionSchema.index(
  { employee: 1, date: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
)

module.exports = mongoose.model('AttendanceCorrection', attendanceCorrectionSchema)
