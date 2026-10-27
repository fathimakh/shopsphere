import { useCallback, useEffect, useState } from 'react'
import { FiArrowLeft, FiPackage, FiRotateCcw, FiShield, FiTruck } from 'react-icons/fi'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useLocation, useParams } from 'react-router-dom'
import AddToCartPanel from '../components/AddToCartPanel'
import Breadcrumbs from '../components/Breadcrumbs'
import EmptyState from '../components/EmptyState'
import ErrorMessage from '../components/ErrorMessage'
import PriceTag from '../components/PriceTag'
import ProductDetailSkeleton from '../components/ProductDetailSkeleton'
import ProductGallery from '../components/ProductGallery'
import RatingStars from '../components/RatingStars'
import Recommendations from '../components/Recommendations'
import ReviewForm from '../components/ReviewForm'
import ReviewList from '../components/ReviewList'
import ReviewSummary from '../components/ReviewSummary'
import StockBadge from '../components/StockBadge'
import useDocumentTitle from '../hooks/useDocumentTitle'
import { selectCurrentUser } from '../redux/slices/authSlice'
import { selectCurrentProduct, selectSimilarProducts } from '../redux/slices/productSlice'
import { fetchProductById, fetchSimilarProducts } from '../redux/thunks/productThunks'
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from '../utils/constants'
import { formatCategory, formatPrice, pluralize } from '../utils/format'

const SIMILAR_LIMIT = 6
// 400 = malformed id, 404 = no such product: both mean "this link leads nowhere".
const NOT_FOUND_STATUSES = new Set([400, 404])

const PROMISES = [
  {
    icon: FiTruck,
    title: 'Delivery',
    text: `Free on orders of ${formatPrice(FREE_SHIPPING_THRESHOLD)} or more, otherwise ${formatPrice(SHIPPING_FEE)}.`,
  },
  { icon: FiShield, title: 'Payment', text: 'Cash on delivery, or a simulated card payment at checkout.' },
  { icon: FiRotateCcw, title: 'Cancellation', text: 'Cancel free of charge until your order ships.' },
]

