const mongoose = require('mongoose')

const leaveTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true, unique: true, select: false },
    yearlyQuota: { type: Number, required: true, min: 0 },
    isUnlimited: { type: Boolean, required: true, default: false },
    isPaid: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
)

leaveTypeSchema.pre('validate', function setNameKey() {
  if (this.name) {
    this.nameKey = this.name.trim().toLocaleLowerCase('en')
  }
})

module.exports = mongoose.model('LeaveType', leaveTypeSchema)
