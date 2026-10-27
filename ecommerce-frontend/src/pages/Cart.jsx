import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiAlertTriangle, FiArrowLeft, FiArrowRight, FiLock, FiShoppingCart, FiTrash2 } from 'react-icons/fi'
import CartItem from '../components/CartItem'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import OrderSummary from '../components/OrderSummary'
import useDocumentTitle from '../hooks/useDocumentTitle'
import { selectIsAuthenticated } from '../redux/slices/authSlice'
import {
  clearCart,
  selectCartCount,
  selectCartItems,
  selectCartSubtotal,
  selectCartTotal,
  selectShippingFee,
} from '../redux/slices/cartSlice'
import { pluralize } from '../utils/format'

// Where login/register return to afterwards (read by useRedirectPath as a location-like object).
const CHECKOUT_REDIRECT = { from: { pathname: '/checkout' } }

/** True when a line can't be fulfilled with the stock we last saw for it. */
const exceedsStock = (item) => typeof item.stock === 'number' && item.quantity > item.stock

export default function Cart() {
  useDocumentTitle('Your cart')
  const dispatch = useDispatch()
  const items = useSelector(selectCartItems)
  const itemCount = useSelector(selectCartCount)
  const subtotal = useSelector(selectCartSubtotal)
  const shipping = useSelector(selectShippingFee)
  const total = useSelector(selectCartTotal)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const [confirmingClear, setConfirmingClear] = useState(false)

  if (items.length === 0) {
    return (
      <div className="container-page py-10 sm:py-14">
        <h1 className="sr-only">Your cart</h1>
        <EmptyState
          icon={FiShoppingCart}
          title="Your cart is empty"
          message="Looks like you haven't added anything yet. Browse the catalogue and find something you'll love."
          action={
            <Link to="/" className="btn btn-primary btn-lg">
              Start shopping
            </Link>
          }
        />
      </div>
    )
  }

  const hasStockIssues = items.some(exceedsStock)

  const handleClear = () => {
    dispatch(clearCart())
    setConfirmingClear(false)
    toast.success('Your cart is now empty')
  }

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Your cart</h1>
          <p className="mt-1 text-sm text-stone-600">{pluralize(itemCount, 'item')} ready for checkout</p>
        </div>
        <Link to="/" className="link inline-flex min-h-10 items-center gap-1.5 text-sm">
          <FiArrowLeft aria-hidden="true" /> Continue shopping
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-8">
        <section aria-label="Items in your cart" className="card px-4 sm:px-6">
          <ul className="divide-y divide-stone-200">
            {items.map((item) => (
              <CartItem key={item.productId} item={item} />
            ))}
          </ul>
          <div className="flex justify-end border-t border-stone-200 py-3">
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              className="btn btn-ghost min-h-10 px-3 text-stone-600"
            >
              <FiTrash2 aria-hidden="true" /> Clear cart
            </button>
          </div>
        </section>

        <aside className="lg:sticky lg:top-24">
          <OrderSummary
            itemCount={itemCount}
            subtotal={subtotal}
            shipping={shipping}
            total={total}
            showShippingHint
            note="Prices include all taxes. Stock and final prices are confirmed when you place the order."
          >
            {hasStockIssues && (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                <FiAlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Some items exceed the available stock. Update their quantities to continue.
              </p>
            )}
            {hasStockIssues ? (
              <button type="button" className="btn btn-primary btn-lg w-full" disabled>
                Proceed to checkout <FiArrowRight aria-hidden="true" />
              </button>
            ) : isAuthenticated ? (
              <Link to="/checkout" className="btn btn-primary btn-lg w-full">
                Proceed to checkout <FiArrowRight aria-hidden="true" />
              </Link>
            ) : (
              <>
                <Link to="/login" state={CHECKOUT_REDIRECT} className="btn btn-primary btn-lg w-full">
                  <FiLock aria-hidden="true" /> Log in to checkout
                </Link>
                <p className="text-center text-xs text-stone-500">
                  New here?{' '}
                  <Link to="/register" state={CHECKOUT_REDIRECT} className="link">
                    Create an account
                  </Link>{' '}
                  — your cart is saved.
                </p>
              </>
            )}
            <Link to="/" className="btn btn-secondary w-full">
              Continue shopping
            </Link>
          </OrderSummary>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmingClear}
        title="Clear your cart?"
        message={`This removes all ${pluralize(itemCount, 'item')} from your cart.`}
        confirmLabel="Clear cart"
        onConfirm={handleClear}
        onCancel={() => setConfirmingClear(false)}
      />
    </div>
  )
}
