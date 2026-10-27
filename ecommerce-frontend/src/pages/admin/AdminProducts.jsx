import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FiEdit2, FiPackage, FiPlus, FiSearch, FiStar, FiTrash2 } from 'react-icons/fi'
import api from '../../api/axiosInstance'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import AdminTable from '../../components/admin/AdminTable'
import DialogError from '../../components/admin/DialogError'
import ProductFormDialog from '../../components/admin/ProductFormDialog'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import ErrorMessage from '../../components/ErrorMessage'
import Loader from '../../components/Loader'
import Pagination from '../../components/Pagination'
import AdminThumbnail from '../../components/admin/AdminThumbnail'
import useAdminMutation from '../../hooks/useAdminMutation'
import useAdminResource from '../../hooks/useAdminResource'
import useDebounce from '../../hooks/useDebounce'
import useDocumentTitle from '../../hooks/useDocumentTitle'
import { DEFAULT_SORT, SORT_OPTIONS } from '../../utils/constants'
import { formatCategory, formatPrice } from '../../utils/format'

const PAGE_SIZE = 20
const LOW_STOCK = 5

const COLUMNS = [
  {
    id: 'product',
    header: 'Product',
    primary: true,
    cell: (product) => (
      <div className="flex items-center gap-3">
        <AdminThumbnail src={product.thumbnail || product.images?.[0]} className="size-12" />
        <div className="min-w-0">
          <Link
            to={`/product/${product._id}`}
            className="line-clamp-2 font-semibold text-stone-900 hover:text-brand-700 xl:max-w-xs"
          >
            {product.name}
          </Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
            {product.brand}
            {product.isFeatured && <span className="badge bg-accent-100 px-2 text-accent-800">Featured</span>}
          </p>
        </div>
      </div>
    ),
  },
  { id: 'category', header: 'Category', cell: (product) => formatCategory(product.category) },
  {
    id: 'price',
    header: 'Price',
    align: 'right',
    cell: (product) => (
      <span className="whitespace-nowrap tabular-nums">
        <span className="font-semibold text-stone-900">{formatPrice(product.price)}</span>
        {product.mrp > product.price && (
          <span className="ml-1.5 text-xs text-stone-400 line-through">{formatPrice(product.mrp)}</span>
        )}
      </span>
    ),
  },
  {
    id: 'stock',
    header: 'Stock',
    align: 'right',
    cell: (product) => (
      <span
        className={`font-semibold tabular-nums ${
          product.stock === 0 ? 'text-red-700' : product.stock <= LOW_STOCK ? 'text-amber-700' : 'text-stone-800'
        }`}
      >
        {product.stock === 0 ? 'Out of stock' : product.stock}
      </span>
    ),
  },
  {
    id: 'rating',
    header: 'Rating',
    align: 'right',
    hideOnMobile: true,
    cell: (product) => (
      <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
        <FiStar className="size-3.5 fill-accent-400 text-accent-400" aria-hidden="true" />
        {Number(product.rating ?? 0).toFixed(1)}
        <span className="text-xs text-stone-500">({product.numReviews ?? 0})</span>
      </span>
    ),
  },
]

