import { pluralize } from '../utils/format'
import RatingStars from './RatingStars'

const STAR_LEVELS = [5, 4, 3, 2, 1]

/** Average rating plus a 5→1 star distribution computed from the product's reviews. */
export default function ReviewSummary({ rating = 0, numReviews = 0, reviews = [] }) {
  const counts = STAR_LEVELS.map((level) => reviews.filter((review) => Math.round(review.rating) === level).length)
  const total = reviews.length

  return (
    <div className="flex items-center gap-5 sm:gap-6">
      <div className="shrink-0 text-center">
        <p className="text-4xl font-extrabold text-stone-900 tabular-nums">{Number(rating || 0).toFixed(1)}</p>
        <RatingStars rating={rating} size="md" className="mt-1" />
        <p className="mt-1 text-xs text-stone-500">{pluralize(numReviews, 'review')}</p>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5" aria-label="Rating distribution">
        {STAR_LEVELS.map((level, index) => {
          const share = total ? Math.round((counts[index] / total) * 100) : 0
          return (
            <li key={level} className="flex items-center gap-2 text-xs text-stone-600">
              <span className="w-3 text-right tabular-nums">{level}</span>
              <span className="sr-only">stars:</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200" aria-hidden="true">
                <span className="block h-full rounded-full bg-amber-400" style={{ width: `${share}%` }} />
              </span>
              <span className="w-8 tabular-nums">{share}%</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
