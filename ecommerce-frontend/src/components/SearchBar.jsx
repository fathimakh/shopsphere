import { useEffect, useId, useState } from 'react'
import { FiSearch, FiX } from 'react-icons/fi'
import useDebounce from '../hooks/useDebounce'

/**
 * Catalogue search box. Typing is debounced into `onSearch`; Enter searches immediately.
 * `value` is the search currently in the URL. When it changes from outside (back button,
 * "Clear all", a shared link) the box follows it.
 */
export default function SearchBar({ value, onSearch, className = '' }) {
  const inputId = useId()
  const [draft, setDraft] = useState(value)
  const [syncedValue, setSyncedValue] = useState(value)
  const debounced = useDebounce(draft, 400)

  // Adopt external URL changes during render (React's "adjust state on prop change" pattern).
  if (value !== syncedValue) {
    setSyncedValue(value)
    setDraft(value)
  }

  // Search once typing settles. `debounced === draft` skips the stale value that is still
  // pending when the URL changed underneath us (e.g. the user pressed back mid-typing).
  useEffect(() => {
    const term = debounced.trim()
    if (debounced === draft && term !== value) onSearch(term)
  }, [debounced, draft, value, onSearch])

  return (
    <form
      role="search"
      className={`relative ${className}`}
      onSubmit={(event) => {
        event.preventDefault()
        if (draft.trim() !== value) onSearch(draft.trim())
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        Search products
      </label>
      <FiSearch
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-stone-400"
      />
      <input
        id={inputId}
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Search products, brands and more"
        autoComplete="off"
        enterKeyHint="search"
        maxLength={100}
        className="input h-11 pr-11 pl-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <button
          type="button"
          onClick={() => {
            setDraft('')
            if (value) onSearch('')
          }}
          className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
          aria-label="Clear search"
        >
          <FiX aria-hidden="true" />
        </button>
      )}
    </form>
  )
}
