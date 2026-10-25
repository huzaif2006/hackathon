const mongoose = require('mongoose')

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, trim: true, maxlength: 100, index: true },
    entityType: { type: String, required: true, trim: true, maxlength: 100, index: true },
    entityId: { type: String, required: true, trim: true, maxlength: 100, index: true },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    collection: 'audit_logs',
    timestamps: { createdAt: true, updatedAt: false },
  },
)

auditLogSchema.index({ createdAt: -1 })

for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete']) {
  auditLogSchema.pre(operation, function preventAuditMutation() {
    throw new Error('Audit log entries are immutable')
  })
}

module.exports = mongoose.model('AuditLog', auditLogSchema)
