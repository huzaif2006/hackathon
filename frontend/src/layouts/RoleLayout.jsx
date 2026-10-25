import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import NotificationBell from '../components/NotificationBell.jsx'
import AiChatPanel from '../components/AiChatPanel.jsx'

const roleNames = {
  admin: 'Admin',
  hr: 'HR',
  employee: 'Employee',
}

const settingsLinks = [
  { section: 'company', label: 'Company settings' },
  { section: 'departments', label: 'Departments' },
  { section: 'designations', label: 'Designations' },
  { section: 'leave-types', label: 'Leave types' },
  { section: 'holidays', label: 'Holidays' },
]

function SettingsLink({ section, label }) {
  return (
    <NavLink
      className={({ isActive }) => (
        `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`
      )}
      end
      to={`/settings/${section}`}
    >
      {label}
    </NavLink>
  )
}

function EmployeeMenuLink({ role }) {
  if (role === 'hr') {
    return (
      <NavLink
        className={({ isActive }) => (
          `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`
        )}
        to="/employees"
      >
        Employees
      </NavLink>
    )
  }

  if (role === 'admin') {
    return (
      <NavLink
        className={({ isActive }) => (
          `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`
        )}
        to="/employees"
      >
        Employees
      </NavLink>
    )
  }

  if (role === 'employee') {
    return (
      <>
        <NavLink
          className={({ isActive }) => (
            `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`
          )}
          to="/my-profile"
        >
          My Profile
        </NavLink>
        <NavLink
          className={({ isActive }) => (
            `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`
          )}
          to="/my-attendance"
        >
          My Attendance
        </NavLink>
        <NavLink
          className={({ isActive }) => (
            `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`
          )}
          to="/leave"
        >
          Leave
        </NavLink>
        <NavLink
          className={({ isActive }) => (
            `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`
          )}
          to="/my-payslips"
        >
          My Payslips
        </NavLink>
      </>
    )
  }

  return null
}

function RoleLayout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const dashboardLink = `/${user.role}/dashboard`

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 md:flex">
      <aside className="flex w-full flex-col border-b border-slate-200 bg-white p-5 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">HCM Lite</p>
          <h1 className="mt-2 text-xl font-bold">{roleNames[user.role]} portal</h1>
        </div>
        <nav aria-label={`${roleNames[user.role]} menu`} className="mt-6 flex flex-wrap gap-2 md:flex-1 md:flex-col">
          <NavLink
            className={({ isActive }) => (
              `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`
            )}
            to={dashboardLink}
          >
            Dashboard
          </NavLink>
          <EmployeeMenuLink role={user.role} />
          {(user.role === 'admin' || user.role === 'hr') && (
            <>
              <NavLink className={({ isActive }) => (`rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`)} to="/announcements">
                Announcements
              </NavLink>
              <NavLink
                className={({ isActive }) => (
                  `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`
                )}
                to="/attendance"
              >
                Attendance Board
              </NavLink>
              <NavLink
                className={({ isActive }) => (
                  `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`
                )}
                to="/attendance/corrections"
              >
                Corrections
              </NavLink>
              <NavLink
                className={({ isActive }) => (
                  `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`
                )}
                to="/leave/requests"
              >
                Leave Requests
              </NavLink>
              <NavLink
                className={({ isActive }) => (
                  `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`
                )}
                to="/payroll"
              >
                Payroll
              </NavLink>
            </>
          )}
          {(user.role === 'admin' || user.role === 'hr') && (
            <div className="mt-2 w-full border-t border-slate-100 pt-4">
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Settings
              </p>
              <div className="flex flex-wrap gap-1 md:flex-col">
                {settingsLinks.map((link) => (
                  <SettingsLink key={link.section} {...link} />
                ))}
              </div>
            </div>
          )}
          {user.role === 'admin' && (
            <>
              <div className="w-full"><SettingsLink section="hr-users" label="HR Users" /></div>
              <NavLink className={({ isActive }) => (`rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`)} to="/audit-logs">
                Audit Log
              </NavLink>
            </>
          )}
        </nav>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 md:block">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <button
            className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 md:mt-4"
            onClick={handleLogout}
            type="button"
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-5 sm:p-8">
        <div className="mb-5 flex justify-end">
          <NotificationBell />
        </div>
        {children}
      </main>
      <AiChatPanel />
    </div>
  )
}

export default RoleLayout
