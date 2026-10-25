const PDFDocument = require('pdfkit')
const payrollService = require('../services/payroll.service')
const AppError = require('../utils/app-error')
const { createRunSchema, idSchema } = require('../utils/payroll-validation')

function parse(schema, value, message) {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new AppError(422, result.error.issues[0]?.message || message)
  }
  return result.data
}

function validateId(req, _res, next, id) {
  if (!idSchema.safeParse(id).success) {
    return next(new AppError(422, 'Payroll ID is invalid'))
  }
  return next()
}

function currency(value) {
  return `PKR ${Number(value).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

module.exports = {
  createRun: async (req, res) => {
    const { month } = parse(createRunSchema, req.body, 'Payroll month is invalid')
    res.status(201).json(await payrollService.createPayrollRun(req.user, month))
  },
  regenerate: async (req, res) => {
    res.json(await payrollService.regeneratePayrollRun(req.params.id, req.user))
  },
  listRuns: async (_req, res) => res.json(await payrollService.listPayrollRuns()),
  getRun: async (req, res) => res.json(await payrollService.getPayrollRun(req.params.id)),
  finalize: async (req, res) => res.json(await payrollService.finalizePayrollRun(req.user, req.params.id)),
  myPayslips: async (req, res) => res.json(await payrollService.getMyPayslips(req.user)),
  downloadPdf: async (req, res) => {
    const [item, companyName] = await Promise.all([
      payrollService.getPayslipForDownload(req.user, req.params.id),
      payrollService.getCompanyName(),
    ])
    const employeeName = item.employee.name
    const month = item.run.month
    const filename = `payslip-${month}-${item.employee.code}.pdf`
    res.status(200)
      .type('application/pdf')
      .attachment(filename)
    const document = new PDFDocument({ size: 'A4', margin: 52 })
    document.pipe(res)
    document.fontSize(20).font('Helvetica-Bold').text(companyName)
    document.moveDown(0.4).fontSize(15).text('Payslip')
    document.moveDown(0.3).fontSize(11).font('Helvetica')
    document.text(`Employee: ${employeeName} (${item.employee.code})`)
    document.text(`Email: ${item.employee.email}`)
    document.text(`Month: ${month}`)
    document.text(`Department: ${item.employee.department?.name || item.employeeSnapshot.department || '—'}`)
    document.text(`Designation: ${item.employee.designation?.name || item.employeeSnapshot.designation || '—'}`)
    document.moveDown()
    document.font('Helvetica-Bold').text('Earnings')
    document.font('Helvetica')
    document.text(`Basic salary: ${currency(item.basic)}`)
    document.text(`HRA: ${currency(item.hra)}`)
    document.text(`Medical: ${currency(item.medical)}`)
    document.text(`Gross: ${currency(item.gross)}`)
    document.text(`Payable working days: ${item.daysPayable} of ${item.workingDays}`)
    document.moveDown()
    document.font('Helvetica-Bold').text('Deductions')
    document.font('Helvetica')
    document.text(`Absent days: ${item.absentDays}`)
    document.text(`Unpaid leave days: ${item.unpaidLeaveDays}`)
    document.text(`Half days: ${item.halfDays}`)
    document.text(`Attendance and leave deduction: ${currency(item.deduction)}`)
    document.text(`Annual tax: ${currency(item.annualTax)}`)
    document.text(`Monthly tax: ${currency(item.monthlyTax)}`)
    document.moveDown()
    document.font('Helvetica-Bold').fontSize(15).text(`Net pay: ${currency(item.netPay)}`)
    document.end()
  },
  validateId,
}
