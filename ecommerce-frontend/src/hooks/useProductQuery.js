import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DEFAULT_SORT, PRODUCTS_PER_PAGE, RATING_FILTERS, SORT_OPTIONS } from '../utils/constants'

// The catalogue's filters live in the URL query string (docs/API_CONTRACT.md §6), e.g.
// /?search=phone&category=smartphones,laptops&minPrice=500&sort=price_asc&page=2
// so back/forward, refresh and shared links all restore the same view. This hook is the
// only place that reads or writes those parameters.

const SORT_VALUES = new Set(SORT_OPTIONS.map((option) => option.value))
const RATING_VALUES = new Set(RATING_FILTERS.map(String))
const FILTER_KEYS = ['search', 'category', 'minPrice', 'maxPrice', 'minRating', 'inStock', 'sort', 'page']

/** Non-negative number as a string ("1499"), or '' when missing/invalid. */
function parsePrice(raw) {
  const value = raw?.trim() ?? ''
  if (!value) return ''
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? String(number) : ''
}

/** Reads and normalises the filters, so hand-edited URLs can never produce a 400 from the API. */
function parseFilters(searchParams) {
  let minPrice = parsePrice(searchParams.get('minPrice'))
  let maxPrice = parsePrice(searchParams.get('maxPrice'))
  if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) [minPrice, maxPrice] = [maxPrice, minPrice]

  const sort = searchParams.get('sort')
  const minRating = searchParams.get('minRating') ?? ''
  const page = Number.parseInt(searchParams.get('page') ?? '', 10)

  return {
    search: searchParams.get('search')?.trim() ?? '',
    categories: [
      ...new Set(
        (searchParams.get('category') ?? '')
          .split(',')
          .map((slug) => slug.trim().toLowerCase())
          .filter(Boolean),
      ),
    ],
    minPrice,
    maxPrice,
    minRating: RATING_VALUES.has(minRating) ? minRating : '',
    inStock: searchParams.get('inStock') === 'true',
    sort: SORT_VALUES.has(sort) ? sort : DEFAULT_SORT,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

/** Filters → URL entries in a stable order; defaults are omitted to keep links short. */
function toEntries(filters) {
  return [
    ['search', filters.search],
    ['category', filters.categories.join(',')],
    ['minPrice', filters.minPrice],
    ['maxPrice', filters.maxPrice],
    ['minRating', filters.minRating],
    ['inStock', filters.inStock ? 'true' : ''],
    ['sort', filters.sort === DEFAULT_SORT ? '' : filters.sort],
    ['page', filters.page > 1 ? String(filters.page) : ''],
  ].filter(([, value]) => value)
}

/** Writes filters into a copy of the current params, keeping any unrelated parameters. */
function writeFilters(currentParams, filters) {
  const next = new URLSearchParams(currentParams)
  FILTER_KEYS.forEach((key) => next.delete(key))
  toEntries(filters).forEach(([key, value]) => next.set(key, value))
  return next
}

/** Number of filters set in the filter panel (search has its own box, so it isn't counted). */
function countPanelFilters(filters) {
  return (
    filters.categories.length +
    (filters.minPrice || filters.maxPrice ? 1 : 0) +
    (filters.minRating ? 1 : 0) +
    (filters.inStock ? 1 : 0)
  )
}

export default function useProductQuery() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(searchParams), [searchParams])

  // Canonical query string for GET /products. Effects depend on this string, so a refetch
  // happens only when the request would actually change.
  const apiQuery = new URLSearchParams([...toEntries(filters), ['limit', String(PRODUCTS_PER_PAGE)]]).toString()
  const apiParams = useMemo(() => Object.fromEntries(new URLSearchParams(apiQuery)), [apiQuery])

  /**
   * Merges `patch` into the filters. Any filter change returns to page 1 unless `keepPage`;
   * `replace` swaps the history entry instead of pushing a new one.
   */
  const updateFilters = useCallback(
    (patch, { replace = false, keepPage = false } = {}) => {
      setSearchParams(
        (current) => {
          const next = { ...parseFilters(current), ...patch }
          if (!keepPage) next.page = 1
          return writeFilters(current, next)
        },
        { replace, preventScrollReset: true },
      )
    },
    [setSearchParams],
  )

  const setPage = useCallback((page) => updateFilters({ page }, { keepPage: true }), [updateFilters])

  /** Removes every filter but keeps the chosen sort order. */
  const clearFilters = useCallback(
    () =>
      updateFilters({ search: '', categories: [], minPrice: '', maxPrice: '', minRating: '', inStock: false }),
    [updateFilters],
  )

  const filterCount = countPanelFilters(filters)

  return {
    filters,
    apiParams,
    filterCount,
    hasActiveFilters: filterCount > 0 || Boolean(filters.search),
    updateFilters,
    setPage,
    clearFilters,
  }
}
