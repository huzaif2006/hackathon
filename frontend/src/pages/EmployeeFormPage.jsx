import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../api/axios.js'
import TemporaryPasswordDialog from '../components/TemporaryPasswordDialog.jsx'
import { getRequestErrorMessage } from '../utils/request-error.js'

const initialForm = {
  code: '',
  name: '',
  email: '',
  phone: '',
  address: '',
  gender: 'other',
  department: '',
  designation: '',
  joinDate: '',
  status: 'active',
  exitDate: '',
  basicSalary: '',
}

function EmployeeFormPage() {
  const { id } = useParams()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [departments, setDepartments] = useState([])
  const [designations, setDesignations] = useState([])
  const [credentials, setCredentials] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const loadFormData = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const requests = [
        api.get('/api/employees/departments'),
        api.get('/api/employees/designations'),
      ]
      if (isEditing) {
        requests.push(api.get(`/api/employees/${id}`))
      }
      const results = await Promise.all(requests)
      setDepartments(results[0].data.items)
      setDesignations(results[1].data.items)
      if (isEditing) {
        const employee = results[2].data.employee
        setForm({
          code: employee.code,
          name: employee.name,
          email: employee.email,
          phone: employee.phone || '',
          address: employee.address || '',
          gender: employee.gender,
          department: employee.department?._id || employee.department,
          designation: employee.designation?._id || employee.designation,
          joinDate: employee.joinDate.slice(0, 10),
          status: employee.status,
          exitDate: employee.exitDate ? employee.exitDate.slice(0, 10) : '',
          basicSalary: employee.basicSalary,
        })
      }
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [id, isEditing])

  useEffect(() => {
    let isMounted = true
    Promise.resolve().then(() => {
      if (isMounted) return loadFormData()
      return undefined
    })
    return () => { isMounted = false }
  }, [loadFormData])

  function updateField(event) {
    const { name, value } = event.target
    setForm((previous) => ({ ...previous, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSaving(true)
    const payload = {
      ...form,
      basicSalary: Number(form.basicSalary),
      ...(form.exitDate ? {} : { exitDate: undefined }),
    }

    try {
      if (isEditing) {
        await api.put(`/api/employees/${id}`, payload)
        navigate(`/employees/${id}`, { replace: true })
      } else {
        const { data } = await api.post('/api/employees', payload)
        setCredentials([{
          name: data.user.name,
          email: data.user.email,
          temporaryPassword: data.temporaryPassword,
        }])
      }
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <p className="p-8 text-center text-slate-600">Loading employee form...</p>
  }

  if (!departments.length || !designations.length) {
    return (
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <Link className="text-sm font-medium text-indigo-700 hover:underline" to="/employees">← Back to employees</Link>
        <h1 className="mt-4 text-2xl font-bold">Employee setup needs organization data</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Add at least one department and designation before registering an employee.
        </p>
        <Link className="mt-5 inline-block rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700" to="/settings/departments">
          Open organization settings
        </Link>
        {error && <p className="mt-4 text-sm text-rose-700" role="alert">{error}</p>}
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-4xl">
      <Link className="text-sm font-medium text-indigo-700 hover:underline" to={isEditing ? `/employees/${id}` : '/employees'}>← Back to employees</Link>
      <h1 className="mt-4 text-2xl font-bold sm:text-3xl">{isEditing ? 'Edit employee' : 'Add employee'}</h1>
      <p className="mt-2 text-sm text-slate-500">
        {isEditing ? 'Changes to login name and email are synced to the employee account.' : 'A login with a temporary password will be created with this employee.'}
      </p>
      {error && (
        <div className="mt-5 rounded-lg bg-rose-50 p-4 text-sm text-rose-700" role="alert">
          <p>{error}</p>
          <button className="mt-2 font-semibold underline" onClick={loadFormData} type="button">Reload form</button>
        </div>
      )}
      {!isLoading && (
        <form className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 sm:p-7" onSubmit={handleSubmit}>
          <label className="text-sm font-medium text-slate-700">
            Employee code
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" onChange={updateField} required value={form.code} name="code" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Full name
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" onChange={updateField} required value={form.name} name="name" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Email
            <input autoComplete="email" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" onChange={updateField} required type="email" value={form.email} name="email" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Phone
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" onChange={updateField} value={form.phone} name="phone" />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Address
            <textarea className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" onChange={updateField} rows="2" value={form.address} name="address" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Gender
            <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" onChange={updateField} value={form.gender} name="gender">
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Department
            <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" onChange={updateField} required value={form.department} name="department">
              <option value="">Select department</option>
              {departments.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Designation
            <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" onChange={updateField} required value={form.designation} name="designation">
              <option value="">Select designation</option>
              {designations.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Join date
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" onChange={updateField} required type="date" value={form.joinDate} name="joinDate" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Status
            <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" onChange={updateField} value={form.status} name="status">
              <option value="active">Active</option>
              <option value="probation">Probation</option>
              <option value="exited">Exited</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Exit date
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" onChange={updateField} type="date" value={form.exitDate} name="exitDate" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Basic salary
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" min="0.01" onChange={updateField} required step="0.01" type="number" value={form.basicSalary} name="basicSalary" />
          </label>
          <div className="flex flex-wrap gap-3 pt-2 sm:col-span-2">
            <button className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60" disabled={isSaving} type="submit">
              {isSaving ? 'Saving...' : isEditing ? 'Save changes' : 'Create employee'}
            </button>
            <Link className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50" to="/employees">Cancel</Link>
          </div>
        </form>
      )}
      <TemporaryPasswordDialog
        credentials={credentials}
        onClose={() => navigate('/employees', { replace: true })}
        title="Employee account created"
      />
    </section>
  )
}

export default EmployeeFormPage
