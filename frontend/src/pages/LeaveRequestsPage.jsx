import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import api from '../api/axios.js'
import { getRequestErrorMessage } from '../utils/request-error.js'

const statuses = ['pending', 'approved', 'rejected', 'cancelled']

function LeaveRequestsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [departments, setDepartments] = useState([])
  const [status, setStatus] = useState('pending')
  const [department, setDepartment] = useState('')
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [comments, setComments] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadRequests = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const [{ data: requestData }, { data: departmentData }] = await Promise.all([
        api.get('/api/leave/requests', {
          params: {
            status,
            page: pagination.page,
            limit: 10,
            ...(department ? { department } : {}),
          },
        }),
        api.get('/api/employees/departments'),
      ])
      setItems(requestData.items)
      setPagination(requestData.pagination)
      setDepartments(departmentData.items)
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [department, pagination.page, status])

  useEffect(() => {
    let isMounted = true
    Promise.resolve().then(() => (isMounted ? loadRequests() : undefined))
    return () => {
      isMounted = false
    }
  }, [loadRequests])

  async function review(id, decision) {
    setError('')
    setNotice('')
    setIsSaving(id)
    try {
      await api.post(`/api/leave/${id}/${decision}`, { comment: comments[id] || '' })
      setNotice(`Leave request ${decision}.`)
      await loadRequests()
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsSaving('')
    }
  }

  return (
    <section className="mx-auto max-w-6xl">
      <p className="text-sm font-medium text-indigo-600">{user.role === 'hr' ? 'HR approvals' : 'Read-only overview'}</p>
      <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Leave Requests</h2>
      <div className="mt-5 flex flex-wrap gap-3">
        <label className="text-sm font-medium text-slate-700">Status
          <select className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" onChange={(event) => { setStatus(event.target.value); setPagination((current) => ({ ...current, page: 1 })) }} value={status}>
            {statuses.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Department
          <select className="mt-1 block min-w-44 rounded-lg border border-slate-300 px-3 py-2" onChange={(event) => { setDepartment(event.target.value); setPagination((current) => ({ ...current, page: 1 })) }} value={department}>
            <option value="">All departments</option>
            {departments.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}<button className="ml-2 font-semibold underline" onClick={loadRequests} type="button">Retry</button></p>}
      {notice && <p className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
      <div className="mt-6 space-y-4">
        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500">Loading leave requests...</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No requests match these filters.</div>
        ) : items.map((item) => (
          <article className="rounded-xl border border-slate-200 bg-white p-5" key={item._id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{item.employee?.name} <span className="text-sm font-normal text-slate-500">{item.employee?.code}</span></h3>
                <p className="mt-1 text-sm text-slate-600">{item.employee?.department?.name || 'No department'} · {item.leaveType?.name}</p>
              </div>
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold capitalize text-indigo-700">{item.status}</span>
            </div>
            <p className="mt-3 text-sm text-slate-700">{item.startDate} – {item.endDate} · {item.days} working day(s)</p>
            <p className="mt-1 text-sm text-slate-600">{item.reason}</p>
            {user.role === 'hr' && item.status === 'pending' && (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" maxLength="500" onChange={(event) => setComments({ ...comments, [item._id]: event.target.value })} placeholder="Required review comment" value={comments[item._id] || ''} />
                <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={Boolean(isSaving) || !comments[item._id]?.trim()} onClick={() => review(item._id, 'approve')} type="button">{isSaving === item._id ? 'Saving...' : 'Approve'}</button>
                <button className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={Boolean(isSaving) || !comments[item._id]?.trim()} onClick={() => review(item._id, 'reject')} type="button">Reject</button>
              </div>
            )}
            {item.reviewComment && <p className="mt-3 text-sm text-slate-500">Review comment: {item.reviewComment}</p>}
          </article>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <p className="text-sm text-slate-500">{pagination.total} request(s)</p>
        <div className="flex gap-2">
          <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50" disabled={pagination.page <= 1 || isLoading} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))} type="button">Previous</button>
          <span className="px-2 py-2 text-sm">{pagination.page} / {Math.max(1, pagination.pages)}</span>
          <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50" disabled={pagination.page >= pagination.pages || isLoading} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))} type="button">Next</button>
        </div>
      </div>
    </section>
  )
}

export default LeaveRequestsPage
