const mongoose = require('mongoose')

const employeeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    designation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Designation',
      required: true,
    },
    joinDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'probation', 'exited'],
      default: 'active',
      required: true,
    },
    exitDate: {
      type: Date,
      default: undefined,
    },
    basicSalary: {
      type: Number,
      required: true,
      min: 0.01,
    },
  },
  { timestamps: true },
)

employeeSchema.index({ name: 1 })

module.exports = mongoose.model('Employee', employeeSchema)
