function AnnouncementsPanel({ items = [] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="font-semibold text-slate-800">Latest announcements</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">There are no announcements yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.slice(0, 5).map((item) => (
            <li className="rounded-lg bg-slate-50 p-3" key={item._id}>
              <p className="font-medium text-slate-800">{item.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{item.message}</p>
              <p className="mt-2 text-xs text-slate-400">
                {item.createdBy?.name || 'Team'}{item.createdAt ? ` · ${new Date(item.createdAt).toLocaleDateString()}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default AnnouncementsPanel