/** Catalogue management: search / filter / sort / paginate GET /products, create, edit and delete. */
export default function AdminProducts() {
  useDocumentTitle('Manage products')
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search.trim())
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [page, setPage] = useState(1)

  // A new search term always starts from page 1 (adjusting state while rendering, not in an effect).
  const [searchedTerm, setSearchedTerm] = useState(debouncedSearch)
  if (searchedTerm !== debouncedSearch) {
    setSearchedTerm(debouncedSearch)
    setPage(1)
  }

  const products = useAdminResource('/products', {
    params: { search: debouncedSearch, category, sort, page, limit: PAGE_SIZE },
  })
  const categories = useAdminResource('/products/categories')
  const categoryList = categories.data?.categories ?? []

  // The dashboard links to ?edit=<id>; that product is fetched so it can be edited from any page.
  const linkedId = searchParams.get('edit')
  const linked = useAdminResource(linkedId ? `/products/${linkedId}` : null)
  const [editor, setEditor] = useState(null) // { product: null } = create, { product } = edit
  const dialogProduct = editor ? editor.product : linked.status === 'succeeded' ? linked.data?.product : undefined

  const [pendingDelete, setPendingDelete] = useState(null)
  const { run, isPending, error: deleteError, resetError } = useAdminMutation()

  const items = products.data?.products ?? []
  const pagination = products.data?.pagination ?? { page: 1, pages: 1, total: 0, limit: PAGE_SIZE }
  const hasFilters = Boolean(debouncedSearch || category)

  const clearLink = () =>
    setSearchParams(
      (params) => {
        params.delete('edit')
        return params
      },
      { replace: true },
    )

  const closeEditor = () => {
    setEditor(null)
    if (linkedId) clearLink()
  }

  const handleSaved = () => {
    closeEditor()
    products.reload()
    categories.reload()
  }

  const closeDelete = () => {
    setPendingDelete(null)
    resetError()
  }

  const confirmDelete = async () => {
    const product = pendingDelete
    const { ok } = await run(`delete:${product._id}`, () => api.delete(`/products/${product._id}`), {
      successMessage: `Deleted "${product.name}"`,
    })
    if (!ok) return
    setPendingDelete(null)
    categories.reload()
    // Deleting the last row of a page steps back instead of showing an empty page.
    if (items.length === 1 && page > 1) setPage(page - 1)
    else products.reload()
  }

  const clearFilters = () => {
    setSearch('')
    setCategory('')
    setPage(1)
  }

  const firstShown = (pagination.page - 1) * pagination.limit + 1
  const lastShown = Math.min(pagination.page * pagination.limit, pagination.total)

  return (
    <>
      <AdminPageHeader
        title="Products"
        description="Add, update and remove what the store sells."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditor({ product: null })}>
            <FiPlus className="size-4" aria-hidden="true" /> Add product
          </button>
        }
      />

      {linked.status === 'failed' && (
        <ErrorMessage
          title="Couldn't open that product"
          message={linked.error?.message}
          onRetry={linked.reload}
          className="mb-4"
        />
      )}

      <div role="search" className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <label htmlFor="admin-product-search" className="sr-only">
            Search products
          </label>
          <FiSearch className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
          <input
            id="admin-product-search"
            type="search"
            className="input pl-10"
            placeholder="Search name, brand or tag…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="admin-product-category" className="sr-only">
            Category
          </label>
          <select
            id="admin-product-category"
            className="input"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value)
              setPage(1)
            }}
          >
            <option value="">All categories</option>
            {categoryList.map(({ name, count }) => (
              <option key={name} value={name}>
                {formatCategory(name)} ({count})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="admin-product-sort" className="sr-only">
            Sort by
          </label>
          <select
            id="admin-product-sort"
            className="input"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value)
              setPage(1)
            }}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                Sort: {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {products.status === 'failed' ? (
        <ErrorMessage title="Couldn't load products" message={products.error?.message} onRetry={products.reload} />
      ) : !products.data ? (
        <Loader label="Loading products…" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={FiPackage}
          title={hasFilters ? 'No products match' : 'No products yet'}
          message={hasFilters ? 'Try another search term or category.' : 'Add your first product to open the store.'}
          action={
            hasFilters ? (
              <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                Clear filters
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setEditor({ product: null })}>
                <FiPlus aria-hidden="true" /> Add product
              </button>
            )
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-stone-600" aria-live="polite">
            Showing {firstShown}–{lastShown} of {pagination.total} products
          </p>
          <AdminTable
            caption="Products"
            columns={COLUMNS}
            rows={items}
            getRowKey={(product) => product._id}
            busy={products.status === 'loading'}
            renderActions={(product) => (
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm min-h-10"
                  onClick={() => setEditor({ product })}
                  aria-label={`Edit ${product.name}`}
                >
                  <FiEdit2 aria-hidden="true" /> Edit
                </button>
                <button
                  type="button"
                  className="btn btn-sm min-h-10 text-red-700 hover:bg-red-50"
                  onClick={() => setPendingDelete(product)}
                  aria-label={`Delete ${product.name}`}
                >
                  <FiTrash2 aria-hidden="true" /> Delete
                </button>
              </>
            )}
          />
          <Pagination page={pagination.page} pages={pagination.pages} onPageChange={setPage} className="mt-6" />
        </>
      )}

      {dialogProduct !== undefined && (
        <ProductFormDialog
          key={dialogProduct?._id ?? 'new'}
          product={dialogProduct}
          categories={categoryList}
          onClose={closeEditor}
          onSaved={handleSaved}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this product?"
        message={
          pendingDelete &&
          `"${pendingDelete.name}" will be removed from the store. Past orders keep their own copy of the item.`
        }
        confirmLabel="Delete product"
        busy={isPending}
        onConfirm={confirmDelete}
        onCancel={closeDelete}
      >
        <DialogError message={deleteError?.message} />
      </ConfirmDialog>
    </>
  )
}
