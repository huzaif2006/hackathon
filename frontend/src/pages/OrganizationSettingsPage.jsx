import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios.js'
import { useAuth } from '../context/useAuth.js'
import { getRequestErrorMessage } from '../utils/request-error.js'

const sections = [
  { key: 'company', label: 'Company settings' },
  { key: 'departments', label: 'Departments' },
  { key: 'designations', label: 'Designations' },
  { key: 'leave-types', label: 'Leave types' },
  { key: 'holidays', label: 'Holidays' },
  { key: 'hr-users', label: 'HR users', adminOnly: true },
]

const resources = {
  departments: {
    title: 'Departments',
    singular: 'department',
    endpoint: '/api/organization/departments',
    fields: [{ key: 'name', label: 'Name', type: 'text', required: true }],
  },
  designations: {
    title: 'Designations',
    singular: 'designation',
    endpoint: '/api/organization/designations',
    fields: [{ key: 'name', label: 'Name', type: 'text', required: true }],
  },
  'leave-types': {
    title: 'Leave types',
    singular: 'leave type',
    endpoint: '/api/organization/leave-types',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'yearlyQuota', label: 'Yearly quota (days)', type: 'number', min: 0, required: true },
      { key: 'isUnlimited', label: 'Unlimited quota', type: 'checkbox' },
      { key: 'isPaid', label: 'Paid leave', type: 'checkbox' },
    ],
  },
  holidays: {
    title: 'Holidays',
    singular: 'holiday',
    endpoint: '/api/organization/holidays',
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true },
    ],
  },
  'hr-users': {
    title: 'HR users',
    singular: 'HR user',
    endpoint: '/api/organization/hr-users',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
    ],
  },
}

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const emptyCompany = {
  name: '',
  officeStart: '09:00',
  graceMinutes: 15,
  halfDayHours: 5,
  weekend: ['Sat', 'Sun'],
  latitude: '',
  longitude: '',
  radiusMeters: 150,
  timezone: 'Asia/Karachi',
}

function ErrorMessage({ message }) {
  if (!message) {
    return null
  }

  return <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{message}</p>
}

