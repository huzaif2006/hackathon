import { useCallback, useEffect, useState } from 'react'
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

function AttendanceWidget() {
  const [today, setToday] = useState(null)
  const [timezone, setTimezone] = useState('Asia/Karachi')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(0)
  const loadToday = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const { data } = await api.get('/api/attendance/my')
      const selectedTimezone = data.timezone || 'Asia/Karachi'
      const date = companyDate(selectedTimezone)
      setTimezone(selectedTimezone)
      setToday(data.days.find((day) => day.date === date) || null)
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    Promise.resolve().then(() => {
      if (isMounted) return loadToday()
      return undefined
    })
    return () => {
      isMounted = false
    }
  }, [loadToday])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(interval)
  }, [])

  async function record(action) {
    setIsSaving(true)
    setError('')
    try {
      await api.post(`/api/attendance/${action}`)
      await loadToday()
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  const hours = today?.checkIn
    ? Math.max(0, ((today.checkOut ? new Date(today.checkOut).getTime() : now) - new Date(today.checkIn).getTime()) / 3600000)
    : 0
  const date = companyDate(timezone)

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Today&apos;s attendance</h3>
          <p className="mt-1 text-sm text-slate-500">{date} · Status: {today?.status?.replaceAll('_', ' ') || 'not checked in'}</p>
          <p className="mt-2 text-sm text-slate-700">
            In: {today?.checkIn ? new Date(today.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
            {' · '}Out: {today?.checkOut ? new Date(today.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
            {' · '}Worked: {hours.toFixed(2)}h
          </p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={isLoading || isSaving || Boolean(today?.checkIn)} onClick={() => record('check-in')} type="button">
            Check in
          </button>
          <button className="rounded-lg border border-indigo-600 px-4 py-2.5 text-sm font-semibold text-indigo-700 disabled:opacity-50" disabled={isLoading || isSaving || !today?.checkIn || Boolean(today?.checkOut)} onClick={() => record('check-out')} type="button">
            Check out
          </button>
        </div>
      </div>
      {isLoading && <p className="mt-3 text-sm text-slate-500">Loading today&apos;s attendance...</p>}
      {error && <p className="mt-3 text-sm text-rose-700" role="alert">{error}<button className="ml-2 font-semibold underline" onClick={loadToday} type="button">Retry</button></p>}
      {!isLoading && !today && <p className="mt-3 text-sm text-slate-500">You have not checked in yet.</p>}
    </section>
  )
}

export default AttendanceWidget
