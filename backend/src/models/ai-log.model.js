const mongoose = require('mongoose')

const aiLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['admin', 'hr', 'employee'],
      required: true,
    },
    message: {
      type: String,
      required: true,
      maxlength: 4000,
    },
    toolsUsed: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['success', 'fallback', 'invalid_input', 'invalid_output', 'rate_limited'],
      required: true,
    },
    duration: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    collection: 'ai_logs',
    timestamps: { createdAt: true, updatedAt: false },
  },
)

aiLogSchema.index({ user: 1, createdAt: -1 })

module.exports = mongoose.model('AiLog', aiLogSchema)
