import { useDispatch, useStore } from 'react-redux'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiAlertCircle, FiTrash2 } from 'react-icons/fi'
import QuantityStepper from './QuantityStepper'
import ProductImage from './ProductImage'
import { removeItem, replaceCart, selectCartItems, updateQuantity } from '../redux/slices/cartSlice'
import { MAX_QUANTITY_PER_ITEM } from '../utils/constants'
import { formatPrice } from '../utils/format'

const LOW_STOCK_THRESHOLD = 5

/** Stock note under a cart line: blocking when the quantity can't be fulfilled, a nudge when stock is low. */
function stockNotice({ stock, quantity }) {
  if (typeof stock !== 'number') return null
  if (stock <= 0) return { tone: 'error', text: 'Out of stock — remove it to place your order.' }
  if (quantity > stock) return { tone: 'error', text: `Only ${stock} left — reduce the quantity to continue.` }
  if (stock <= LOW_STOCK_THRESHOLD) return { tone: 'warning', text: `Only ${stock} left in stock.` }
  return null
}

/** One cart line: image, name, unit price, quantity stepper (bounded by stock), line total and remove-with-undo. */
export default function CartItem({ item }) {
  const dispatch = useDispatch()
  const store = useStore()
  const { productId, name, price, image, stock, quantity } = item
  const notice = stockNotice(item)
  const productUrl = `/product/${productId}`

  const handleRemove = () => {
    const position = selectCartItems(store.getState()).findIndex((entry) => entry.productId === productId)
    dispatch(removeItem(productId))

    // Undo puts the line back where it was, unless the product was re-added in the meantime.
    const undo = (toastId) => {
      toast.dismiss(toastId)
      const current = selectCartItems(store.getState())
      if (current.some((entry) => entry.productId === productId)) return
      const restored = [...current]
      restored.splice(Math.max(0, Math.min(position, restored.length)), 0, item)
      dispatch(replaceCart(restored))
    }

    toast(
      (t) => (
        <span className="flex items-center gap-3 text-sm">
          <span className="min-w-0">
            Removed <strong className="font-semibold">{name}</strong>
          </span>
          <button type="button" className="btn btn-secondary min-h-10 shrink-0 px-3" onClick={() => undo(t.id)}>
            Undo
          </button>
        </span>
      ),
      { id: `cart-remove-${productId}`, duration: 6000 },
    )
  }

  return (
    <li className="flex gap-3 py-5 sm:gap-5">
      <Link to={productUrl} className="shrink-0 self-start rounded-xl" tabIndex={-1} aria-hidden="true">
        <ProductImage src={image} className="size-20 shrink-0 rounded-xl border border-stone-200 bg-stone-100 object-cover sm:size-24" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={productUrl} className="line-clamp-2 font-semibold text-stone-900 hover:text-brand-700">
              {name}
            </Link>
            <p className="mt-0.5 text-sm text-stone-500">{formatPrice(price)} each</p>
          </div>
          <p className="shrink-0 text-right font-bold text-stone-900" aria-label={`Line total ${formatPrice(price * quantity)}`}>
            {formatPrice(price * quantity)}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <QuantityStepper
            size="sm"
            value={quantity}
            max={typeof stock === 'number' ? Math.min(stock, MAX_QUANTITY_PER_ITEM) : MAX_QUANTITY_PER_ITEM}
            onChange={(next) => dispatch(updateQuantity({ productId, quantity: next }))}
            label={`Quantity of ${name}`}
          />
          <button
            type="button"
            onClick={handleRemove}
            className="btn btn-ghost min-h-10 px-3 text-red-700 hover:bg-red-50"
            aria-label={`Remove ${name} from cart`}
          >
            <FiTrash2 aria-hidden="true" />
            Remove
          </button>
        </div>

        {notice && (
          <p
            className={`mt-2 flex items-start gap-1.5 text-sm font-medium ${
              notice.tone === 'error' ? 'text-red-700' : 'text-amber-700'
            }`}
          >
            <FiAlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {notice.text}
          </p>
        )}
      </div>
    </li>
  )
}
