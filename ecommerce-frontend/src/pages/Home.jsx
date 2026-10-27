import { useCallback, useEffect, useRef, useState } from 'react'
import { FiPackage, FiSearch, FiSliders } from 'react-icons/fi'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import ActiveFilters from '../components/ActiveFilters'
import EmptyState from '../components/EmptyState'
import ErrorMessage from '../components/ErrorMessage'
import FilterDrawer from '../components/FilterDrawer'
import Filters from '../components/Filters'
import Hero from '../components/Hero'
import Pagination from '../components/Pagination'
import ProductCard from '../components/ProductCard'
import ProductCardSkeleton from '../components/ProductCardSkeleton'
import Recommendations from '../components/Recommendations'
import SearchBar from '../components/SearchBar'
import SortSelect from '../components/SortSelect'
import useDocumentTitle from '../hooks/useDocumentTitle'
import useProductQuery from '../hooks/useProductQuery'
import { selectIsAuthenticated } from '../redux/slices/authSlice'
import { selectCategories, selectProductList, selectRecommendations } from '../redux/slices/productSlice'
import { fetchCategories, fetchProducts, fetchRecommendations } from '../redux/thunks/productThunks'
import { PRODUCTS_PER_PAGE } from '../utils/constants'
import { pluralize } from '../utils/format'

const RECOMMENDATION_LIMIT = 8
const PRODUCT_GRID = 'grid grid-cols-1 gap-3 min-[22.5rem]:grid-cols-2 sm:gap-4 md:grid-cols-3 xl:grid-cols-4'

function recommendationCopy(isAuthenticated, strategy) {
  if (!isAuthenticated) {
    return {
      title: 'Trending now',
      subtitle: (
        <>
          What shoppers are buying this week.{' '}
          <Link to="/login" className="link">
            Log in
          </Link>{' '}
          for picks based on your own browsing.
        </>
      ),
    }
  }
  return {
    title: 'Recommended for you',
    subtitle:
      strategy === 'trending'
        ? 'Popular picks for now. View, review or buy a few products and this list becomes personal.'
        : 'Based on what you have viewed, added to your cart and bought.',
  }
}

/** "Showing 13–24 of 57 products" */
function resultSummary({ page, limit, total }) {
  if (!total) return 'No products found'
  const perPage = limit || PRODUCTS_PER_PAGE
  const first = (page - 1) * perPage + 1
  const last = Math.min(page * perPage, total)
  return `Showing ${first}–${last} of ${pluralize(total, 'product')}`
}

/**
 * Home = catalogue (contract §6). The URL query string is the single source of truth for
 * search, filters, sort and page; this page turns it into GET /products requests.
 */
