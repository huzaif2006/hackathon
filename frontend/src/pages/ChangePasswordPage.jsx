import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { getRequestErrorMessage } from '../utils/request-error.js'

function ChangePasswordPage() {
  const { isLoading, user, changePassword } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isLoading) {
    return <p className="p-8 text-center text-slate-600">Loading your account...</p>
  }

  if (!user) {
    return <Navigate replace to="/login" />
  }

  if (!user.mustChangePassword) {
    return <Navigate replace to={`/${user.role}/dashboard`} />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const updatedUser = await changePassword({ currentPassword, newPassword })
      navigate(`/${updatedUser.role}/dashboard`, { replace: true })
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">HCM Lite</p>
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Change your password</h1>
        <p className="mt-2 text-sm text-slate-600">You must choose a new password before continuing.</p>
        {error && <p className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p>}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Current password
            <input autoComplete="current-password" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" onChange={(event) => setCurrentPassword(event.target.value)} required type="password" value={currentPassword} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            New password <span className="font-normal text-slate-500">(at least 8 characters)</span>
            <input autoComplete="new-password" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" minLength="8" onChange={(event) => setNewPassword(event.target.value)} required type="password" value={newPassword} />
          </label>
          <button className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Updating password...' : 'Update password'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default ChangePasswordPage
