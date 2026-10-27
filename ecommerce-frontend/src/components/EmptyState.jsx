/** Friendly placeholder for empty lists (no results, empty cart, no orders…). */
export default function EmptyState({ icon: Icon, title, message, action, className = '' }) {
  return (
    <div className={`card flex flex-col items-center px-6 py-12 text-center ${className}`}>
      {Icon && (
        <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <Icon className="size-7" aria-hidden="true" />
        </span>
      )}
      <h2 className="text-lg font-bold">{title}</h2>
      {message && <p className="mt-1.5 max-w-md text-sm text-stone-600">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
