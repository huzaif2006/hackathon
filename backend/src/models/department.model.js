const mongoose = require('mongoose')

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true, unique: true, select: false },
  },
  { timestamps: true },
)

departmentSchema.pre('validate', function setNameKey() {
  if (this.name) {
    this.nameKey = this.name.trim().toLocaleLowerCase('en')
  }
})

module.exports = mongoose.model('Department', departmentSchema)
