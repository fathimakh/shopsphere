import { FaStar } from 'react-icons/fa6'

const STAR_SIZES = {
  sm: 'size-3.5',
  md: 'size-4',
  lg: 'size-5',
}

const STARS = [0, 1, 2, 3, 4]

/**
 * Five-star rating with fractional fill (4.3 fills 86% of the row), plus an optional review
 * count. Screen readers get one sentence instead of five decorative icons.
 */
export default function RatingStars({ rating = 0, count, size = 'sm', className = '' }) {
  const value = Math.min(5, Math.max(0, Number(rating) || 0))
  const starClass = `${STAR_SIZES[size] ?? STAR_SIZES.sm} shrink-0`
  const hasCount = count !== undefined && count !== null
  const label = hasCount
    ? `Rated ${value.toFixed(1)} out of 5 from ${count} ${count === 1 ? 'review' : 'reviews'}`
    : `Rated ${value.toFixed(1)} out of 5`

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} role="img" aria-label={label}>
      <span className="relative inline-flex" aria-hidden="true">
        <span className="flex gap-0.5 text-stone-300">
          {STARS.map((star) => (
            <FaStar key={star} className={starClass} />
          ))}
        </span>
        <span className="absolute inset-0 flex gap-0.5 overflow-hidden text-amber-400" style={{ width: `${(value / 5) * 100}%` }}>
          {STARS.map((star) => (
            <FaStar key={star} className={starClass} />
          ))}
        </span>
      </span>
      {hasCount && (
        <span className="text-xs font-medium text-stone-500" aria-hidden="true">
          ({count})
        </span>
      )}
    </span>
  )
}
