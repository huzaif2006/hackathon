import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../api/axios.js'
import TemporaryPasswordDialog from '../components/TemporaryPasswordDialog.jsx'
import { useAuth } from '../context/useAuth.js'
import { getRequestErrorMessage } from '../utils/request-error.js'

function EmployeeProfilePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [employee, setEmployee] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [credentials, setCredentials] = useState([])

  const loadEmployee = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const { data } = await api.get(`/api/employees/${id}`)
      setEmployee(data.employee)
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    let isMounted = true
    Promise.resolve().then(() => {
      if (isMounted) return loadEmployee()
      return undefined
    })
    return () => { isMounted = false }
  }, [loadEmployee])

  async function manageLogin(action) {
    setError('')
    setNotice('')
    try {
      const { data } = await api.post(`/api/employees/${id}/${action}`)
      if (action === 'reset-password') {
        setCredentials([{
          name: data.user.name,
          email: data.user.email,
          temporaryPassword: data.temporaryPassword,
        }])
      } else {
        setNotice('Employee login deactivated.')
      }
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    }
  }

  if (isLoading) {
    return <p className="p-8 text-center text-slate-600">Loading employee profile...</p>
  }

  if (error && !employee) {
    return (
      <section className="mx-auto max-w-3xl rounded-2xl bg-white p-6">
        <p className="text-rose-700" role="alert">{error}</p>
        <button className="mt-4 rounded-lg border px-4 py-2" onClick={loadEmployee} type="button">Try again</button>
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-4xl">
      <Link className="text-sm font-medium text-indigo-700 hover:underline" to="/employees">← Back to employees</Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-600">Employee 360</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{employee.name}</h1>
          <p className="mt-1 text-sm text-slate-500">{employee.code} · {employee.email}</p>
        </div>
        {user.role === 'hr' && (
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" to={`/employees/${id}/edit`}>Edit employee</Link>
            <button className="rounded-lg border border-indigo-200 px-3 py-2 text-sm font-semibold text-indigo-700" onClick={() => manageLogin('reset-password')} type="button">Reset password</button>
            <button className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700" onClick={() => {
              if (window.confirm('Deactivate this employee login?')) manageLogin('deactivate')
            }} type="button">Deactivate login</button>
          </div>
        )}
      </div>
      {error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p>}
      {notice && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
      <dl className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-2">
        {[
          ['Phone', employee.phone || '—'],
          ['Address', employee.address || '—'],
          ['Gender', employee.gender],
          ['Department', employee.department?.name || '—'],
          ['Designation', employee.designation?.name || '—'],
          ['Join date', employee.joinDate.slice(0, 10)],
          ['Status', employee.status],
          ['Exit date', employee.exitDate ? employee.exitDate.slice(0, 10) : '—'],
          ...(user.role !== 'employee' ? [['Basic salary', Number(employee.basicSalary).toLocaleString()]] : []),
        ].map(([label, value]) => (
          <div className="bg-white p-4 sm:p-5" key={label}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-2 break-words text-sm font-medium capitalize text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
      <TemporaryPasswordDialog
        credentials={credentials}
        onClose={() => setCredentials([])}
        title="Temporary password reset"
      />
    </section>
  )
}

export default EmployeeProfilePage
