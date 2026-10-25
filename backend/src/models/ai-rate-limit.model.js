const mongoose = require('mongoose')

const aiRateLimitSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    windowStart: {
      type: Date,
      required: true,
    },
    count: {
      type: Number,
      required: true,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    collection: 'ai_rate_limits',
    timestamps: false,
  },
)

aiRateLimitSchema.index({ user: 1 }, { unique: true })
aiRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model('AiRateLimit', aiRateLimitSchema)
