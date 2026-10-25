import { useCallback, useEffect, useState } from 'react'
import api from '../api/axios.js'
import { getRequestErrorMessage } from '../utils/request-error.js'

function money(value) {
  return `PKR ${Number(value || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function MyPayslipsPage() {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [downloading, setDownloading] = useState('')
  const [error, setError] = useState('')

  const loadPayslips = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const { data } = await api.get('/api/payroll/payslips/my')
      setItems(data.items)
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    Promise.resolve().then(() => (isMounted ? loadPayslips() : undefined))
    return () => {
      isMounted = false
    }
  }, [loadPayslips])

  async function download(item) {
    setError('')
    setDownloading(item.id)
    try {
      const { data } = await api.get(`/api/payroll/payslips/${item.id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = `payslip-${item.month}.pdf`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setDownloading('')
    }
  }

  return (
    <section className="mx-auto max-w-5xl">
      <p className="text-sm font-medium text-indigo-600">Employee self-service</p>
      <h2 className="mt-2 text-2xl font-bold sm:text-3xl">My Payslips</h2>
      {error && <p className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}<button className="ml-2 font-semibold underline" onClick={loadPayslips} type="button">Retry</button></p>}
      {isLoading ? (
        <p className="mt-8 text-center text-slate-500">Loading payslips...</p>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h3 className="font-semibold">No finalized payslips yet</h3>
          <p className="mt-2 text-sm text-slate-500">Payslips will appear here after Admin finalizes a payroll run.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Month</th><th className="px-4 py-3">Days payable</th><th className="px-4 py-3">Gross</th><th className="px-4 py-3">Deductions</th><th className="px-4 py-3">Tax</th><th className="px-4 py-3">Net pay</th><th className="px-4 py-3">Payslip</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium">{item.month}</td>
                  <td className="px-4 py-3">{item.daysPayable}</td>
                  <td className="whitespace-nowrap px-4 py-3">{money(item.gross)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{money(item.deduction)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{money(item.monthlyTax)}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{money(item.netPay)}</td>
                  <td className="px-4 py-3">
                    <button className="rounded-lg border border-indigo-600 px-3 py-1.5 text-xs font-semibold text-indigo-700 disabled:opacity-50" disabled={Boolean(downloading)} onClick={() => download(item)} type="button">
                      {downloading === item.id ? 'Downloading...' : 'Download PDF'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default MyPayslipsPage
