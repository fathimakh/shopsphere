import { useState } from 'react'
import { FiMessageSquare } from 'react-icons/fi'
import { formatDate, initials } from '../utils/format'
import RatingStars from './RatingStars'

const INITIAL_VISIBLE = 5

/** Newest-first list of customer reviews; long lists start collapsed. */
export default function ReviewList({ reviews = [], currentUserId }) {
  const [expanded, setExpanded] = useState(false)
  const sorted = [...reviews].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const visible = expanded ? sorted : sorted.slice(0, INITIAL_VISIBLE)

  if (!sorted.length) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 px-6 py-10 text-center">
        <FiMessageSquare aria-hidden="true" className="size-7 text-stone-400" />
        <p className="mt-3 font-semibold text-stone-800">No reviews yet</p>
        <p className="mt-1 text-sm text-stone-600">Bought this product? Be the first to share what you think.</p>
      </div>
    )
  }

  return (
    <div>
      <ul className="divide-y divide-stone-200">
        {visible.map((review) => {
          const isOwn = Boolean(currentUserId) && String(review.user?._id ?? review.user) === String(currentUserId)
          return (
            <li key={review._id ?? `${review.user}-${review.createdAt}`} className="py-5 first:pt-0">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800"
                >
                  {initials(review.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <p className="font-semibold text-stone-900">{review.name || 'Customer'}</p>
                    {isOwn && <span className="badge bg-brand-50 text-brand-700">Your review</span>}
                    {review.createdAt && (
                      <time dateTime={review.createdAt} className="text-xs text-stone-500">
                        {formatDate(review.createdAt)}
                      </time>
                    )}
                  </div>
                  <RatingStars rating={review.rating} className="mt-1" />
                  <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-line text-stone-700">
                    {review.comment}
                  </p>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      {sorted.length > INITIAL_VISIBLE && (
        <button
          type="button"
          className="btn btn-secondary mt-2 h-10 w-full sm:w-auto"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show fewer reviews' : `Show all ${sorted.length} reviews`}
        </button>
      )}
    </div>
  )
}
