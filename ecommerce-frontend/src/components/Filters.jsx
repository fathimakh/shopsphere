import { useId, useState } from 'react'
import { FaStar } from 'react-icons/fa6'
import { RATING_FILTERS } from '../utils/constants'
import { formatCategory } from '../utils/format'
import PriceRangeFilter from './PriceRangeFilter'

const COLLAPSED_CATEGORY_COUNT = 8

const legendClass = 'mb-2 text-sm font-bold text-stone-900'
const optionClass =
  'flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm text-stone-700 transition-colors hover:bg-stone-100'

/**
 * Catalogue filter panel: categories (multi-select, with product counts), price range,
 * minimum rating and availability. Stateless apart from UI toggles. Every change goes
 * through `onChange(patch)`, which writes the URL. Rendered in the desktop sidebar and
 * inside the mobile drawer, so ids come from useId.
 */
export default function Filters({ filters, onChange, categories, onRetryCategories }) {
  const id = useId()
  const [showAllCategories, setShowAllCategories] = useState(false)

  const categoryItems = categories.items ?? []
  // A category from a shared link may not be in the list (e.g. renamed), so keep it selectable.
  const unknownSelected = filters.categories
    .filter((slug) => !categoryItems.some((category) => category.name === slug))
    .map((slug) => ({ name: slug, count: null }))
  const allCategories = [...categoryItems, ...unknownSelected]
  const visibleCategories =
    showAllCategories || allCategories.length <= COLLAPSED_CATEGORY_COUNT + 2
      ? allCategories
      : allCategories.slice(0, COLLAPSED_CATEGORY_COUNT)

  const toggleCategory = (slug, checked) => {
    const next = checked ? [...filters.categories, slug] : filters.categories.filter((item) => item !== slug)
    onChange({ categories: next })
  }

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className={legendClass}>Category</legend>
        {categories.status === 'failed' && !categoryItems.length ? (
          <p className="px-2 text-sm text-stone-600">
            Couldn&apos;t load categories.{' '}
            <button type="button" className="link" onClick={onRetryCategories}>
              Retry
            </button>
          </p>
        ) : !categoryItems.length && categories.status !== 'succeeded' ? (
          <div className="space-y-3 px-2 py-1" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="skeleton h-5" />
            ))}
          </div>
        ) : (
          <>
            <ul className="space-y-0.5">
              {visibleCategories.map((category) => {
                const checked = filters.categories.includes(category.name)
                return (
                  <li key={category.name}>
                    <label className={optionClass}>
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={checked}
                        onChange={(event) => toggleCategory(category.name, event.target.checked)}
                      />
                      <span className={`flex-1 ${checked ? 'font-semibold text-stone-900' : ''}`}>
                        {formatCategory(category.name)}
                      </span>
                      {category.count !== null && (
                        <span className="text-xs text-stone-500 tabular-nums">{category.count}</span>
                      )}
                    </label>
                  </li>
                )
              })}
            </ul>
            {visibleCategories.length < allCategories.length || showAllCategories ? (
              <button
                type="button"
                className="link mt-1 min-h-10 px-2 text-sm"
                onClick={() => setShowAllCategories((value) => !value)}
                aria-expanded={showAllCategories}
              >
                {showAllCategories ? 'Show fewer' : `Show all ${allCategories.length}`}
              </button>
            ) : null}
          </>
        )}
      </fieldset>

      <fieldset>
        <legend className={legendClass}>Price</legend>
        <PriceRangeFilter
          minPrice={filters.minPrice}
          maxPrice={filters.maxPrice}
          onApply={(range) => onChange(range)}
        />
      </fieldset>

      <fieldset>
        <legend className={legendClass}>Customer rating</legend>
        <div className="space-y-0.5">
          {[...RATING_FILTERS.map(String), ''].map((value) => (
            <label key={value || 'any'} className={optionClass}>
              <input
                type="radio"
                name={`${id}-rating`}
                className="checkbox rounded-full"
                checked={filters.minRating === value}
                onChange={() => onChange({ minRating: value })}
              />
              {value ? (
                <span className="flex items-center gap-1">
                  {value}
                  <FaStar aria-hidden="true" className="size-3.5 text-amber-400" />
                  <span className="sr-only">stars</span>
                  <span>&amp; up</span>
                </span>
              ) : (
                <span>Any rating</span>
              )}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={legendClass}>Availability</legend>
        <label className={optionClass}>
          <input
            type="checkbox"
            className="checkbox"
            checked={filters.inStock}
            onChange={(event) => onChange({ inStock: event.target.checked })}
          />
          <span>In stock only</span>
        </label>
      </fieldset>
    </div>
  )
}
