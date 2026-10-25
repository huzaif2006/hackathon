import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios.js'
import { useAuth } from '../context/useAuth.js'
import { getRequestErrorMessage } from '../utils/request-error.js'

function EmployeesPage() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0, limit: 10 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDepartments = useCallback(async () => {
    const { data } = await api.get('/api/employees/departments')
    setDepartments(data.items)
  }, [])

  const loadEmployees = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const { data } = await api.get('/api/employees', {
        params: { search: search || undefined, department: department || undefined, status: status || undefined, page, limit: 10 },
      })
      setEmployees(data.items)
      setPagination(data.pagination)
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [department, page, search, status])

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [searchInput])

  useEffect(() => {
    let isMounted = true
    Promise.resolve().then(async () => {
      if (!isMounted) return
      try {
        await loadDepartments()
      } catch (requestError) {
        if (isMounted) setError(getRequestErrorMessage(requestError))
      }
    })
    return () => { isMounted = false }
  }, [loadDepartments])

  useEffect(() => {
    let isMounted = true
    Promise.resolve().then(() => {
      if (isMounted) return loadEmployees()
      return undefined
    })
    return () => { isMounted = false }
  }, [loadEmployees])

  async function exportCsv() {
    setError('')
    try {
      const { data } = await api.get('/api/employees/export', { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = 'employees.csv'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-600">People</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Employees</h1>
          <p className="mt-2 text-sm text-slate-500">{pagination.total} employees</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.role === 'hr' && (
            <>
              <Link className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" to="/employees/import">Import CSV</Link>
              <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={exportCsv} type="button">Export CSV</button>
              <Link className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700" to="/employees/new">Add employee</Link>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <label className="text-sm font-medium text-slate-700 sm:col-span-1">
          Search
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" onChange={(event) => {
            setPage(1)
            setSearchInput(event.target.value)
          }} placeholder="Name, code, or email" type="search" value={searchInput} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Department
          <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" onChange={(event) => {
            setPage(1)
            setDepartment(event.target.value)
          }} value={department}>
            <option value="">All departments</option>
            {departments.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Status
          <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" onChange={(event) => {
            setPage(1)
            setStatus(event.target.value)
          }} value={status}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="probation">Probation</option>
            <option value="exited">Exited</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700" role="alert">
          <p>{error}</p>
          <button className="mt-2 font-semibold underline" onClick={loadEmployees} type="button">Try again</button>
        </div>
      )}
      {isLoading ? (
        <p className="mt-8 text-center text-slate-600">Loading employees...</p>
      ) : employees.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="font-semibold text-slate-800">No employees found</h2>
          <p className="mt-2 text-sm text-slate-500">
            {search || department || status ? 'Try changing the search or filters.' : 'Employees will appear after HR registers them.'}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {['Code', 'Employee', 'Department', 'Designation', 'Status', ...(user.role === 'admin' ? ['Basic salary'] : []), ''].map((heading) => <th className="whitespace-nowrap px-4 py-3 font-semibold" key={heading}>{heading}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((employee) => (
                  <tr key={employee._id}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{employee.code}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="font-medium text-slate-800">{employee.name}</p>
                      <p className="text-xs text-slate-500">{employee.email}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{employee.department?.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{employee.designation?.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 capitalize text-slate-600">{employee.status}</td>
                    {user.role === 'admin' && <td className="whitespace-nowrap px-4 py-3 text-slate-600">{Number(employee.basicSalary).toLocaleString()}</td>}
                    <td className="whitespace-nowrap px-4 py-3"><Link className="font-semibold text-indigo-700 hover:underline" to={`/employees/${employee._id}`}>View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">Page {pagination.page} of {Math.max(pagination.pages, 1)}</p>
            <div className="flex gap-2">
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button">Previous</button>
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-40" disabled={page >= pagination.pages} onClick={() => setPage((current) => current + 1)} type="button">Next</button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export default EmployeesPage
