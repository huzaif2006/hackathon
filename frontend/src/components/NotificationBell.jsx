import { useCallback, useEffect, useState } from 'react'
import api from '../api/axios.js'
import { getRequestErrorMessage } from '../utils/request-error.js'

function NotificationBell() {
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadNotifications = useCallback(async () => {
    setError('')
    try {
      const { data } = await api.get('/api/notifications')
      setItems(data.items)
      setUnreadCount(data.unreadCount)
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    Promise.resolve().then(() => (isMounted ? loadNotifications() : undefined))
    return () => {
      isMounted = false
    }
  }, [loadNotifications])

  async function markRead(id) {
    setError('')
    try {
      await api.post(`/api/notifications/${id}/read`)
      await loadNotifications()
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    }
  }

  return (
    <div className="relative">
      <button
        aria-expanded={isOpen}
        aria-label={`Notifications, ${unreadCount} unread`}
        className="relative rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <span aria-hidden="true" className="mr-1 inline-flex align-middle">
          <svg fill="none" height="18" viewBox="0 0 24 24" width="18">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          </svg>
        </span>
        Notifications
        {unreadCount > 0 && <span className="ml-2 rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">{unreadCount}</span>}
      </button>
      {isOpen && (
        <section aria-label="Notifications" className="absolute right-0 z-20 mt-2 max-h-[70vh] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Notifications</h2>
            <button className="text-xs font-medium text-indigo-700 underline" onClick={loadNotifications} type="button">Refresh</button>
          </div>
          {error && <p className="mt-3 text-sm text-rose-700" role="alert">{error}</p>}
          {isLoading ? (
            <p className="py-5 text-center text-sm text-slate-500">Loading notifications...</p>
          ) : items.length === 0 ? (
            <p className="py-5 text-center text-sm text-slate-500">No notifications yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {items.map((item) => (
                <li className={`py-3 ${item.isRead ? '' : 'bg-indigo-50/60'}`} key={item._id}>
                  <div className="flex items-start justify-between gap-3 px-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                      <p className="mt-1 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                    {!item.isRead && <button className="shrink-0 text-xs font-medium text-indigo-700 underline" onClick={() => markRead(item._id)} type="button">Mark read</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

export default NotificationBell
