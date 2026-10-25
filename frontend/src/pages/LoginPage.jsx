import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { getRequestErrorMessage } from '../utils/request-error.js'

function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const user = await login({ email, password })
      navigate(user.mustChangePassword ? '/change-password' : `/${user.role}/dashboard`, { replace: true })
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
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Sign in</h1>
        {location.state?.setupComplete && (
          <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">
            Company setup is complete. Sign in with the Admin account you created.
          </p>
        )}
        {error && <p className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p>}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input autoComplete="email" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input autoComplete="current-password" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </label>
          <button className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          First time here? <Link className="font-medium text-indigo-700 hover:underline" to="/setup">Set up your company</Link>
        </p>
      </section>
    </main>
  )
}

export default LoginPage
