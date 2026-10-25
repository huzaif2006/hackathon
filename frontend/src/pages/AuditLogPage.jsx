import { useCallback, useEffect, useState } from 'react'
import api from '../api/axios.js'
import { getRequestErrorMessage } from '../utils/request-error.js'

function AuditLogPage() {
  const [filters, setFilters] = useState({ from: '', to: '', action: '', entityType: '' })
  const [result, setResult] = useState({ items: [], pagination: { page: 1, pages: 1, total: 0 } })
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadLogs = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const { data } = await api.get('/api/audit-logs', {
        params: {
          page,
          limit: 20,
          ...(filters.from ? { from: filters.from } : {}),
          ...(filters.to ? { to: filters.to } : {}),
          ...(filters.action ? { action: filters.action } : {}),
          ...(filters.entityType ? { entityType: filters.entityType } : {}),
        },
      })
      setResult(data)
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    Promise.resolve().then(loadLogs)
  }, [loadLogs])

  function updateFilter(event) {
    setPage(1)
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-2xl font-bold">Audit Log</h2>
        <p className="mt-1 text-sm text-slate-500">Administrative record of changes made in HCM Lite.</p>
      </header>
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm text-slate-600">From<input className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" name="from" type="date" value={filters.from} onChange={updateFilter} /></label>
        <label className="text-sm text-slate-600">To<input className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" name="to" type="date" value={filters.to} onChange={updateFilter} /></label>
        <label className="text-sm text-slate-600">Action<input className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" name="action" placeholder="employee.update" value={filters.action} onChange={updateFilter} /></label>
        <label className="text-sm text-slate-600">Entity type<input className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" name="entityType" placeholder="Employee" value={filters.entityType} onChange={updateFilter} /></label>
      </div>
      {isLoading && <p className="rounded-lg bg-white p-4 text-sm text-slate-600" role="status">Loading audit log...</p>}
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}<button className="ml-2 font-semibold underline" onClick={loadLogs} type="button">Retry</button></div>}
      {!isLoading && !error && result.items.length === 0 && <p className="rounded-lg bg-white p-6 text-center text-sm text-slate-500">No audit entries match these filters.</p>}
      {!isLoading && !error && result.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">When</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Entity</th><th className="p-3">Changes</th></tr></thead>
              <tbody>
                {result.items.map((entry) => (
                  <tr className="border-t border-slate-100 align-top" key={entry._id}>
                    <td className="whitespace-nowrap p-3">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className="p-3">{entry.actor?.name || 'Unknown'}<span className="block text-xs text-slate-500">{entry.actor?.role}</span></td>
                    <td className="p-3 font-medium">{entry.action}</td>
                    <td className="p-3">{entry.entityType}<span className="block max-w-40 truncate text-xs text-slate-500">{entry.entityId}</span></td>
                    <td className="p-3">
                      <details>
                        <summary className="cursor-pointer text-indigo-700">View before / after</summary>
                        <div className="mt-2 grid gap-2 lg:grid-cols-2">
                          <pre className="max-h-64 overflow-auto rounded bg-slate-50 p-2 text-xs"><strong>Before</strong>{'\n'}{JSON.stringify(entry.before, null, 2) || 'null'}</pre>
                          <pre className="max-h-64 overflow-auto rounded bg-slate-50 p-2 text-xs"><strong>After</strong>{'\n'}{JSON.stringify(entry.after, null, 2) || 'null'}</pre>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{result.pagination.total} entries</p>
            <div className="flex gap-2">
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button">Previous</button>
              <span className="py-2 text-sm text-slate-600">Page {page} of {Math.max(1, result.pagination.pages)}</span>
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40" disabled={page >= result.pagination.pages} onClick={() => setPage((current) => current + 1)} type="button">Next</button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export default AuditLogPage
