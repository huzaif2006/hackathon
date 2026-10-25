import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../api/axios.js'
import { getRequestErrorMessage } from '../utils/request-error.js'

function companyDate(timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function formatTime(value, timezone) {
  return value ? new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—'
}

const statusStyles = {
  present: 'bg-emerald-100 text-emerald-800',
  late: 'bg-amber-100 text-amber-800',
  half_day: 'bg-orange-100 text-orange-800',
  absent: 'bg-rose-100 text-rose-800',
  missing_checkout: 'bg-violet-100 text-violet-800',
  on_leave: 'bg-sky-100 text-sky-800',
  holiday: 'bg-indigo-100 text-indigo-800',
  weekend: 'bg-slate-100 text-slate-600',
  scheduled: 'bg-slate-50 text-slate-400',
}

function MyAttendancePage() {
  const [month, setMonth] = useState('')
  const [days, setDays] = useState([])
  const [timezone, setTimezone] = useState('Asia/Karachi')
  const [correction, setCorrection] = useState({ date: '', requestedCheckIn: '', requestedCheckOut: '', reason: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadAttendance = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const { data } = await api.get('/api/attendance/my', { params: month ? { month } : {} })
      setDays(data.days)
      setTimezone(data.timezone || 'Asia/Karachi')
      if (!month && data.days.length) setMonth(data.days[0].date.slice(0, 7))
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [month])

  useEffect(() => {
    let isMounted = true
    Promise.resolve().then(() => {
      if (isMounted) return loadAttendance()
      return undefined
    })
    return () => {
      isMounted = false
    }
  }, [loadAttendance])

  const monthLabel = useMemo(() => {
    if (!month) return 'Current month'
    const [year, monthNumber] = month.split('-').map(Number)
    return new Date(year, monthNumber - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }, [month])
  const calendarCells = useMemo(() => {
    if (days.length === 0) return []
    const firstWeekday = new Date(`${days[0].date}T00:00:00.000Z`).getUTCDay()
    return [...Array(firstWeekday).fill(null), ...days]
  }, [days])

  function moveMonth(offset) {
    const [year, monthNumber] = month.split('-').map(Number)
    const date = new Date(year, monthNumber - 1 + offset, 1)
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  async function submitCorrection(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    setNotice('')
    try {
      await api.post('/api/attendance/corrections', correction)
      setNotice('Correction request submitted for HR review.')
      setCorrection({ date: '', requestedCheckIn: '', requestedCheckOut: '', reason: '' })
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-600">Employee</p>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">My Attendance</h2>
        </div>
        <div className="flex items-center gap-3">
          <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => moveMonth(-1)} type="button">Previous</button>
          <strong className="min-w-32 text-center">{monthLabel}</strong>
          <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => moveMonth(1)} type="button">Next</button>
        </div>
      </div>

      {error && <p className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p>}
      {notice && <p className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
        <div className="grid min-w-[560px] grid-cols-7 gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((weekday) => (
            <div className="px-2 py-1 text-center text-xs font-semibold uppercase text-slate-500" key={weekday}>{weekday}</div>
          ))}
          {isLoading ? (
            <p className="col-span-7 py-8 text-center text-sm text-slate-500">Loading monthly calendar...</p>
          ) : days.length === 0 ? (
            <p className="col-span-7 py-8 text-center text-sm text-slate-500">No attendance days found.</p>
          ) : calendarCells.map((day, index) => (
            day ? (
              <div className={`min-h-20 rounded-lg border p-2 ${statusStyles[day.status] || 'border-slate-200 bg-white text-slate-600'}`} key={day.date}>
                <p className="text-sm font-semibold">{Number(day.date.slice(-2))}</p>
                <p className="mt-2 text-xs capitalize">{(day.status || '—').replaceAll('_', ' ')}</p>
              </div>
            ) : <div aria-hidden="true" className="min-h-20" key={`empty-${index}`} />
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Check-in</th><th className="px-4 py-3">Check-out</th><th className="px-4 py-3">Hours</th><th className="px-4 py-3">Note</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td className="px-4 py-8 text-center text-slate-500" colSpan="6">Loading attendance...</td></tr>
            ) : days.length === 0 ? (
              <tr><td className="px-4 py-8 text-center text-slate-500" colSpan="6">No attendance days found.</td></tr>
            ) : days.map((day) => (
              <tr key={day.date}>
                <td className="whitespace-nowrap px-4 py-3">{new Date(`${day.date}T00:00:00`).toLocaleDateString()}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[day.status] || statusStyles.scheduled}`}>{(day.status || '—').replaceAll('_', ' ')}</span></td>
                <td className="px-4 py-3">{formatTime(day.checkIn, timezone)}</td>
                <td className="px-4 py-3">{formatTime(day.checkOut, timezone)}</td>
                <td className="px-4 py-3">{day.workedHours || 0}</td>
                <td className="px-4 py-3 text-slate-500">{day.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="mt-8 rounded-xl border border-slate-200 bg-white p-5 sm:p-6" onSubmit={submitCorrection}>
        <h3 className="text-lg font-semibold">Request an attendance correction</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">Date
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" max={companyDate(timezone)} name="date" onChange={(event) => setCorrection({ ...correction, date: event.target.value })} required type="date" value={correction.date} />
          </label>
          <label className="text-sm font-medium text-slate-700">Requested check-in
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" name="requestedCheckIn" onChange={(event) => setCorrection({ ...correction, requestedCheckIn: event.target.value })} type="time" value={correction.requestedCheckIn} />
          </label>
          <label className="text-sm font-medium text-slate-700">Requested check-out
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" name="requestedCheckOut" onChange={(event) => setCorrection({ ...correction, requestedCheckOut: event.target.value })} type="time" value={correction.requestedCheckOut} />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-1">Reason
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" maxLength="500" name="reason" onChange={(event) => setCorrection({ ...correction, reason: event.target.value })} required value={correction.reason} />
          </label>
        </div>
        <button className="mt-4 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" disabled={isSaving} type="submit">
          {isSaving ? 'Submitting...' : 'Submit request'}
        </button>
      </form>
    </section>
  )
}

export default MyAttendancePage
