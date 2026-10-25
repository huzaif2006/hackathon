function TemporaryPasswordDialog({ title, credentials, onClose }) {
  if (!credentials?.length) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
      <section
        aria-labelledby="temporary-password-title"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-7"
        role="dialog"
      >
        <h2 className="text-xl font-bold" id="temporary-password-title">{title}</h2>
        <p className="mt-2 text-sm text-amber-800">
          Copy these temporary passwords now. They are not shown again and must be changed at first sign-in.
        </p>
        <div className="mt-5 space-y-3">
          {credentials.map((credential) => (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3" key={credential.email}>
              <p className="text-sm font-medium text-slate-800">{credential.name} · {credential.email}</p>
              <code className="mt-2 block break-all rounded bg-white p-2 text-sm">{credential.temporaryPassword}</code>
            </div>
          ))}
        </div>
        <button
          autoFocus
          className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700"
          onClick={onClose}
          type="button"
        >
          I have copied the password{credentials.length === 1 ? '' : 's'}
        </button>
      </section>
    </div>
  )
}

export default TemporaryPasswordDialog
