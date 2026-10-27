import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiSearch } from 'react-icons/fi'
import ErrorMessage from '../ErrorMessage'
import Loader from '../Loader'
import AdminThumbnail from './AdminThumbnail'
import SourceBadge from './SourceBadge'
import useAdminResource from '../../hooks/useAdminResource'
import useDebounce from '../../hooks/useDebounce'
import { formatCategory, formatDateTime, formatPrice } from '../../utils/format'

const PICKER_SIZE = 8
const RECOMMENDATION_LIMIT = 6

function ScoreBar({ score }) {
  const value = Math.max(0, Math.min(1, Number(score) || 0))
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
        <span className="block h-full rounded-full bg-brand-500" style={{ width: `${value * 100}%` }} />
      </span>
      <span className="font-mono text-xs text-stone-600 tabular-nums">{value.toFixed(2)}</span>
    </span>
  )
}

/**
 * "What would a shopper see?" — pick any product and fetch its "You may also like" list
 * (GET /analytics/recommendations/product/:id) with scores and the engine that produced it.
 */
export default function RecommendationPreview() {
  const searchId = useId()
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query.trim(), 300)
  const [selected, setSelected] = useState(null)

  const candidates = useAdminResource('/products', {
    params: { search: debouncedQuery, sort: 'popular', limit: PICKER_SIZE },
  })
  const recommendations = useAdminResource(selected ? `/analytics/recommendations/product/${selected._id}` : null, {
    params: { limit: RECOMMENDATION_LIMIT },
  })
  const options = candidates.data?.products ?? []
  const recommended = recommendations.data?.products ?? []

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
      <div>
        <label htmlFor={searchId} className="label">
          Pick a product
        </label>
        <div className="relative">
          <FiSearch className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            className="input pl-10"
            placeholder="Search the catalogue…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {candidates.status === 'failed' ? (
          <ErrorMessage message={candidates.error?.message} onRetry={candidates.reload} className="mt-3" />
        ) : !candidates.data ? (
          <Loader label="Loading products…" />
        ) : options.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">No products match “{debouncedQuery}”.</p>
        ) : (
          <ul aria-label="Products" className="mt-3 max-h-80 space-y-1 overflow-y-auto pr-1">
            {options.map((product) => {
              const isSelected = selected?._id === product._id
              return (
                <li key={product._id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelected(product)}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm transition-colors ${
                      isSelected ? 'bg-brand-700 text-white' : 'hover:bg-stone-100'
                    }`}
                  >
                    <AdminThumbnail src={product.thumbnail || product.images?.[0]} className="size-9 rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{product.name}</span>
                      <span className={`block truncate text-xs ${isSelected ? 'text-brand-100' : 'text-stone-500'}`}>
                        {formatCategory(product.category)}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="min-w-0 rounded-2xl bg-stone-50 p-4" aria-live="polite">
        {!selected ? (
          <p className="grid min-h-40 place-items-center text-center text-sm text-stone-500">
            Choose a product to see what the engine recommends next to it.
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 text-sm text-stone-600">
                Shoppers viewing <span className="font-semibold text-stone-900">{selected.name}</span> see:
              </p>
              {recommendations.status === 'succeeded' && <SourceBadge source={recommendations.data.source} />}
            </div>
            {recommendations.status === 'failed' ? (
              <ErrorMessage message={recommendations.error?.message} onRetry={recommendations.reload} />
            ) : recommendations.status === 'loading' ? (
              <Loader label="Scoring recommendations…" />
            ) : recommended.length === 0 ? (
              <p className="py-6 text-center text-sm text-stone-500">No recommendations for this product yet.</p>
            ) : (
              <>
                <ol className="space-y-2">
                  {recommended.map((product, index) => (
                    <li key={product._id} className="flex items-center gap-3 rounded-xl bg-white p-2.5 shadow-sm">
                      <span className="w-4 shrink-0 text-center text-xs font-bold text-stone-400">{index + 1}</span>
                      <AdminThumbnail src={product.thumbnail || product.images?.[0]} className="size-11 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/product/${product._id}`}
                          className="block truncate text-sm font-semibold text-stone-900 hover:text-brand-700"
                        >
                          {product.name}
                        </Link>
                        <p className="truncate text-xs text-stone-500">
                          {formatCategory(product.category)} · {formatPrice(product.price)}
                        </p>
                        {product.reason && <p className="truncate text-xs text-stone-500 italic">{product.reason}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="sr-only">Similarity score </span>
                        <ScoreBar score={product.score} />
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-xs text-stone-500">
                  Strategy: {recommendations.data.strategy ?? 'similar-items'} · generated{' '}
                  {formatDateTime(recommendations.data.generatedAt)}
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
