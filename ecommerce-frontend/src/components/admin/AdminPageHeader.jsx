/** Title row shared by every admin screen: heading, one-line description and optional actions. */
export default function AdminPageHeader({ title, description, actions }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
        {description && <p className="mt-1 text-sm text-stone-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 sm:shrink-0">{actions}</div>}
    </div>
  )
}
