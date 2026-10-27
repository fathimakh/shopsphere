import { useId } from 'react'
import { FiCloudOff, FiRefreshCw } from 'react-icons/fi'
import ProductCard from './ProductCard'
import ProductCardSkeleton from './ProductCardSkeleton'
import RecommendationSourceBadge from './RecommendationSourceBadge'

// Static class names so Tailwind can see them.
const GRID_COLUMNS = {
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  6: 'md:grid-cols-3 xl:grid-cols-6',
}

const listClass = (columns) =>
  `scroll-x -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 px-4 pt-1 pb-3 sm:-mx-6 sm:scroll-px-6 sm:gap-4 sm:px-6 md:mx-0 md:grid md:overflow-visible md:px-0 md:pb-1 ${
    GRID_COLUMNS[columns] ?? GRID_COLUMNS[4]
  }`
const itemClass = 'w-[46%] min-w-40 max-w-60 shrink-0 snap-start md:w-auto md:max-w-none md:min-w-0'

/**
 * Recommendation section ("Recommended for you", "You may also like"…): a swipeable rail on
 * phones and a grid from `md` up. It is deliberately self-contained: loading shows skeletons,
 * a failure collapses to a quiet retry note, so a broken recommender never breaks the page.
 */
export default function Recommendations({
  title,
  subtitle,
  items = [],
  source,
  status,
  error,
  onRetry,
  columns = 4,
  skeletonCount = 4,
  className = '',
}) {
  const headingId = useId()
  const isLoading = status === 'idle' || status === 'loading'
  const isFailed = status === 'failed'

  if (!isLoading && !isFailed && !items.length) return null

  return (
    <section aria-labelledby={headingId} aria-busy={isLoading} className={className}>
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h2 id={headingId} className="text-xl font-bold sm:text-2xl">
          {title}
        </h2>
        {source && !isLoading && !isFailed && <RecommendationSourceBadge source={source} />}
        {subtitle && <p className="w-full text-sm text-stone-600">{subtitle}</p>}
      </div>

      {isFailed ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-stone-300 bg-white/70 px-4 py-5 text-sm text-stone-600 sm:flex-row sm:items-center">
          <FiCloudOff aria-hidden="true" className="size-5 shrink-0 text-stone-400" />
          <p className="flex-1">
            Recommendations are unavailable right now.
            {error && <span className="block text-xs text-stone-500">{String(error?.message ?? error)}</span>}
          </p>
          {onRetry && (
            <button type="button" className="btn btn-secondary h-10" onClick={onRetry}>
              <FiRefreshCw aria-hidden="true" /> Try again
            </button>
          )}
        </div>
      ) : (
        <ul className={listClass(columns)}>
          {isLoading
            ? Array.from({ length: skeletonCount }, (_, index) => (
                <li key={index} className={itemClass}>
                  <ProductCardSkeleton />
                </li>
              ))
            : items.map((product) => (
                <li key={product._id} className={itemClass}>
                  <ProductCard product={product} reason={product.reason} />
                </li>
              ))}
        </ul>
      )}
    </section>
  )
}
