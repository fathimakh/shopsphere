import { FiCpu } from 'react-icons/fi'
import { RECOMMENDATION_SOURCES } from '../../utils/constants'

const TONES = {
  brand: 'bg-brand-100 text-brand-800',
  sky: 'bg-sky-100 text-sky-800',
  accent: 'bg-accent-100 text-accent-800',
}

/** Names the engine that produced a recommendation list (RapidMiner live / imported, built-in CF, trending). */
export default function SourceBadge({ source, className = '' }) {
  const details = RECOMMENDATION_SOURCES[source]
  return (
    <span className={`badge ${TONES[details?.tone] ?? 'bg-stone-100 text-stone-700'} ${className}`} title={details?.description}>
      <FiCpu className="size-3" aria-hidden="true" />
      {details?.label ?? source ?? 'Unknown'}
    </span>
  )
}
