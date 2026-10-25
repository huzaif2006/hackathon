import { useCallback, useEffect, useState } from 'react'
import api from '../api/axios.js'
import { getRequestErrorMessage } from '../utils/request-error.js'

const badgeStyles = {
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

function AttendanceBoardPage() {
  const [date, setDate] = useState('')
  const [timezone, setTimezone] = useState('Asia/Karachi')
  const [department, setDepartment] = useState('')
  const [departments, setDepartments] = useState([])
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadBoard = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const [{ data: board }, { data: departmentData }] = await Promise.all([
        api.get('/api/attendance/board', { params: { ...(date ? { date } : {}), ...(department ? { department } : {}) } }),
        api.get('/api/employees/departments'),
      ])
      setItems(board.items)
      setDepartments(departmentData.items)
      setTimezone(board.timezone || 'Asia/Karachi')
      if (!date) setDate(board.date)
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [date, department])

  useEffect(() => {
    let isMounted = true
    Promise.resolve().then(() => {
      if (isMounted) return loadBoard()
      return undefined
    })
    return () => {
      isMounted = false
    }
  }, [loadBoard])

  return (
    <section className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-600">HR and Admin</p>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Attendance Board</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm font-medium text-slate-700">Date
            <input className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
          </label>
          <label className="text-sm font-medium text-slate-700">Department
            <select className="mt-1 block min-w-44 rounded-lg border border-slate-300 px-3 py-2" onChange={(event) => setDepartment(event.target.value)} value={department}>
              <option value="">All departments</option>
              {departments.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </select>
          </label>
        </div>
      </div>
      {error && <div className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}<button className="ml-3 font-semibold underline" onClick={loadBoard} type="button">Retry</button></div>}
      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Designation</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Check-in</th><th className="px-4 py-3">Check-out</th><th className="px-4 py-3">Hours</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td className="px-4 py-8 text-center text-slate-500" colSpan="7">Loading attendance board...</td></tr>
            ) : items.length === 0 ? (
              <tr><td className="px-4 py-8 text-center text-slate-500" colSpan="7">No active employees found for this filter.</td></tr>
            ) : items.map((item) => (
              <tr key={item.employee.id}>
                <td className="px-4 py-3"><span className="font-medium">{item.employee.name}</span><span className="ml-2 text-xs text-slate-500">{item.employee.code}</span></td>
                <td className="px-4 py-3">{item.employee.department?.name || '—'}</td>
                <td className="px-4 py-3">{item.employee.designation?.name || '—'}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeStyles[item.status] || badgeStyles.scheduled}`}>{item.status.replaceAll('_', ' ')}</span></td>
                <td className="px-4 py-3">{item.checkIn ? new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(item.checkIn)) : '—'}</td>
                <td className="px-4 py-3">{item.checkOut ? new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(item.checkOut)) : '—'}</td>
                <td className="px-4 py-3">{item.workedHours || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default AttendanceBoardPage
