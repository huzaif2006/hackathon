import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios.js'
import TemporaryPasswordDialog from '../components/TemporaryPasswordDialog.jsx'
import { getRequestErrorMessage } from '../utils/request-error.js'

const importColumns = 'code,name,email,phone,address,gender,department,designation,joinDate,status,exitDate,basicSalary'

function EmployeeImportPage() {
  const [file, setFile] = useState(null)
  const [csvText, setCsvText] = useState('')
  const [dryRun, setDryRun] = useState(null)
  const [errors, setErrors] = useState([])
  const [isChecking, setIsChecking] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState('')
  const [credentials, setCredentials] = useState([])

  async function handleFileChange(event) {
    const selectedFile = event.target.files?.[0]
    setFile(selectedFile || null)
    setDryRun(null)
    setErrors([])
    setError('')
    setCsvText('')
    if (!selectedFile) return

    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setFile(null)
      setError('Choose a .csv file.')
      return
    }
    if (selectedFile.size > 2 * 1024 * 1024) {
      setFile(null)
      setError('CSV file must be 2 MB or smaller.')
      return
    }

    try {
      setCsvText(await selectedFile.text())
    } catch (readError) {
      setFile(null)
      setError(getRequestErrorMessage(readError))
    }
  }

  async function runDryRun() {
    if (!csvText) {
      setError('Choose a CSV file first.')
      return
    }
    setError('')
    setIsChecking(true)
    try {
      const { data } = await api.post('/api/employees/import?dryRun=true', csvText, {
        headers: { 'Content-Type': 'text/csv' },
      })
      setDryRun(data)
      setErrors(data.errors)
    } catch (requestError) {
      setDryRun(null)
      const responseErrors = requestError.response?.data?.errors || []
      setErrors(responseErrors)
      if (responseErrors.length > 0) {
        setDryRun({
          dryRun: true,
          totalRows: requestError.response?.data?.totalRows || 0,
          validRows: requestError.response?.data?.validRows || 0,
          errors: responseErrors,
        })
      }
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsChecking(false)
    }
  }

  async function confirmImport() {
    if (!csvText || !dryRun || dryRun.errors.length > 0 || dryRun.validRows === 0) {
      return
    }
    if (!window.confirm(`Create ${dryRun.validRows} employee accounts? Each temporary password will be shown once.`)) {
      return
    }

    setError('')
    setIsImporting(true)
    try {
      const { data } = await api.post('/api/employees/import?dryRun=false', csvText, {
        headers: { 'Content-Type': 'text/csv' },
      })
      setCredentials(data.created.map(({ user, temporaryPassword }) => ({
        name: user.name,
        email: user.email,
        temporaryPassword,
      })))
      setDryRun(null)
      setErrors([])
      setCsvText('')
      setFile(null)
    } catch (requestError) {
      setErrors(requestError.response?.data?.errors || [])
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl">
      <Link className="text-sm font-medium text-indigo-700 hover:underline" to="/employees">← Back to employees</Link>
      <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Import employees from CSV</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Upload a CSV, review every dry-run validation result, then confirm to create all employee accounts together.
      </p>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">CSV columns</p>
          <code className="mt-2 block break-all text-xs text-slate-600">{importColumns}</code>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Department and designation use their names. Gender: male, female, or other. Dates use YYYY-MM-DD. Optional values may be left blank.
          </p>
        </div>
        {error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p>}
        <label className="mt-5 block text-sm font-medium text-slate-700">
          CSV file
          <input accept=".csv,text/csv" className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" onChange={handleFileChange} type="file" />
        </label>
        {file && <p className="mt-2 text-sm text-slate-500">Selected: {file.name}</p>}
        <button className="mt-5 rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={!csvText || isChecking || isImporting} onClick={runDryRun} type="button">
          {isChecking ? 'Validating CSV...' : 'Run dry run'}
        </button>
      </div>

      {dryRun && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Dry-run results</h2>
          <p className="mt-2 text-sm text-slate-600">
            {dryRun.validRows} valid row(s) of {dryRun.totalRows}; {dryRun.errors.length} issue(s).
          </p>
          {errors.length > 0 ? (
            <div className="mt-4 overflow-x-auto rounded-xl border border-rose-200">
              <table className="min-w-full divide-y divide-rose-100 text-left text-sm">
                <thead className="bg-rose-50 text-xs uppercase tracking-wide text-rose-800">
                  <tr>
                    <th className="px-4 py-3">CSV row</th>
                    <th className="px-4 py-3">Field</th>
                    <th className="px-4 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-100">
                  {errors.map((issue, index) => (
                    <tr key={`${issue.row}-${issue.field}-${index}`}>
                      <td className="px-4 py-3">{issue.row}</td>
                      <td className="px-4 py-3">{issue.field}</td>
                      <td className="px-4 py-3">{issue.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : dryRun.validRows === 0 ? (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">The file has no employee rows to import.</p>
          ) : (
            <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">All rows validated. You can now confirm the import.</p>
          )}
          <button className="mt-5 rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={errors.length > 0 || dryRun.validRows === 0 || isImporting} onClick={confirmImport} type="button">
            {isImporting ? 'Creating employee accounts...' : `Confirm and import ${dryRun.validRows} employee(s)`}
          </button>
        </section>
      )}

      <TemporaryPasswordDialog
        credentials={credentials}
        onClose={() => setCredentials([])}
        title="CSV import complete"
      />
    </section>
  )
}

export default EmployeeImportPage
