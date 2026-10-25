import { useCallback, useEffect, useState } from 'react'
import api from '../api/axios.js'
import { getRequestErrorMessage } from '../utils/request-error.js'

function MyProfilePage() {
  const [employee, setEmployee] = useState(null)
  const [form, setForm] = useState({ phone: '', address: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadProfile = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const { data } = await api.get('/api/employees/my-profile')
      setEmployee(data.employee)
      setForm({ phone: data.employee.phone || '', address: data.employee.address || '' })
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    Promise.resolve().then(() => {
      if (isMounted) return loadProfile()
      return undefined
    })
    return () => { isMounted = false }
  }, [loadProfile])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSaving(true)
    try {
      const { data } = await api.put('/api/employees/my-profile', form)
      setEmployee(data.employee)
      setForm({ phone: data.employee.phone || '', address: data.employee.address || '' })
      setNotice('Your contact details have been updated.')
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <p className="p-8 text-center text-slate-600">Loading your profile...</p>
  }

  if (error && !employee) {
    return (
      <section className="mx-auto max-w-3xl rounded-2xl bg-white p-6">
        <p className="text-rose-700" role="alert">{error}</p>
        <button className="mt-4 rounded-lg border px-4 py-2" onClick={loadProfile} type="button">Try again</button>
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-3xl">
      <p className="text-sm font-medium text-indigo-600">Your account</p>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">My Profile</h1>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <dl className="grid gap-4 sm:grid-cols-2">
          {[
            ['Employee code', employee.code],
            ['Name', employee.name],
            ['Email', employee.email],
            ['Department', employee.department?.name || '—'],
            ['Designation', employee.designation?.name || '—'],
            ['Status', employee.status],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="mt-1 break-words text-sm font-medium capitalize text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 border-t border-slate-100 pt-5 text-sm text-slate-500">
          You can update only your phone number and address.
        </p>
        {error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p>}
        {notice && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Phone
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))} value={form.phone} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Address
            <textarea className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" onChange={(event) => setForm((previous) => ({ ...previous, address: event.target.value }))} rows="3" value={form.address} />
          </label>
          <button className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60" disabled={isSaving} type="submit">
            {isSaving ? 'Saving...' : 'Save contact details'}
          </button>
        </form>
      </div>
    </section>
  )
}

export default MyProfilePage
