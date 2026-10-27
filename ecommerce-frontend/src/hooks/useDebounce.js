import { useEffect, useState } from 'react'

/**
 * Returns `value` once it has stopped changing for `delay` ms. Used to turn keystrokes
 * into a single search request instead of one request per character.
 */
export default function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