function Tabs({ section, userRole }) {
  return (
    <nav aria-label="Organization settings" className="mt-6 flex gap-2 overflow-x-auto pb-2">
      {sections
        .filter((item) => !item.adminOnly || userRole === 'admin')
        .map((item) => (
          <Link
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${section === item.key ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
            key={item.key}
            to={item.key === 'hr-users' ? '/settings/hr-users' : `/settings/${item.key}`}
          >
            {item.label}
          </Link>
        ))}
    </nav>
  )
}

function CompanySettings({ readOnly }) {
  const [company, setCompany] = useState(emptyCompany)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadCompany = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const { data } = await api.get('/api/organization/company')
      setCompany({
        ...emptyCompany,
        ...data.company,
        latitude: data.company.latitude ?? '',
        longitude: data.company.longitude ?? '',
      })
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    Promise.resolve().then(() => {
      if (isMounted) {
        return loadCompany()
      }
      return undefined
    })

    return () => {
      isMounted = false
    }
  }, [loadCompany])

  function updateField(event) {
    const { name, type, value, checked } = event.target
    setCompany((previous) => ({
      ...previous,
      [name]: type === 'number' ? value : type === 'checkbox' ? checked : value,
    }))
  }

  function toggleWeekend(day) {
    setCompany((previous) => ({
      ...previous,
      weekend: previous.weekend.includes(day)
        ? previous.weekend.filter((item) => item !== day)
        : [...previous.weekend, day],
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSaving(true)
    try {
      const payload = {
        ...company,
        graceMinutes: Number(company.graceMinutes),
        halfDayHours: Number(company.halfDayHours),
        latitude: company.latitude === '' ? null : Number(company.latitude),
        longitude: company.longitude === '' ? null : Number(company.longitude),
        radiusMeters: Number(company.radiusMeters),
      }
      const { data } = await api.put('/api/organization/company', payload)
      setCompany({
        ...data.company,
        latitude: data.company.latitude ?? '',
        longitude: data.company.longitude ?? '',
      })
      setNotice('Company settings saved.')
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <p className="mt-6 text-sm text-slate-600">Loading company settings...</p>
  }

  if (error) {
    return (
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <h2 className="text-lg font-semibold">Company settings</h2>
        <ErrorMessage message={error} />
        <button className="mt-4 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700" onClick={loadCompany} type="button">
          Try again
        </button>
      </section>
    )
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <div>
        <h2 className="text-lg font-semibold">Company settings</h2>
        <p className="mt-1 text-sm text-slate-500">These defaults apply to new records; they do not change historical records.</p>
      </div>
      <ErrorMessage message={error} />
      {notice && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
      <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
          Company name
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" disabled={readOnly} name="name" onChange={updateField} required value={company.name} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Office start
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" disabled={readOnly} name="officeStart" onChange={updateField} required type="time" value={company.officeStart} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Company timezone (IANA)
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" disabled={readOnly} name="timezone" onChange={updateField} placeholder="Asia/Karachi" required value={company.timezone || 'Asia/Karachi'} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Grace period (minutes)
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" disabled={readOnly} min="0" max="240" name="graceMinutes" onChange={updateField} required type="number" value={company.graceMinutes} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Half-day threshold (hours)
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" disabled={readOnly} min="0.25" max="24" name="halfDayHours" onChange={updateField} required step="0.25" type="number" value={company.halfDayHours} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Office radius (meters)
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" disabled={readOnly} min="1" max="100000" name="radiusMeters" onChange={updateField} required type="number" value={company.radiusMeters} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Office latitude
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" disabled={readOnly} max="90" min="-90" name="latitude" onChange={updateField} step="any" type="number" value={company.latitude} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Office longitude
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" disabled={readOnly} max="180" min="-180" name="longitude" onChange={updateField} step="any" type="number" value={company.longitude} />
        </label>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium text-slate-700">Weekend</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {weekdays.map((day) => (
              <label className="flex items-center gap-2 text-sm text-slate-600" key={day}>
                <input checked={company.weekend.includes(day)} disabled={readOnly} onChange={() => toggleWeekend(day)} type="checkbox" />
                {day}
              </label>
            ))}
          </div>
        </fieldset>
        {!readOnly && (
          <div className="sm:col-span-2">
            <button className="rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60" disabled={isSaving} type="submit">
              {isSaving ? 'Saving...' : 'Save settings'}
            </button>
          </div>
        )}
      </form>
    </section>
  )
}

function ResourceSettings({ section, readOnly }) {
  const resource = resources[section]
  const [items, setItems] = useState([])
  const [values, setValues] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [notice, setNotice] = useState('')

  const loadItems = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const { data } = await api.get(resource.endpoint)
      setItems(section === 'hr-users' ? data.users : data.items)
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [resource.endpoint, section])

  useEffect(() => {
    let isMounted = true
    Promise.resolve().then(() => {
      if (isMounted) {
        return loadItems()
      }
      return undefined
    })

    return () => {
      isMounted = false
    }
  }, [loadItems])

  function resetForm() {
    setValues({})
    setEditingId(null)
  }

  function beginEdit(item) {
    setEditingId(item._id)
    setValues(Object.fromEntries(resource.fields.map(({ key }) => {
      const value = item[key] ?? ''
      return [key, key === 'date' && value ? value.slice(0, 10) : value]
    })))
    setError('')
  }

  function updateField(event) {
    const { name, type, value, checked } = event.target
    setValues((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setTemporaryPassword('')
    setIsSaving(true)
    const payload = { ...values }
    for (const field of resource.fields) {
      if (field.type === 'number') {
        payload[field.key] = Number(payload[field.key])
      }
    }

    try {
      if (section === 'hr-users') {
        const { data } = await api.post(resource.endpoint, payload)
        setTemporaryPassword(data.temporaryPassword)
        setNotice('HR user created. Copy the temporary password now; it will not be shown again.')
      } else if (editingId) {
        await api.put(`${resource.endpoint}/${editingId}`, payload)
        setNotice(`${resource.singular} updated.`)
      } else {
        await api.post(resource.endpoint, payload)
        setNotice(`${resource.singular} added.`)
      }
      resetForm()
      await loadItems()
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteItem(item) {
    if (!window.confirm(`Delete this ${resource.singular}?`)) {
      return
    }
    setError('')
    setNotice('')
    try {
      await api.delete(`${resource.endpoint}/${item._id}`)
      setNotice(`${resource.singular} deleted.`)
      await loadItems()
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    }
  }

  async function manageHrUser(item, action) {
    setError('')
    setNotice('')
    setTemporaryPassword('')
    try {
      const { data } = await api.post(`${resource.endpoint}/${item._id}/${action}`)
      if (action === 'reset-password') {
        setTemporaryPassword(data.temporaryPassword)
        setNotice('Password reset. Copy the temporary password now; it will not be shown again.')
      } else {
        setNotice('HR account deactivated.')
      }
      await loadItems()
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    }
  }

  function displayValue(item, field) {
    if (field.key === 'date') {
      return item.date.slice(0, 10)
    }
    if (field.type === 'checkbox') {
      return item[field.key] ? 'Yes' : 'No'
    }
    if (field.key === 'yearlyQuota' && item.isUnlimited) {
      return 'Unlimited'
    }
    return item[field.key]
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{resource.title}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {readOnly ? 'Read-only access.' : `Create and manage ${resource.title.toLowerCase()}.`}
          </p>
        </div>
        <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={loadItems} type="button">
          Refresh
        </button>
      </div>
      <ErrorMessage message={error} />
      {notice && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
      {temporaryPassword && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm font-semibold text-amber-900">Temporary password — shown only this time</p>
            <button className="text-sm font-medium text-amber-900 underline" onClick={() => setTemporaryPassword('')} type="button">
              Hide password
            </button>
          </div>
          <code className="mt-2 block break-all rounded bg-white p-3 text-sm text-slate-900">{temporaryPassword}</code>
        </div>
      )}

      {!readOnly && section !== 'hr-users' && (
        <form className="mt-6 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <h3 className="font-semibold sm:col-span-2">{editingId ? `Edit ${resource.singular}` : `Add ${resource.singular}`}</h3>
          {resource.fields.map((field) => (
            field.type === 'checkbox' ? (
              <label className="flex items-center gap-2 text-sm text-slate-700" key={field.key}>
                <input checked={Boolean(values[field.key])} name={field.key} onChange={updateField} type="checkbox" />
                {field.label}
              </label>
            ) : (
              <label className="text-sm font-medium text-slate-700" key={field.key}>
                {field.label}
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                  min={field.min}
                  name={field.key}
                  onChange={updateField}
                  required={field.required}
                  type={field.type}
                  value={values[field.key] ?? ''}
                />
              </label>
            )
          ))}
          {section === 'leave-types' && values.isUnlimited && (
            <p className="text-xs text-slate-500 sm:col-span-2">The quota field is ignored when unlimited is selected.</p>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <button className="rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60" disabled={isSaving} type="submit">
              {isSaving ? 'Saving...' : editingId ? 'Save changes' : 'Add'}
            </button>
            {editingId && (
              <button className="rounded-lg border border-slate-300 px-4 py-2.5 font-medium text-slate-700" onClick={resetForm} type="button">
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {!readOnly && section === 'hr-users' && (
        <form className="mt-6 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <h3 className="font-semibold sm:col-span-2">Create HR user</h3>
          {resource.fields.map((field) => (
            <label className="text-sm font-medium text-slate-700" key={field.key}>
              {field.label}
              <input className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" name={field.key} onChange={updateField} required type={field.type} value={values[field.key] ?? ''} />
            </label>
          ))}
          <button className="w-fit rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 sm:col-span-2" disabled={isSaving} type="submit">
            {isSaving ? 'Creating...' : 'Create HR user'}
          </button>
        </form>
      )}

      {isLoading ? (
        <p className="mt-6 text-sm text-slate-600">Loading {resource.title.toLowerCase()}...</p>
      ) : error ? (
        <button className="mt-5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700" onClick={loadItems} type="button">
          Try loading again
        </button>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center">
          <p className="font-medium text-slate-700">No {resource.title.toLowerCase()} yet</p>
          <p className="mt-1 text-sm text-slate-500">Items will appear here after they are added.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {resource.fields.map((field) => <th className="px-4 py-3 font-semibold" key={field.key}>{field.label}</th>)}
                {section === 'hr-users' && <th className="px-4 py-3 font-semibold">Status</th>}
                {!readOnly && <th className="px-4 py-3 font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {items.map((item) => (
                <tr key={item._id}>
                  {resource.fields.map((field) => <td className="px-4 py-3 text-slate-700" key={field.key}>{displayValue(item, field)}</td>)}
                  {section === 'hr-users' && (
                    <td className="px-4 py-3 text-slate-700">
                      {item.isActive ? 'Active' : 'Inactive'}{item.mustChangePassword ? ' · Password change required' : ''}
                    </td>
                  )}
                  {!readOnly && (
                    <td className="px-4 py-3">
                      {section === 'hr-users' ? (
                        <div className="flex flex-wrap gap-2">
                          <button className="rounded-md px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-50" onClick={() => manageHrUser(item, 'reset-password')} type="button">Reset password</button>
                          {item.isActive && <button className="rounded-md px-2 py-1 font-medium text-rose-700 hover:bg-rose-50" onClick={() => manageHrUser(item, 'deactivate')} type="button">Deactivate</button>}
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button className="rounded-md px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-50" onClick={() => beginEdit(item)} type="button">Edit</button>
                          <button className="rounded-md px-2 py-1 font-medium text-rose-700 hover:bg-rose-50" onClick={() => deleteItem(item)} type="button">Delete</button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function OrganizationSettingsPage({ section }) {
  const { user } = useAuth()
  const readOnly = user.role === 'hr'

  return (
    <div className="mx-auto w-full max-w-6xl">
      <p className="text-sm font-medium text-indigo-600">Organization</p>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Settings</h1>
      <Tabs section={section} userRole={user.role} />
      {section === 'company'
        ? <CompanySettings readOnly={readOnly} />
        : <ResourceSettings key={section} readOnly={readOnly} section={section} />}
    </div>
  )
}

export default OrganizationSettingsPage
