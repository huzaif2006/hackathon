import { useCallback, useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import AttendanceWidget from '../components/AttendanceWidget.jsx'
import api from '../api/axios.js'
import { useAuth } from '../context/useAuth.js'
import { getRequestErrorMessage } from '../utils/request-error.js'
import AnnouncementsPanel from '../components/AnnouncementsPanel.jsx'

const roleTitles = {
  admin: 'Admin Dashboard',
  hr: 'HR Dashboard',
  employee: 'Employee Dashboard',
}

const chartColors = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6']

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function MetricCard({ label, value, detail }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </article>
  )
}

function ChartPanel({ title, children, empty }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="mb-4 font-semibold text-slate-800">{title}</h3>
      {empty ? (
        <p className="flex h-56 items-center justify-center text-sm text-slate-500">No data for this period yet.</p>
      ) : children}
    </section>
  )
}

function formatMoney(amount) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(amount || 0)
}

function DashboardPage() {
  const { user } = useAuth()
  const today = localDateKey()
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`)
  const [to, setTo] = useState(today)
  const [department, setDepartment] = useState('')
  const [departments, setDepartments] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [summary, setSummary] = useState([])
  const [summaryError, setSummaryError] = useState('')
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    setIsLoading(true)
    setError('')
    setDashboard(null)
    setSummary([])
    setSummaryError('')
    try {
      if (user.role === 'employee') {
        const { data } = await api.get('/api/dashboard/employee')
        setDashboard(data)
      } else {
        const endpoint = user.role === 'admin' ? '/api/dashboard/admin' : '/api/dashboard/hr'
        const { data } = await api.get(endpoint, {
          params: {
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
            ...(department ? { department } : {}),
          },
        })
        setDashboard(data)
      }
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [department, from, to, user.role])

  useEffect(() => {
    Promise.resolve().then(loadDashboard)
  }, [loadDashboard])

  useEffect(() => {
    if (user.role === 'employee') return
    let active = true
    api.get('/api/organization/departments')
      .then(({ data }) => {
        if (active) setDepartments(data.items || [])
      })
      .catch((requestError) => {
        if (active) setError(getRequestErrorMessage(requestError))
      })
    return () => {
      active = false
    }
  }, [user.role])

  const isEmployee = user.role === 'employee'
  const isAdmin = user.role === 'admin'

  async function summarizeDashboard() {
    if (!dashboard || isSummarizing) return
    setSummaryError('')
    setSummary([])
    setIsSummarizing(true)
    try {
      const { data } = await api.post('/api/ai/dashboard-summary', { kpis: dashboard })
      setSummary(data.bullets || [])
      if (data.message) setSummaryError(data.message)
    } catch (requestError) {
      setSummaryError(getRequestErrorMessage(requestError))
    } finally {
      setIsSummarizing(false)
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600">Welcome, {user.name}</p>
          <h2 className="mt-1 text-2xl font-bold sm:text-3xl">{roleTitles[user.role]}</h2>
        </div>
        {!isEmployee && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-slate-600">
              From
              <input className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              To
              <input className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="date" value={to} min={from} max={today} onChange={(event) => setTo(event.target.value)} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Department
              <select className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={department} onChange={(event) => setDepartment(event.target.value)}>
                <option value="">All departments</option>
                {departments.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
              </select>
            </label>
          </div>
        )}
      </header>

      {!isEmployee && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={isLoading || isSummarizing || !dashboard} onClick={summarizeDashboard} type="button">
            {isSummarizing ? 'Summarizing...' : 'Summarize dashboard'}
          </button>
          {summaryError && <p className="mt-3 text-sm text-rose-700" role="alert">{summaryError}</p>}
          {summary.length > 0 && (
            <div className="mt-4 rounded-lg bg-indigo-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">AI-generated summary</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {summary.map((bullet, index) => <li key={`${index}-${bullet}`}>{bullet}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      {isEmployee && <AttendanceWidget />}
      {isLoading && <p className="rounded-lg bg-white p-4 text-sm text-slate-600" role="status">Loading dashboard...</p>}
      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
          {error}
          <button className="ml-2 font-semibold underline" onClick={loadDashboard} type="button">Retry</button>
        </p>
      )}

      {!isLoading && dashboard && !isEmployee && (
        isAdmin ? <AdminDashboard data={dashboard} /> : <HrDashboard data={dashboard} />
      )}
      {!isLoading && dashboard && isEmployee && <EmployeeDashboard data={dashboard} />}
      {!isLoading && dashboard && <AnnouncementsPanel items={dashboard.announcements || []} />}
    </section>
  )
}

function HrDashboard({ data }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="Headcount" value={data.headcount} />
        <MetricCard label="Present today" value={data.presentToday} />
        <MetricCard label="On leave today" value={data.onLeaveToday} />
        <MetricCard label="Late today" value={data.lateToday} detail={`${data.latePercentage}% late in selected period`} />
        <MetricCard label="Pending approvals" value={data.pendingApprovals} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <ChartPanel title="Attendance trend" empty={!data.attendanceTrend?.some((item) => item.present + item.late + item.absent + item.halfDay + item.missingCheckout > 0)}>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip />
                <Line type="monotone" dataKey="attendanceRate" name="Attendance rate %" stroke="#4f46e5" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
        <ChartPanel title="Absenteeism by department" empty={!data.absenteeismByDepartment?.length}>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.absenteeismByDepartment} margin={{ left: 4, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                <YAxis unit="%" />
                <Tooltip />
                <Bar dataKey="absenteeismRate" name="Absenteeism %" fill="#f43f5e" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
        <ChartPanel title="Approved leave by type" empty={!data.leaveByType?.length}>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.leaveByType}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="leaveType" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="approvedDays" name="Approved days" fill="#0ea5e9" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="mb-4 font-semibold text-slate-800">Top late-comers</h3>
          {!data.topLateComers?.length ? <p className="text-sm text-slate-500">No late attendance records for this period.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500"><tr><th className="pb-2">Employee</th><th className="pb-2">Department</th><th className="pb-2">Late days</th><th className="pb-2">Last late</th></tr></thead>
                <tbody>{data.topLateComers.map((person) => (
                  <tr className="border-t border-slate-100" key={person.employeeId}>
                    <td className="py-2 font-medium">{person.name} <span className="text-slate-500">({person.code})</span></td>
                    <td className="py-2">{person.department}</td>
                    <td className="py-2">{person.lateCount}</td>
                    <td className="py-2">{person.lastLateDate}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  )
}

function AdminDashboard({ data }) {
  const genderTotal = data.genderBreakdown?.reduce((sum, item) => sum + item.headcount, 0) || 0
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Headcount" value={data.headcount} />
        <MetricCard label="Attrition YTD" value={`${data.attritionYtd.rate}%`} detail={`${data.attritionYtd.exits} exits`} />
        <MetricCard label="Payroll gross" value={formatMoney(data.payrollCost.gross)} />
        <MetricCard label="Average gross salary" value={formatMoney(data.averageSalary.gross)} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <ChartPanel title="Headcount by department" empty={!data.headcountByDepartment?.length}>
          <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.headcountByDepartment}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="department" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="headcount" fill="#4f46e5" radius={[5, 5, 0, 0]} /></BarChart>
          </ResponsiveContainer></div>
        </ChartPanel>
        <ChartPanel title="Payroll cost by department" empty={!data.payrollCostByDepartment?.length}>
          <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.payrollCostByDepartment}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="department" tick={{ fontSize: 11 }} /><YAxis /><Tooltip formatter={(value) => formatMoney(value)} /><Bar dataKey="gross" name="Gross payroll" fill="#0ea5e9" radius={[5, 5, 0, 0]} /></BarChart>
          </ResponsiveContainer></div>
        </ChartPanel>
        <ChartPanel title="Gender breakdown" empty={!genderTotal}>
          <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={data.genderBreakdown} dataKey="headcount" nameKey="gender" outerRadius={90} label>{data.genderBreakdown.map((entry, index) => <Cell key={entry.gender} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip /></PieChart>
          </ResponsiveContainer></div>
        </ChartPanel>
        <ChartPanel title="Tenure breakdown" empty={!data.tenureBreakdown?.length}>
          <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.tenureBreakdown}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="range" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="headcount" fill="#10b981" radius={[5, 5, 0, 0]} /></BarChart>
          </ResponsiveContainer></div>
        </ChartPanel>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="font-semibold text-slate-800">Recent audit activity</h3>
        {!data.recentAuditFeed?.length ? (
          <p className="mt-3 text-sm text-slate-500">No audit activity has been recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {data.recentAuditFeed.slice(0, 10).map((entry) => (
              <li className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between" key={entry._id}>
                <span><strong>{entry.actor?.name || 'Unknown'}</strong> {entry.action} · {entry.entityType}</span>
                <time className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function EmployeeDashboard({ data }) {
  const payslip = data.lastFinalizedPayslip
  const balance = data.leaveBalance || []
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard label="Hours this week" value={`${data.hoursThisWeek.worked} / ${data.hoursThisWeek.target}`} detail="Hours worked / weekly target" />
        <MetricCard label="Late this month" value={data.lateCountThisMonth} />
        <MetricCard label="Last take-home pay" value={payslip ? formatMoney(payslip.netPay) : '—'} detail={payslip?.month || 'No finalized payslip yet'} />
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="font-semibold text-slate-800">My leave balance</h3>
        {!balance.length ? <p className="mt-3 text-sm text-slate-500">No leave types are configured yet.</p> : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {balance.map((item) => (
              <article className="rounded-lg bg-slate-50 p-4" key={item.leaveType.id}>
                <p className="font-medium text-slate-800">{item.leaveType.name}</p>
                <p className="mt-2 text-sm text-slate-600">Used: {item.used} days</p>
                <p className="text-sm text-slate-600">Remaining: {item.leaveType.isUnlimited ? 'Unlimited' : `${item.remaining} days`}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

export default DashboardPage
