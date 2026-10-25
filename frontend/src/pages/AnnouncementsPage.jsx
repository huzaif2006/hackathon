import { useCallback, useEffect, useState } from 'react'
import api from '../api/axios.js'
import { getRequestErrorMessage } from '../utils/request-error.js'
import { useAuth } from '../context/useAuth.js'

function AnnouncementsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ title: '', message: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadAnnouncements = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const { data } = await api.get('/api/announcements', { params: { limit: 50 } })
      setItems(data.items || [])
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    Promise.resolve().then(loadAnnouncements)
  }, [loadAnnouncements])

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setIsSaving(true)
    try {
      await api.post('/api/announcements', form)
      setForm({ title: '', message: '' })
      setSuccess('Announcement posted.')
      await loadAnnouncements()
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <header><h2 className="text-2xl font-bold">Announcements</h2><p className="mt-1 text-sm text-slate-500">Post updates for everyone in the company.</p></header>
      <form className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" onSubmit={submit}>
        <label className="block text-sm font-medium text-slate-700">Title<input className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" maxLength={160} required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
        <label className="block text-sm font-medium text-slate-700">Message<textarea className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" maxLength={4000} required rows={4} value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} /></label>
        {error && <p className="text-sm text-rose-700" role="alert">{error}</p>}
        {success && <p className="text-sm text-emerald-700" role="status">{success}</p>}
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={isSaving} type="submit">{isSaving ? 'Posting...' : 'Post announcement'}</button>
      </form>
      <section className="space-y-3">
        <h3 className="font-semibold">Recent posts</h3>
        {isLoading && <p className="rounded-lg bg-white p-4 text-sm text-slate-600" role="status">Loading announcements...</p>}
        {!isLoading && !error && items.length === 0 && <p className="rounded-lg bg-white p-4 text-sm text-slate-500">No announcements have been posted yet.</p>}
        {items.map((item) => <article className="rounded-xl border border-slate-200 bg-white p-4" key={item._id}><h4 className="font-semibold">{item.title}</h4><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.message}</p><p className="mt-3 text-xs text-slate-400">{item.createdBy?.name || user.name} · {new Date(item.createdAt).toLocaleString()}</p></article>)}
        {error && !isLoading && <button className="text-sm font-semibold text-indigo-700 underline" onClick={loadAnnouncements} type="button">Retry loading announcements</button>}
      </section>
    </section>
  )
}

export default AnnouncementsPage
