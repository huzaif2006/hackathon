import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import api from '../api/axios.js'
import { getRequestErrorMessage } from '../utils/request-error.js'

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function money(value) {
  return `PKR ${Number(value || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function PayrollPage() {
  const { user } = useAuth()
  const [month, setMonth] = useState(currentMonth)
  const [runs, setRuns] = useState([])
  const [selectedRunId, setSelectedRunId] = useState('')
  const [run, setRun] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadRuns = useCallback(async () => {
    setError('')
    try {
      const { data } = await api.get('/api/payroll/runs')
      setRuns(data.items)
      return data.items
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
      return []
    }
  }, [])

  const loadRun = useCallback(async (id) => {
    if (!id) {
      setRun(null)
      return
    }
    setIsLoading(true)
    setError('')
    try {
      const { data } = await api.get(`/api/payroll/runs/${id}`)
      setRun(data.run)
      setMonth(data.run.month)
      setSelectedRunId(data.run.id)
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    Promise.resolve().then(async () => {
      const items = await loadRuns()
      if (!isMounted) return
      if (items.length) {
        setSelectedRunId(items[0].id)
        await loadRun(items[0].id)
      } else {
        setIsLoading(false)
      }
    })
    return () => {
      isMounted = false
    }
  }, [loadRun, loadRuns])

  async function createDraft(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    setNotice('')
    try {
      const { data } = await api.post('/api/payroll/runs', { month })
      setNotice(`Payroll draft created for ${month}.`)
      await loadRuns()
      await loadRun(data.run.id)
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  async function regenerate() {
    if (!run) return
    setIsSaving(true)
    setError('')
    setNotice('')
    try {
      await api.post(`/api/payroll/runs/${run.id}/regenerate`)
      setNotice(`Draft for ${run.month} regenerated from current attendance, leave, and salary data.`)
      await loadRun(run.id)
      await loadRuns()
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  async function finalize() {
    if (!run) return
    setIsSaving(true)
    setError('')
    setNotice('')
    try {
      await api.post(`/api/payroll/runs/${run.id}/finalize`)
      setNotice(`Payroll for ${run.month} finalized and locked.`)
      await loadRun(run.id)
      await loadRuns()
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-600">Payroll Lite</p>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Payroll</h2>
        </div>
        {user.role === 'hr' && (
          <form className="flex flex-wrap items-end gap-2" onSubmit={createDraft}>
            <label className="text-sm font-medium text-slate-700">Payroll month
              <input className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" onChange={(event) => setMonth(event.target.value)} required type="month" value={month} />
            </label>
            <button className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={isSaving} type="submit">
              {isSaving ? 'Working...' : 'Create draft'}
            </button>
          </form>
        )}
      </div>

      {error && <p className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}<button className="ml-2 font-semibold underline" onClick={() => loadRun(selectedRunId)} type="button">Retry</button></p>}
      {notice && <p className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}

      <label className="mt-6 block max-w-sm text-sm font-medium text-slate-700">
        Existing payroll runs
        <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" onChange={(event) => loadRun(event.target.value)} value={selectedRunId}>
          <option value="">Select a payroll run</option>
          {runs.map((item) => <option key={item.id} value={item.id}>{item.month} · {item.status}</option>)}
        </select>
      </label>

      {isLoading ? (
        <p className="mt-8 text-center text-slate-500">Loading payroll...</p>
      ) : !run ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h3 className="font-semibold">No payroll run selected</h3>
          <p className="mt-2 text-sm text-slate-500">{user.role === 'hr' ? 'Choose a month and create a draft to prepare payroll.' : 'Payroll drafts will appear here when HR creates them.'}</p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">Payroll · {run.month}</h3>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${run.status === 'finalized' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {run.status === 'finalized' ? 'Locked' : 'Draft'}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{run.itemCount} employee payslip(s)</p>
            </div>
            <div className="flex gap-2">
              {user.role === 'hr' && run.status === 'draft' && (
                <button className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-50" disabled={isSaving} onClick={regenerate} type="button">
                  {isSaving ? 'Regenerating...' : 'Regenerate draft'}
                </button>
              )}
              {user.role === 'admin' && run.status === 'draft' && (
                <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={isSaving} onClick={finalize} type="button">
                  {isSaving ? 'Finalizing...' : 'Finalize payroll'}
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Gross', run.totals.gross],
              ['Deductions', run.totals.deduction],
              ['Monthly tax', run.totals.monthlyTax],
              ['Net pay', run.totals.netPay],
            ].map(([label, amount]) => (
              <article className="rounded-xl border border-slate-200 bg-white p-4" key={label}>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-1 text-lg font-semibold">{money(amount)}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Basic</th><th className="px-4 py-3">HRA</th><th className="px-4 py-3">Medical</th><th className="px-4 py-3">Gross</th><th className="px-4 py-3">Absent</th><th className="px-4 py-3">Unpaid leave</th><th className="px-4 py-3">Half days</th><th className="px-4 py-3">Deduction</th><th className="px-4 py-3">Tax</th><th className="px-4 py-3">Net pay</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {run.items.length === 0 ? (
                  <tr><td className="px-4 py-8 text-center text-slate-500" colSpan="11">No eligible employees were found for this month.</td></tr>
                ) : run.items.map((item) => (
                  <tr key={item._id}>
                    <td className="px-4 py-3"><p className="font-medium">{item.employeeSnapshot.name}</p><p className="text-xs text-slate-500">{item.employeeSnapshot.code} · {item.daysPayable}/{item.workingDays} days</p></td>
                    <td className="whitespace-nowrap px-4 py-3">{money(item.basic)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{money(item.hra)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{money(item.medical)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{money(item.gross)}</td>
                    <td className="px-4 py-3">{item.absentDays}</td>
                    <td className="px-4 py-3">{item.unpaidLeaveDays}</td>
                    <td className="px-4 py-3">{item.halfDays}</td>
                    <td className="whitespace-nowrap px-4 py-3">{money(item.deduction)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{money(item.monthlyTax)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold">{money(item.netPay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

export default PayrollPage
