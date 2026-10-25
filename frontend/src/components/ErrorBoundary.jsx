import { Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <section className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
            <h1 className="text-xl font-bold text-slate-900">This page could not be displayed</h1>
            <p className="mt-2 text-sm text-slate-600">Please refresh the page. If the problem continues, contact your administrator.</p>
            <button className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => window.location.reload()} type="button">
              Refresh page
            </button>
          </section>
        </main>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
