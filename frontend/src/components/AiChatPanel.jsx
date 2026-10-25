import { useEffect, useRef, useState } from 'react'
import api from '../api/axios.js'
import { getRequestErrorMessage } from '../utils/request-error.js'

function AiChatPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  async function sendMessage(event) {
    event.preventDefault()
    const content = message.trim()
    if (!content || isSending) return

    setError('')
    setMessage('')
    setIsSending(true)
    const history = messages.map(({ role, content: text }) => ({ role, content: text }))
    setMessages((current) => [...current, { role: 'user', content }])
    try {
      const { data } = await api.post('/api/ai/chat', { message: content, history })
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: data.message || 'I could not create a response.', aiGenerated: Boolean(data.aiGenerated) },
      ])
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
      setMessage(content)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen && (
        <section aria-label="AI assistant" className="mb-3 flex h-[min(72vh,38rem)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <header className="flex items-center justify-between bg-indigo-700 px-4 py-3 text-white">
            <div>
              <h2 className="font-semibold">HCM Assistant</h2>
              <p className="text-xs text-indigo-100">AI-generated answers · verify important details</p>
            </div>
            <button aria-label="Close assistant" className="rounded-md px-2 py-1 text-xl leading-none hover:bg-indigo-600" onClick={() => setIsOpen(false)} type="button">×</button>
          </header>
          <div aria-live="polite" className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
            {!messages.length && (
              <p className="rounded-xl bg-white p-3 text-sm text-slate-600 shadow-sm">
                Ask about your HCM data or company policies. Your access permissions still apply.
              </p>
            )}
            {messages.map((entry, index) => (
              <article className={`max-w-[90%] rounded-xl p-3 text-sm shadow-sm ${entry.role === 'user' ? 'ml-auto bg-indigo-600 text-white' : 'bg-white text-slate-800'}`} key={`${index}-${entry.role}`}>
                <p className="whitespace-pre-wrap break-words">{entry.content}</p>
                {entry.role === 'assistant' && entry.aiGenerated && <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-indigo-600">AI-generated</p>}
              </article>
            ))}
            {isSending && <p className="w-fit rounded-xl bg-white px-3 py-2 text-sm text-slate-500 shadow-sm" role="status">Thinking...</p>}
            <div ref={endRef} />
          </div>
          <form className="border-t border-slate-200 bg-white p-3" onSubmit={sendMessage}>
            {error && <p className="mb-2 text-xs text-rose-700" role="alert">{error}</p>}
            <label className="sr-only" htmlFor="ai-chat-message">Message</label>
            <div className="flex gap-2">
              <input autoComplete="off" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" disabled={isSending} id="ai-chat-message" maxLength="4000" onChange={(event) => setMessage(event.target.value)} placeholder="Ask a question..." value={message} />
              <button className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={isSending || !message.trim()} type="submit">Send</button>
            </div>
          </form>
        </section>
      )}
      <button aria-expanded={isOpen} aria-label={isOpen ? 'Close AI assistant' : 'Open AI assistant'} className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-700 text-white shadow-lg transition hover:bg-indigo-800 focus:outline-none focus:ring-4 focus:ring-indigo-200" onClick={() => setIsOpen((value) => !value)} type="button">
        {isOpen ? <span className="text-2xl leading-none">×</span> : <span className="text-sm font-bold">AI</span>}
      </button>
    </div>
  )
}

export default AiChatPanel
