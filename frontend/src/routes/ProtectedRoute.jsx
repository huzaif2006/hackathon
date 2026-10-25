import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

function ProtectedRoute({ roles, children }) {
  const { isLoading, bootstrapError, retryBootstrap, setupComplete, user } = useAuth()

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-slate-600">
        Loading your account...
      </main>
    )
  }

  if (bootstrapError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-rose-700" role="alert">{bootstrapError}</p>
        <button
          className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
          onClick={retryBootstrap}
          type="button"
        >
          Try again
        </button>
      </main>
    )
  }

  if (!setupComplete) {
    return <Navigate replace to="/setup" />
  }

  if (!user) {
    return <Navigate replace to="/login" />
  }

  if (user.mustChangePassword) {
    return <Navigate replace to="/change-password" />
  }

  if (!roles.includes(user.role)) {
    return <Navigate replace to={`/${user.role}/dashboard`} />
  }

  return children
}

export default ProtectedRoute
