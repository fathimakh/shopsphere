import { FiX } from 'react-icons/fi'
import { formatCategory, formatPrice } from '../utils/format'

function priceLabel(minPrice, maxPrice) {
  if (minPrice && maxPrice) return `${formatPrice(minPrice)} – ${formatPrice(maxPrice)}`
  if (minPrice) return `${formatPrice(minPrice)} and above`
  return `Up to ${formatPrice(maxPrice)}`
}

/** Removable chips for every active filter, plus "Clear all". Renders nothing when unfiltered. */
export default function ActiveFilters({ filters, onChange, onClearAll, className = '' }) {
  const chips = []
  if (filters.search) {
    chips.push({ key: 'search', label: `“${filters.search}”`, remove: { search: '' } })
  }
  filters.categories.forEach((slug) => {
    chips.push({
      key: `category-${slug}`,
      label: formatCategory(slug),
      remove: { categories: filters.categories.filter((item) => item !== slug) },
    })
  })
  if (filters.minPrice || filters.maxPrice) {
    chips.push({
      key: 'price',
      label: priceLabel(filters.minPrice, filters.maxPrice),
      remove: { minPrice: '', maxPrice: '' },
    })
  }
  if (filters.minRating) {
    chips.push({ key: 'rating', label: `${filters.minRating}★ & up`, remove: { minRating: '' } })
  }
  if (filters.inStock) {
    chips.push({ key: 'stock', label: 'In stock only', remove: { inStock: false } })
  }

  if (!chips.length) return null

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <h3 className="sr-only">Active filters</h3>
      <ul className="contents">
        {chips.map((chip) => (
          <li key={chip.key}>
            <button
              type="button"
              onClick={() => onChange(chip.remove)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 py-1 pr-2 pl-3 text-sm font-medium text-brand-800 transition-colors hover:border-brand-300 hover:bg-brand-100"
              aria-label={`Remove filter: ${chip.label}`}
            >
              <span className="max-w-[14rem] truncate">{chip.label}</span>
              <FiX aria-hidden="true" className="size-4 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onClearAll} className="link min-h-9 px-1 text-sm">
        Clear all
      </button>
    </div>
  )
}
