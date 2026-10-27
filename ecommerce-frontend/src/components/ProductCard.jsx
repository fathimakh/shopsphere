import { useState } from 'react'
import toast from 'react-hot-toast'
import { FiShoppingCart } from 'react-icons/fi'
import { LuSparkles } from 'react-icons/lu'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { selectCartItemQuantity } from '../redux/slices/cartSlice'
import { addToCart } from '../redux/thunks/cartThunks'
import { MAX_QUANTITY_PER_ITEM } from '../utils/constants'
import { discountPercent, formatCategory } from '../utils/format'
import PriceTag from './PriceTag'
import ProductImage from './ProductImage'
import RatingStars from './RatingStars'
import StockBadge from './StockBadge'

/**
 * Catalogue tile. The product name is a "stretched" link covering the whole card, so the
 * card is one big click target while the Add to cart button stays a separate control.
 * `reason` is the recommendation engine's explanation ("Because you viewed …").
 */
export default function ProductCard({ product, reason, className = '' }) {
  const dispatch = useDispatch()
  const inCart = useSelector((state) => selectCartItemQuantity(state, product._id))
  const [adding, setAdding] = useState(false)

  const { _id: id, name, category, price, mrp, stock = 0, rating, numReviews } = product
  const discount = discountPercent(price, mrp)
  const outOfStock = stock <= 0
  const maxedOut = !outOfStock && inCart >= Math.min(stock, MAX_QUANTITY_PER_ITEM)

  const handleAddToCart = async () => {
    setAdding(true)
    try {
      await dispatch(addToCart({ productId: id, quantity: 1 })).unwrap()
      toast.success(`${name} added to your cart`, { id: `cart-${id}` })
    } catch (error) {
      toast.error(error?.message || 'Could not add this item to your cart', { id: `cart-${id}` })
    } finally {
      setAdding(false)
    }
  }

  let buttonLabel = 'Add to cart'
  if (outOfStock) buttonLabel = 'Out of stock'
  else if (maxedOut) buttonLabel = 'Max in cart'
  else if (adding) buttonLabel = 'Adding…'

  return (
    <article
      className={`card group relative flex h-full flex-col overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-stone-900/5 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-brand-600 ${className}`}
    >
      <div className="relative aspect-square bg-white">
        <ProductImage
          src={product.thumbnail || product.images?.[0]}
          className={`size-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.04] sm:p-4 ${
            outOfStock ? 'opacity-50 grayscale' : ''
          }`}
        />
        {discount > 0 && (
          <span className="badge absolute top-2 left-2 bg-accent-500 text-white shadow-sm">−{discount}%</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 border-t border-stone-100 p-3 sm:p-4">
        {category && (
          <p className="truncate text-[11px] font-semibold tracking-wide text-brand-700 uppercase">
            {formatCategory(category)}
          </p>
        )}
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm leading-5 font-semibold text-stone-900">
          <Link
            to={`/product/${id}`}
            className="after:absolute after:inset-0 after:content-[''] hover:text-brand-800 focus-visible:outline-none"
          >
            {name}
          </Link>
        </h3>
        <RatingStars rating={rating} count={numReviews} />
        <PriceTag price={price} mrp={mrp} />
        <StockBadge stock={stock} compact />
        {reason && (
          <p className="flex items-start gap-1.5 text-xs text-stone-600">
            <LuSparkles aria-hidden="true" className="mt-0.5 shrink-0 text-accent-600" />
            <span className="line-clamp-2">{reason}</span>
          </p>
        )}

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={outOfStock || maxedOut || adding}
          aria-label={outOfStock || maxedOut ? `${name}: ${buttonLabel}` : `Add ${name} to cart`}
          className="btn btn-primary relative z-10 mt-auto h-10 w-full px-3"
        >
          <FiShoppingCart aria-hidden="true" className="shrink-0" />
          <span className="truncate">{buttonLabel}</span>
        </button>
      </div>
    </article>
  )
}
