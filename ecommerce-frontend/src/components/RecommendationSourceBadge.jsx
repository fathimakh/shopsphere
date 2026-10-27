import { useId, useState } from 'react'
import { FiCpu, FiInfo, FiShare2, FiTrendingUp } from 'react-icons/fi'
import { RECOMMENDATION_SOURCES } from '../utils/constants'

const TONES = {
  brand: 'bg-brand-50 text-brand-800 ring-brand-200 hover:bg-brand-100',
  sky: 'bg-sky-50 text-sky-800 ring-sky-200 hover:bg-sky-100',
  accent: 'bg-accent-50 text-accent-800 ring-accent-200 hover:bg-accent-100',
}

const ICONS = {
  'rapidminer-live': FiCpu,
  rapidminer: FiCpu,
  'builtin-cf': FiShare2,
  popular: FiTrendingUp,
}

/**
 * Honest label for where a recommendation list came from (RapidMiner, the built-in
 * collaborative filter, or plain popularity). Hover, focus or tap it to read the explanation.
 */
export default function RecommendationSourceBadge({ source, className = '' }) {
  const tooltipId = useId()
  const [pinned, setPinned] = useState(false)
  const meta = RECOMMENDATION_SOURCES[source]
  if (!meta) return null
  const Icon = ICONS[source] ?? FiInfo

  return (
    <span className={`group/tip relative inline-flex ${className}`}>
      <button
        type="button"
        // The pseudo-element pads the tap area to 44px without making the badge look bigger.
        className={`badge relative min-h-7 cursor-help ring-1 transition-colors ring-inset before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] ${
          TONES[meta.tone] ?? TONES.brand
        }`}
        aria-describedby={tooltipId}
        onClick={() => setPinned((value) => !value)}
        onBlur={() => setPinned(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setPinned(false)
        }}
        data-source={source}
      >
        <Icon aria-hidden="true" className="size-3.5" />
        {meta.label}
        <FiInfo aria-hidden="true" className="size-3.5 opacity-70" />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        // Phones: a strip pinned to the bottom of the screen (never wider than the viewport);
        // from sm: a popover under the badge.
        className={`pointer-events-none fixed inset-x-4 bottom-4 z-30 sm:absolute sm:inset-x-auto sm:top-full sm:bottom-auto sm:left-0 sm:mt-2 sm:w-72 rounded-xl bg-stone-900 px-3.5 py-2.5 text-xs leading-relaxed font-medium text-white shadow-xl transition-opacity duration-150 group-hover/tip:visible group-hover/tip:opacity-100 ${
          pinned ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        {meta.description}
      </span>
    </span>
  )
}
