const mongoose = require('mongoose')

const designationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true, unique: true, select: false },
  },
  { timestamps: true },
)

designationSchema.pre('validate', function setNameKey() {
  if (this.name) {
    this.nameKey = this.name.trim().toLocaleLowerCase('en')
  }
})

module.exports = mongoose.model('Designation', designationSchema)
