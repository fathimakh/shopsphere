import { FiChevronRight } from 'react-icons/fi'
import { Link } from 'react-router-dom'

/** Breadcrumb trail; `items` = [{ label, to? }] where the last item is the current page. */
export default function Breadcrumbs({ items, className = '' }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-stone-500">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li
              key={`${item.label}-${index}`}
              className={`flex items-center gap-1.5 ${isLast ? 'min-w-0 flex-1 basis-40' : ''}`}
            >
              {isLast || !item.to ? (
                <span aria-current={isLast ? 'page' : undefined} className="truncate font-medium text-stone-800">
                  {item.label}
                </span>
              ) : (
                <Link to={item.to} className="hover:text-brand-700 hover:underline">
                  {item.label}
                </Link>
              )}
              {!isLast && <FiChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-stone-400" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