export default function Home() {
  useDocumentTitle(null)
  const dispatch = useDispatch()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const productList = useSelector(selectProductList)
  const categories = useSelector(selectCategories)
  const recommendations = useSelector(selectRecommendations)
  const { filters, apiParams, filterCount, hasActiveFilters, updateFilters, setPage, clearFilters } =
    useProductQuery()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const catalogueRef = useRef(null)
  const headingRef = useRef(null)

  // The URL drives the product request; a newer query aborts the one still in flight.
  const loadProducts = useCallback(() => dispatch(fetchProducts(apiParams)), [dispatch, apiParams])
  useEffect(() => {
    const request = loadProducts()
    return () => request.abort()
  }, [loadProducts])

  const categoryStatus = categories.status
  useEffect(() => {
    if (categoryStatus === 'idle') dispatch(fetchCategories())
  }, [dispatch, categoryStatus])

  // Personalised for logged-in users, trending for guests, so refetch when that changes.
  const loadRecommendations = useCallback(
    () => dispatch(fetchRecommendations({ limit: RECOMMENDATION_LIMIT })),
    [dispatch],
  )
  useEffect(() => {
    const request = loadRecommendations()
    return () => request.abort()
  }, [loadRecommendations, isAuthenticated])

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  const scrollToCatalogue = () => {
    catalogueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    headingRef.current?.focus({ preventScroll: true })
  }

  const handleSearch = useCallback(
    // Refining an existing search replaces the history entry, so Back doesn't step through every pause.
    (search) => updateFilters({ search }, { replace: Boolean(filters.search && search) }),
    [updateFilters, filters.search],
  )

  const handlePageChange = (page) => {
    setPage(page)
    scrollToCatalogue()
  }

  const { items, pagination, status, error } = productList
  const isLoading = status === 'idle' || status === 'loading'
  const showSkeleton = isLoading && !items.length
  const isRefreshing = isLoading && items.length > 0
  const { title: railTitle, subtitle: railSubtitle } = recommendationCopy(isAuthenticated, recommendations.strategy)

  let results
  if (status === 'failed') {
    results = <ErrorMessage title="We couldn't load products" message={error} onRetry={loadProducts} />
  } else if (showSkeleton) {
    results = (
      <ul className={PRODUCT_GRID} aria-hidden="true">
        {Array.from({ length: PRODUCTS_PER_PAGE }, (_, index) => (
          <li key={index}>
            <ProductCardSkeleton />
          </li>
        ))}
      </ul>
    )
  } else if (!items.length && pagination.total > 0) {
    results = (
      <EmptyState
        icon={FiPackage}
        title="This page is empty"
        message={`There are only ${pluralize(pagination.pages, 'page')} of results.`}
        action={
          <button type="button" className="btn btn-primary" onClick={() => handlePageChange(1)}>
            Go to the first page
          </button>
        }
      />
    )
  } else if (!items.length) {
    results = hasActiveFilters ? (
      <EmptyState
        icon={FiSearch}
        title="No products match your filters"
        message={
          filters.search
            ? `Nothing found for “${filters.search}”. Try a different word or remove a filter.`
            : 'Try widening the price range or removing a filter.'
        }
        action={
          <button type="button" className="btn btn-primary" onClick={clearFilters}>
            Clear filters
          </button>
        }
      />
    ) : (
      <EmptyState icon={FiPackage} title="No products yet" message="The catalogue is empty. Please check back soon." />
    )
  } else {
    results = (
      <ul className={`${PRODUCT_GRID} transition-opacity ${isRefreshing ? 'opacity-60' : ''}`}>
        {items.map((product) => (
          <li key={product._id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    )
  }

  const filterPanel = (
    <Filters
      filters={filters}
      onChange={updateFilters}
      categories={categories}
      onRetryCategories={() => dispatch(fetchCategories())}
    />
  )

  return (
    <div className="container-page space-y-10 py-5 sm:space-y-12 sm:py-8">
      <Hero isAuthenticated={isAuthenticated} onShopNow={scrollToCatalogue} />

      <Recommendations
        title={railTitle}
        subtitle={railSubtitle}
        items={recommendations.items}
        source={recommendations.source}
        status={recommendations.status}
        error={recommendations.error}
        onRetry={loadRecommendations}
        columns={4}
      />

      <section id="catalogue" ref={catalogueRef} aria-labelledby="catalogue-heading" className="scroll-mt-20">
        <div className="flex flex-col gap-1">
          <h2 id="catalogue-heading" ref={headingRef} tabIndex={-1} className="text-xl font-bold focus:outline-none sm:text-2xl">
            {filters.search ? `Results for “${filters.search}”` : 'Shop all products'}
          </h2>
          <p className="text-sm text-stone-600" aria-live="polite">
            {status === 'failed' ? '' : isLoading ? 'Loading products…' : resultSummary(pagination)}
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
          <SearchBar value={filters.search} onSearch={handleSearch} className="md:flex-1" />
          <div className="flex gap-3">
            <button
              type="button"
              className="btn btn-secondary h-11 shrink-0 lg:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-haspopup="dialog"
            >
              <FiSliders aria-hidden="true" />
              Filters
              {filterCount > 0 && (
                <span className="badge bg-brand-700 px-2 text-white">
                  {filterCount}
                  <span className="sr-only"> active</span>
                </span>
              )}
            </button>
            <SortSelect
              value={filters.sort}
              onChange={(sort) => updateFilters({ sort })}
              className="min-w-0 flex-1 md:w-60 md:flex-none"
            />
          </div>
        </div>

        <ActiveFilters filters={filters} onChange={updateFilters} onClearAll={clearFilters} className="mt-4" />

        <div className="mt-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8">
          <aside aria-label="Product filters" className="hidden lg:sticky lg:top-24 lg:block">
            <div className="card max-h-[calc(100dvh-7rem)] overflow-y-auto p-4">{filterPanel}</div>
          </aside>

          <div aria-busy={isLoading}>
            {results}
            {status !== 'failed' && (
              <Pagination
                page={pagination.page}
                pages={pagination.pages}
                onPageChange={handlePageChange}
                className="mt-8"
              />
            )}
          </div>
        </div>
      </section>

      <FilterDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              className="btn btn-secondary h-11"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
            >
              Clear all
            </button>
            <button type="button" className="btn btn-primary h-11 flex-1" onClick={closeDrawer}>
              {isLoading ? 'Updating…' : `Show ${pluralize(pagination.total, 'result')}`}
            </button>
          </div>
        }
      >
        {filterPanel}
      </FilterDrawer>
    </div>
  )
}
