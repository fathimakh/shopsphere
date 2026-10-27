/** Titled card used to group dashboard widgets and settings blocks. */
export default function AdminPanel({ title, description, action, className = '', children }) {
  return (
    <section className={`card flex flex-col p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}
