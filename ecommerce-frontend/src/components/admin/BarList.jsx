import { Link } from 'react-router-dom'

const BAR_TONES = {
  pending: 'bg-amber-400',
  processing: 'bg-sky-500',
  shipped: 'bg-indigo-500',
  delivered: 'bg-emerald-500',
  cancelled: 'bg-stone-400',
  brand: 'bg-brand-500',
  accent: 'bg-accent-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
}

/**
 * Horizontal bar chart as a plain list. Each row keeps its label and value as text and the bar
 * is decorative (aria-hidden), so screen readers hear "Pending 3 (25%)". Rows with `to` are links.
 * items: [{ key?, label, value, display?, tone?, to? }]
 */
export default function BarList({ items, label, emptyMessage = 'No data yet.' }) {
  const total = items.reduce((sum, item) => sum + (Number(item.value) || 0), 0)
  const max = Math.max(0, ...items.map((item) => Number(item.value) || 0))

  if (total === 0) return <p className="py-4 text-sm text-stone-500">{emptyMessage}</p>

  return (
    <ul aria-label={label} className="space-y-1">
      {items.map((item) => {
        const value = Number(item.value) || 0
        const share = Math.round((value / total) * 100)
        // Non-zero values always get a visible sliver of bar.
        const width = value ? Math.max((value / max) * 100, 3) : 0
        const content = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium text-stone-700">{item.label}</span>
              <span className="shrink-0 font-semibold text-stone-900 tabular-nums">
                {item.display ?? value}
                <span className="ml-1.5 text-xs font-medium text-stone-500">({share}%)</span>
              </span>
            </span>
            <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
              <span
                className={`block h-full rounded-full ${BAR_TONES[item.tone] ?? BAR_TONES.brand}`}
                style={{ width: `${width}%` }}
              />
            </span>
          </>
        )
        return (
          <li key={item.key ?? item.label}>
            {item.to ? (
              <Link to={item.to} className="block rounded-lg px-2 py-1.5 transition-colors hover:bg-stone-50">
                {content}
              </Link>
            ) : (
              <div className="px-2 py-1.5">{content}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
