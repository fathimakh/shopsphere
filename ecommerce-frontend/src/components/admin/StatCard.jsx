import { Link } from 'react-router-dom'
import { FiArrowRight } from 'react-icons/fi'

const TONES = {
  brand: 'bg-brand-50 text-brand-700',
  accent: 'bg-accent-50 text-accent-700',
  sky: 'bg-sky-50 text-sky-700',
  violet: 'bg-violet-50 text-violet-700',
}

/** Dashboard KPI tile. When `to` is given the whole card links to the related admin screen. */
export default function StatCard({ icon: Icon, label, value, hint, to, tone = 'brand' }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-stone-600">{label}</p>
        {Icon && (
          <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${TONES[tone] ?? TONES.brand}`}>
            <Icon className="size-5" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-2xl font-bold tracking-tight text-stone-900 tabular-nums">{value}</p>
      {(hint || to) && (
        <p className="mt-1 flex items-center gap-1 text-xs text-stone-500">
          {hint}
          {to && <FiArrowRight className="ml-auto size-4 text-stone-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
        </p>
      )}
    </>
  )

  const className = 'card group block p-4 sm:p-5'
  return to ? (
    <Link to={to} className={`${className} transition-shadow hover:shadow-md`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}
