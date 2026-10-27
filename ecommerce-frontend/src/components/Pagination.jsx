import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

/** Page numbers with gaps, e.g. 1 … 4 5 6 … 12 (first, last and the current page's neighbours). */
function pageItems(page, pages) {
  const items = []
  for (let current = 1; current <= pages; current += 1) {
    if (current === 1 || current === pages || Math.abs(current - page) <= 1) items.push(current)
    else if (items.at(-1) !== 'gap') items.push('gap')
  }
  return items
}

export default function Pagination({ page, pages, onPageChange, className = '' }) {
  if (!pages || pages <= 1) return null

  return (
    <nav aria-label="Pagination" className={`flex flex-wrap items-center justify-center gap-1 ${className}`}>
      <button
        type="button"
        className="btn-icon"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <FiChevronLeft aria-hidden="true" />
      </button>
      {pageItems(page, pages).map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} className="px-1 text-stone-400" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-label={`Page ${item}`}
            aria-current={item === page ? 'page' : undefined}
            className={`size-10 rounded-xl text-sm font-semibold transition-colors ${
              item === page ? 'bg-brand-700 text-white' : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        className="btn-icon"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pages}
        aria-label="Next page"
      >
        <FiChevronRight aria-hidden="true" />
      </button>
    </nav>
  )
}
