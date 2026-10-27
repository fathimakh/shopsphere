import { useId } from 'react'
import { FiChevronDown } from 'react-icons/fi'
import { SORT_OPTIONS } from '../utils/constants'

/** Native select for the catalogue sort order (values from the API contract). */
export default function SortSelect({ value, onChange, className = '' }) {
  const selectId = useId()

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label htmlFor={selectId} className="shrink-0 text-sm font-semibold text-stone-700">
        Sort<span className="hidden sm:inline"> by</span>
      </label>
      <div className="relative min-w-0 flex-1">
        <select
          id={selectId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="input h-11 cursor-pointer appearance-none pr-9"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <FiChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-stone-500"
        />
      </div>
    </div>
  )
}
