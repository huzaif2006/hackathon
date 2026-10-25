const mongoose = require('mongoose')

const leaveRequestSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    leaveType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeaveType',
      required: true,
    },
    startDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    endDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    days: {
      type: Number,
      required: true,
      min: 1,
    },
    yearlyDays: {
      type: [{
        year: { type: Number, required: true },
        days: { type: Number, required: true, min: 0 },
      }],
      default: [],
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      required: true,
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
    reviewComment: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true },
)

leaveRequestSchema.index({ employee: 1, status: 1, startDate: 1, endDate: 1 })
leaveRequestSchema.index({ status: 1, createdAt: -1 })

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema)
