import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import ChangePasswordPage from '../pages/ChangePasswordPage.jsx'
import DashboardPage from '../pages/DashboardPage.jsx'
import EmployeeFormPage from '../pages/EmployeeFormPage.jsx'
import EmployeeImportPage from '../pages/EmployeeImportPage.jsx'
import EmployeeProfilePage from '../pages/EmployeeProfilePage.jsx'
import EmployeesPage from '../pages/EmployeesPage.jsx'
import LoginPage from '../pages/LoginPage.jsx'
import MyProfilePage from '../pages/MyProfilePage.jsx'
import MyAttendancePage from '../pages/MyAttendancePage.jsx'
import AttendanceBoardPage from '../pages/AttendanceBoardPage.jsx'
import AttendanceCorrectionsPage from '../pages/AttendanceCorrectionsPage.jsx'
import LeavePage from '../pages/LeavePage.jsx'
import LeaveRequestsPage from '../pages/LeaveRequestsPage.jsx'
import PayrollPage from '../pages/PayrollPage.jsx'
import MyPayslipsPage from '../pages/MyPayslipsPage.jsx'
import OrganizationSettingsPage from '../pages/OrganizationSettingsPage.jsx'
import SetupPage from '../pages/SetupPage.jsx'
import AuditLogPage from '../pages/AuditLogPage.jsx'
import AnnouncementsPage from '../pages/AnnouncementsPage.jsx'
import RoleLayout from '../layouts/RoleLayout.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'

function PageState({ message, error, onRetry }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <p className={error ? 'text-rose-700' : 'text-slate-600'}>{message}</p>
        {onRetry && (
          <button
            className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
            onClick={onRetry}
            type="button"
          >
            Try again
          </button>
        )}
      </section>
    </main>
  )
}

function dashboardPath(role) {
  return `/${role}/dashboard`
}

function SetupGate() {
  const { isLoading, bootstrapError, setupComplete, user, retryBootstrap } = useAuth()

  if (isLoading) {
    return <PageState message="Checking setup and sign-in..." />
  }

  if (bootstrapError) {
    return <PageState error message={bootstrapError} onRetry={retryBootstrap} />
  }

  if (!setupComplete) {
    return <Navigate replace to="/setup" />
  }

  if (!user) {
    return <Navigate replace to="/login" />
  }

  return <Navigate replace to={user.mustChangePassword ? '/change-password' : dashboardPath(user.role)} />
}

function PublicOnly({ children }) {
  const { isLoading, bootstrapError, retryBootstrap, setupComplete, user } = useAuth()

  if (isLoading) {
    return <PageState message="Loading..." />
  }

  if (bootstrapError) {
    return <PageState error message={bootstrapError} onRetry={retryBootstrap} />
  }

  if (!setupComplete) {
    return <Navigate replace to="/setup" />
  }

  if (user) {
    return (
      <Navigate
        replace
        to={user.mustChangePassword ? '/change-password' : dashboardPath(user.role)}
      />
    )
  }

  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<SetupGate />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute roles={['admin']}>
            <RoleLayout><DashboardPage /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr/dashboard"
        element={
          <ProtectedRoute roles={['hr']}>
            <RoleLayout><DashboardPage /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/employee/dashboard"
        element={
          <ProtectedRoute roles={['employee']}>
            <RoleLayout><DashboardPage /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute roles={['admin', 'hr']}>
            <Navigate replace to="/settings/company" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/company"
        element={
          <ProtectedRoute roles={['admin', 'hr']}>
            <RoleLayout><OrganizationSettingsPage section="company" /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/departments"
        element={
          <ProtectedRoute roles={['admin', 'hr']}>
            <RoleLayout><OrganizationSettingsPage section="departments" /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/designations"
        element={
          <ProtectedRoute roles={['admin', 'hr']}>
            <RoleLayout><OrganizationSettingsPage section="designations" /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/leave-types"
        element={
          <ProtectedRoute roles={['admin', 'hr']}>
            <RoleLayout><OrganizationSettingsPage section="leave-types" /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/holidays"
        element={
          <ProtectedRoute roles={['admin', 'hr']}>
            <RoleLayout><OrganizationSettingsPage section="holidays" /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/hr-users"
        element={
          <ProtectedRoute roles={['admin']}>
            <RoleLayout><OrganizationSettingsPage section="hr-users" /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/employees"
        element={
          <ProtectedRoute roles={['admin', 'hr']}>
            <RoleLayout><EmployeesPage /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit-logs"
        element={
          <ProtectedRoute roles={['admin']}>
            <RoleLayout><AuditLogPage /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/announcements"
        element={
          <ProtectedRoute roles={['admin', 'hr']}>
            <RoleLayout><AnnouncementsPage /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/employees/new"
        element={
          <ProtectedRoute roles={['hr']}>
            <RoleLayout><EmployeeFormPage /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/employees/import"
        element={
          <ProtectedRoute roles={['hr']}>
            <RoleLayout><EmployeeImportPage /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/employees/:id/edit"
        element={
          <ProtectedRoute roles={['hr']}>
            <RoleLayout><EmployeeFormPage /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/employees/:id"
        element={
          <ProtectedRoute roles={['admin', 'hr']}>
            <RoleLayout><EmployeeProfilePage /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-profile"
        element={
          <ProtectedRoute roles={['employee']}>
            <RoleLayout><MyProfilePage /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-attendance"
        element={
          <ProtectedRoute roles={['employee']}>
            <RoleLayout><MyAttendancePage /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/attendance"
        element={
          <ProtectedRoute roles={['admin', 'hr']}>
            <RoleLayout><AttendanceBoardPage /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/attendance/corrections"
        element={
          <ProtectedRoute roles={['admin', 'hr']}>
            <RoleLayout><AttendanceCorrectionsPage /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leave"
        element={
          <ProtectedRoute roles={['employee']}>
            <RoleLayout><LeavePage /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leave/requests"
        element={
          <ProtectedRoute roles={['admin', 'hr']}>
            <RoleLayout><LeaveRequestsPage /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/payroll"
        element={
          <ProtectedRoute roles={['admin', 'hr']}>
            <RoleLayout><PayrollPage /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-payslips"
        element={
          <ProtectedRoute roles={['employee']}>
            <RoleLayout><MyPayslipsPage /></RoleLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  )
}

export default AppRoutes