export default function ProductDetail() {
  const { id } = useParams()
  const location = useLocation()
  const dispatch = useDispatch()
  const user = useSelector(selectCurrentUser)
  const { item, status, error } = useSelector(selectCurrentProduct)
  const similar = useSelector(selectSimilarProducts)
  // The slice keeps only the error message; the HTTP status (404 vs 500) comes from unwrap().
  const [failure, setFailure] = useState({ id: null, status: null })

  // Loading the product also records a "view" for the recommender when the user is logged in.
  const loadProduct = useCallback(() => {
    const request = dispatch(fetchProductById(id))
    request.unwrap().catch((reason) => {
      if (reason?.name !== 'AbortError') setFailure({ id, status: reason?.status ?? null })
    })
    return request
  }, [dispatch, id])

  const loadSimilar = useCallback(
    () => dispatch(fetchSimilarProducts({ productId: id, limit: SIMILAR_LIMIT })),
    [dispatch, id],
  )

  useEffect(() => {
    const request = loadProduct()
    return () => request.abort()
  }, [loadProduct])

  useEffect(() => {
    const request = loadSimilar()
    return () => request.abort()
  }, [loadSimilar])

  const product = item?._id === id ? item : null
  const notFound = status === 'failed' && failure.id === id && NOT_FOUND_STATUSES.has(failure.status)
  useDocumentTitle(product?.name ?? (notFound ? 'Product not found' : 'Product'))

  if (notFound) {
    return (
      <div className="container-page py-10 sm:py-16">
        <EmptyState
          icon={FiPackage}
          title="Product not found"
          message="This product may have been removed, or the link is incorrect."
          action={
            <Link to="/" className="btn btn-primary">
              <FiArrowLeft aria-hidden="true" /> Back to the catalogue
            </Link>
          }
        />
      </div>
    )
  }

  if (status === 'failed' && !product) {
    return (
      <div className="container-page py-10 sm:py-16">
        <ErrorMessage title="We couldn't load this product" message={error} onRetry={loadProduct} />
        <Link to="/" className="link mt-4 inline-flex items-center gap-1.5 text-sm">
          <FiArrowLeft aria-hidden="true" /> Back to the catalogue
        </Link>
      </div>
    )
  }

  if (!product) return <ProductDetailSkeleton />

  const images = product.images?.length ? product.images : [product.thumbnail].filter(Boolean)
  const reviews = product.reviews ?? []
  const ownReview = user ? reviews.find((review) => String(review.user?._id ?? review.user) === String(user._id)) : null
  const showSimilar = similar.productId === id

  return (
    <div className="container-page space-y-12 py-5 sm:py-8">
      <div>
        <Breadcrumbs
          items={[
            { label: 'Home', to: '/' },
            ...(product.category
              ? [{ label: formatCategory(product.category), to: `/?category=${encodeURIComponent(product.category)}` }]
              : []),
            { label: product.name },
          ]}
        />

        <div className="mt-5 grid gap-6 lg:grid-cols-2 lg:gap-12">
          <ProductGallery key={product._id} images={images} name={product.name} />

          <div className="min-w-0 space-y-5">
            <div>
              <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">
                {[product.brand, formatCategory(product.category)].filter(Boolean).join(' · ')}
              </p>
              <h1 className="mt-1.5 text-2xl leading-tight font-extrabold break-words sm:text-3xl">{product.name}</h1>
              <a
                href="#reviews"
                className="mt-2 inline-flex min-h-10 items-center gap-2 text-sm text-stone-600 hover:text-brand-700"
              >
                <RatingStars rating={product.rating} size="md" />
                <span>
                  {Number(product.rating || 0).toFixed(1)} · {pluralize(product.numReviews ?? 0, 'review')}
                </span>
              </a>
            </div>

            <div className="space-y-1.5">
              <PriceTag price={product.price} mrp={product.mrp} size="lg" />
              <StockBadge stock={product.stock} className="text-sm" />
            </div>

            <AddToCartPanel key={product._id} product={product} />

            <ul className="card divide-y divide-stone-100">
              {PROMISES.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3 p-4">
                  <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-700" />
                  <p className="text-sm text-stone-600">
                    <span className="font-semibold text-stone-900">{title}. </span>
                    {text}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <section aria-labelledby="about-heading" className="max-w-3xl">
        <h2 id="about-heading" className="text-xl font-bold">
          About this product
        </h2>
        <p className="mt-3 leading-relaxed break-words whitespace-pre-line text-stone-700">{product.description}</p>
        {product.tags?.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Tags">
            {product.tags.map((tag) => (
              <li key={tag}>
                <Link
                  to={`/?search=${encodeURIComponent(tag)}`}
                  className="badge min-h-8 bg-stone-100 px-3 text-stone-700 hover:bg-stone-200"
                >
                  #{tag}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="reviews" aria-labelledby="reviews-heading" className="scroll-mt-24">
        <h2 id="reviews-heading" className="text-xl font-bold">
          Ratings &amp; reviews
        </h2>
        <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-12">
          <div className="space-y-6">
            <ReviewSummary rating={product.rating} numReviews={product.numReviews ?? reviews.length} reviews={reviews} />
            <div className="card p-5">
              <h3 className="text-base font-bold">{ownReview ? 'Update your review' : 'Write a review'}</h3>
              {user ? (
                <div className="mt-4">
                  <ReviewForm key={product._id} productId={product._id} existingReview={ownReview} />
                </div>
              ) : (
                <>
                  <p className="mt-1 text-sm text-stone-600">Share your experience with other shoppers.</p>
                  <Link to="/login" state={{ from: location }} className="btn btn-primary mt-4 h-11 w-full">
                    Log in to write a review
                  </Link>
                </>
              )}
            </div>
          </div>
          <ReviewList reviews={reviews} currentUserId={user?._id} />
        </div>
      </section>

      {showSimilar && (
        <Recommendations
          title="You may also like"
          subtitle="Products that shoppers interested in this item also engaged with."
          items={similar.items}
          source={similar.source}
          status={similar.status}
          error={similar.error}
          onRetry={loadSimilar}
          columns={6}
          skeletonCount={SIMILAR_LIMIT}
        />
      )}
    </div>
  )
}
