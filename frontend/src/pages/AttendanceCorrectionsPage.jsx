import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import api from '../api/axios.js'
import { getRequestErrorMessage } from '../utils/request-error.js'

function AttendanceCorrectionsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [comments, setComments] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadCorrections = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const { data } = await api.get('/api/attendance/corrections')
      setItems(data.items)
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    Promise.resolve().then(() => {
      if (isMounted) return loadCorrections()
      return undefined
    })
    return () => {
      isMounted = false
    }
  }, [loadCorrections])

  async function review(id, decision) {
    setError('')
    setNotice('')
    setIsSaving(id)
    try {
      await api.post(`/api/attendance/corrections/${id}/${decision}`, { comment: comments[id] || '' })
      setNotice(`Correction ${decision}.`)
      await loadCorrections()
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsSaving('')
    }
  }

  return (
    <section className="mx-auto max-w-5xl">
      <p className="text-sm font-medium text-indigo-600">{user.role === 'hr' ? 'HR approvals' : 'Read-only'}</p>
      <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Attendance Corrections</h2>
      {error && <p className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p>}
      {notice && <p className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
      <div className="mt-6 space-y-4">
        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500">Loading correction requests...</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No pending attendance corrections.</div>
        ) : items.map((item) => (
          <article className="rounded-xl border border-slate-200 bg-white p-5" key={item._id}>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h3 className="font-semibold">{item.employee?.name || 'Employee'} <span className="text-sm font-normal text-slate-500">{item.employee?.code}</span></h3>
                <p className="mt-1 text-sm text-slate-600">{item.date} · {item.reason}</p>
              </div>
              <span className="h-fit rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">{item.status}</span>
            </div>
            <p className="mt-3 text-sm text-slate-700">
              Check-in: {item.requestedCheckIn || 'unchanged'} · Check-out: {item.requestedCheckOut || 'unchanged'}
            </p>
            {item.comment && <p className="mt-2 text-sm text-slate-500">Review comment: {item.comment}</p>}
            {user.role === 'hr' && item.status === 'pending' && (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  maxLength="500"
                  onChange={(event) => setComments({ ...comments, [item._id]: event.target.value })}
                  placeholder="Required review comment"
                  value={comments[item._id] || ''}
                />
                <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={Boolean(isSaving) || !comments[item._id]?.trim()} onClick={() => review(item._id, 'approve')} type="button">
                  {isSaving === item._id ? 'Saving...' : 'Approve'}
                </button>
                <button className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={Boolean(isSaving) || !comments[item._id]?.trim()} onClick={() => review(item._id, 'reject')} type="button">
                  Reject
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

export default AttendanceCorrectionsPage
