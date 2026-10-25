import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../api/axios.js'
import { getRequestErrorMessage } from '../utils/request-error.js'

function enumerateDates(startDate, endDate) {
  const dates = []
  const cursor = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(`${endDate}T00:00:00.000Z`)
  if (Number.isNaN(cursor.valueOf()) || Number.isNaN(end.valueOf()) || cursor > end) return dates
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

function workingDayCount(startDate, endDate, calendar) {
  if (!startDate || !endDate || !calendar) return 0
  const holidays = new Set(calendar.holidays)
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return enumerateDates(startDate, endDate).filter((date) => {
    const weekday = weekdayNames[new Date(`${date}T00:00:00.000Z`).getUTCDay()]
    return !calendar.weekend.includes(weekday) && !holidays.has(date)
  }).length
}

function LeavePage() {
  const [balances, setBalances] = useState([])
  const [year, setYear] = useState(null)
  const [calendar, setCalendar] = useState(null)
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ leaveType: '', startDate: '', endDate: '', reason: '' })
  const [leaveDescription, setLeaveDescription] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [cancelling, setCancelling] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadLeave = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const [{ data: balanceData }, { data: historyData }] = await Promise.all([
        api.get('/api/leave/balance'),
        api.get('/api/leave/my'),
      ])
      setBalances(balanceData.balances)
      setYear(balanceData.year)
      setCalendar(balanceData.calendar)
      setItems(historyData.items)
      setForm((current) => ({
        ...current,
        leaveType: current.leaveType || balanceData.balances[0]?.leaveType.id || '',
      }))
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    Promise.resolve().then(() => (isMounted ? loadLeave() : undefined))
    return () => {
      isMounted = false
    }
  }, [loadLeave])

  const requestedDays = useMemo(
    () => workingDayCount(form.startDate, form.endDate, calendar),
    [calendar, form.endDate, form.startDate],
  )

  async function submitLeave(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSaving(true)
    try {
      await api.post('/api/leave', form)
      setNotice(`Leave request submitted for ${requestedDays} working day(s).`)
      setForm((current) => ({ ...current, startDate: '', endDate: '', reason: '' }))
      await loadLeave()
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  async function suggestLeave() {
    setError('')
    setNotice('')
    setIsSuggesting(true)
    try {
      const { data } = await api.post('/api/ai/smart-leave', { text: leaveDescription })
      setForm((current) => ({
        ...current,
        leaveType: data.suggestion.type,
        startDate: data.suggestion.start,
        endDate: data.suggestion.end,
        reason: data.suggestion.reason,
      }))
      setNotice('AI-generated suggestion filled the form. Review every field before submitting; nothing has been saved.')
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsSuggesting(false)
    }
  }

  async function cancelLeave(id) {
    setError('')
    setNotice('')
    setCancelling(id)
    try {
      await api.post(`/api/leave/${id}/cancel`)
      setNotice('Leave request cancelled.')
      await loadLeave()
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setCancelling('')
    }
  }

  return (
    <section className="mx-auto max-w-6xl">
      <p className="text-sm font-medium text-indigo-600">Employee self-service</p>
      <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Leave</h2>
      {error && <p className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}<button className="ml-2 font-semibold underline" onClick={loadLeave} type="button">Retry</button></p>}
      {notice && <p className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}

      <section className="mt-6">
        <h3 className="text-lg font-semibold">Leave balances{year ? ` · ${year}` : ''}</h3>
        {isLoading ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading balances...</p>
        ) : balances.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No leave types configured yet. Please contact an Admin.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {balances.map((balance) => (
              <article className="rounded-xl border border-slate-200 bg-white p-4" key={balance.leaveType.id}>
                <h4 className="font-semibold">{balance.leaveType.name}</h4>
                <p className="mt-2 text-sm text-slate-600">Quota: {balance.quota ?? 'Unlimited'}</p>
                <p className="text-sm text-slate-600">Used: {balance.used}</p>
                <p className="text-sm font-medium text-indigo-700">Remaining: {balance.remaining ?? 'Unlimited'}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <form className="mt-8 rounded-xl border border-slate-200 bg-white p-5 sm:p-6" onSubmit={submitLeave}>
        <h3 className="text-lg font-semibold">Apply for leave</h3>
        <div className="mt-4 rounded-lg bg-indigo-50 p-4">
          <label className="block text-sm font-medium text-slate-700" htmlFor="leave-description">Describe in words</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2" id="leave-description" maxLength="2000" onChange={(event) => setLeaveDescription(event.target.value)} placeholder="For example: I need next Monday off for a family event" value={leaveDescription} />
            <button className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-50" disabled={isSuggesting || !leaveDescription.trim()} onClick={suggestLeave} type="button">
              {isSuggesting ? 'Preparing...' : 'Fill form with AI'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-600">AI only prefills the form; check the details and submit it yourself.</p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">Leave type
            <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" onChange={(event) => setForm({ ...form, leaveType: event.target.value })} required value={form.leaveType}>
              {balances.length === 0 && <option value="">No leave types available</option>}
              {balances.map((balance) => <option key={balance.leaveType.id} value={balance.leaveType.id}>{balance.leaveType.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Start date
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" onChange={(event) => setForm({ ...form, startDate: event.target.value })} required type="date" value={form.startDate} />
          </label>
          <label className="text-sm font-medium text-slate-700">End date
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" min={form.startDate || undefined} onChange={(event) => setForm({ ...form, endDate: event.target.value })} required type="date" value={form.endDate} />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-1">Reason
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" maxLength="1000" onChange={(event) => setForm({ ...form, reason: event.target.value })} required value={form.reason} />
          </label>
        </div>
        <p className="mt-3 text-sm text-slate-600">Working days requested: <strong>{requestedDays}</strong> (weekends and company holidays excluded)</p>
        <button className="mt-4 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={isSaving || isLoading || !form.leaveType || requestedDays === 0} type="submit">
          {isSaving ? 'Submitting...' : 'Submit leave request'}
        </button>
      </form>

      <section className="mt-8">
        <h3 className="text-lg font-semibold">My leave history</h3>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Leave type</th><th className="px-4 py-3">Dates</th><th className="px-4 py-3">Days</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Review comment</th><th className="px-4 py-3">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td className="px-4 py-8 text-center text-slate-500" colSpan="7">Loading leave history...</td></tr>
              ) : items.length === 0 ? (
                <tr><td className="px-4 py-8 text-center text-slate-500" colSpan="7">You have not submitted any leave requests.</td></tr>
              ) : items.map((item) => (
                <tr key={item._id}>
                  <td className="px-4 py-3">{item.leaveType?.name || 'Unavailable'}</td>
                  <td className="whitespace-nowrap px-4 py-3">{item.startDate} – {item.endDate}</td>
                  <td className="px-4 py-3">{item.days}</td>
                  <td className="px-4 py-3">{item.reason}</td>
                  <td className="px-4 py-3 capitalize">{item.status}</td>
                  <td className="px-4 py-3">{item.reviewComment || '—'}</td>
                  <td className="px-4 py-3">
                    {item.status === 'pending' ? (
                      <button className="font-medium text-rose-700 underline disabled:opacity-50" disabled={Boolean(cancelling)} onClick={() => cancelLeave(item._id)} type="button">
                        {cancelling === item._id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}

export default LeavePage
