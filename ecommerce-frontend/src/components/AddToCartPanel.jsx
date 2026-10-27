import { useState } from 'react'
import toast from 'react-hot-toast'
import { FiCheckCircle, FiShoppingCart, FiZap } from 'react-icons/fi'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { selectCartItemQuantity } from '../redux/slices/cartSlice'
import { addToCart } from '../redux/thunks/cartThunks'
import { MAX_QUANTITY_PER_ITEM } from '../utils/constants'
import QuantityStepper from './QuantityStepper'

/**
 * Quantity picker with "Add to cart" and "Buy now" for the product page. The picker's
 * maximum is what can still be added: stock (and the per-line cap) minus what is already in the cart.
 */
export default function AddToCartPanel({ product }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const inCart = useSelector((state) => selectCartItemQuantity(state, product._id))
  const [quantity, setQuantity] = useState(1)
  const [pending, setPending] = useState(null) // 'add' | 'buy' while a request runs

  const stock = Math.max(0, product.stock ?? 0)
  const remaining = Math.max(0, Math.min(stock, MAX_QUANTITY_PER_ITEM) - inCart)
  const outOfStock = stock === 0
  const selected = Math.min(quantity, Math.max(remaining, 1))

  const add = async (mode) => {
    setPending(mode)
    try {
      await dispatch(addToCart({ productId: product._id, quantity: selected })).unwrap()
      setQuantity(1)
      if (mode === 'buy') {
        navigate('/cart')
      } else {
        toast.success(`${selected} × ${product.name} added to your cart`, { id: `cart-${product._id}` })
      }
    } catch (error) {
      toast.error(error?.message || 'Could not add this item to your cart', { id: `cart-${product._id}` })
    } finally {
      setPending(null)
    }
  }

  if (outOfStock) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-semibold">Currently out of stock</p>
        <p className="mt-0.5 text-red-700">This item will be back soon. Browse similar products below.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {remaining > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <QuantityStepper
            value={selected}
            max={remaining}
            onChange={setQuantity}
            label={`Quantity of ${product.name}`}
          />
          {remaining <= 10 && (
            <span className="text-xs text-stone-500">
              You can add {remaining} more
            </span>
          )}
        </div>
      ) : (
        <p className="text-sm text-stone-600">You already have every available unit in your cart.</p>
      )}

      <div className="grid gap-3 min-[26rem]:grid-cols-2">
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={() => add('add')}
          disabled={remaining === 0 || pending !== null}
        >
          <FiShoppingCart aria-hidden="true" />
          {pending === 'add' ? 'Adding…' : 'Add to cart'}
        </button>
        {remaining > 0 ? (
          <button type="button" className="btn btn-accent btn-lg" onClick={() => add('buy')} disabled={pending !== null}>
            <FiZap aria-hidden="true" />
            {pending === 'buy' ? 'Please wait…' : 'Buy now'}
          </button>
        ) : (
          <Link to="/cart" className="btn btn-accent btn-lg">
            Go to cart
          </Link>
        )}
      </div>

      {inCart > 0 && (
        <p className="flex items-center gap-1.5 text-sm text-emerald-700">
          <FiCheckCircle aria-hidden="true" className="shrink-0" />
          <span>
            {inCart} in your cart ·{' '}
            <Link to="/cart" className="link">
              View cart
            </Link>
          </span>
        </p>
      )}
    </div>
  )
}
