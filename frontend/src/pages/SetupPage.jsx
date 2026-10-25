import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { getRequestErrorMessage } from '../utils/request-error.js'
import api from '../api/axios.js'

function SetupPage() {
  const {
    isLoading,
    bootstrapError,
    retryBootstrap,
    setupComplete,
    completeSetup,
  } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ companyName: '', name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isLoading) {
    return <p className="p-8 text-center text-slate-600">Checking first-run setup...</p>
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

  if (setupComplete) {
    return <Navigate replace to="/login" />
  }

  function updateField(event) {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await api.post('/api/setup', form)
      await completeSetup()
      navigate('/login', { replace: true, state: { setupComplete: true } })
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">HCM Lite</p>
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Set up your company</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Create the company and its first Admin account to get started.
        </p>
        {error && <p className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p>}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Company name
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" name="companyName" onChange={updateField} required value={form.companyName} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Admin name
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" name="name" onChange={updateField} required value={form.name} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Admin email
            <input autoComplete="email" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" name="email" onChange={updateField} required type="email" value={form.email} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password <span className="font-normal text-slate-500">(at least 8 characters)</span>
            <input autoComplete="new-password" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" minLength="8" name="password" onChange={updateField} required type="password" value={form.password} />
          </label>
          <button className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Creating company...' : 'Create company and Admin'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default SetupPage
