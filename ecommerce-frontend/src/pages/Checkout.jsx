import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiArrowLeft, FiLock, FiShoppingCart } from 'react-icons/fi'
import AddressForm from '../components/AddressForm'
import ErrorMessage from '../components/ErrorMessage'
import OrderSummary from '../components/OrderSummary'
import PaymentMethodPicker from '../components/PaymentMethodPicker'
import ProductImage from '../components/ProductImage'
import useDocumentTitle from '../hooks/useDocumentTitle'
import useValidatedForm, { focusFirstInvalid } from '../hooks/useValidatedForm'
import { selectCurrentUser } from '../redux/slices/authSlice'
import {
  selectCartCount,
  selectCartItems,
  selectCartSubtotal,
  selectCartTotal,
  selectShippingFee,
} from '../redux/slices/cartSlice'
import { selectPlacingOrder } from '../redux/slices/orderSlice'
import { placeOrder } from '../redux/thunks/orderThunks'
import { formatPrice } from '../utils/format'
import { validateShippingAddress } from '../utils/validators'

/** Initial shipping address from the saved profile (contract §2 User shape). */
function addressFromUser(user) {
  const address = user?.address ?? {}
  return {
    fullName: user?.name ?? '',
    phone: user?.phone ?? '',
    street: address.street ?? '',
    city: address.city ?? '',
    state: address.state ?? '',
    postalCode: address.postalCode ?? '',
    country: address.country || 'India',
  }
}

const trimValues = (values) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]))

/** Turns a rejected placeOrder into the banner shown above the form. */
function describeOrderError(error, mappedFieldCount) {
  if (mappedFieldCount > 0 && mappedFieldCount === Object.keys(error.fieldErrors ?? {}).length) {
    return { title: 'Please check your shipping address', message: 'Fix the highlighted fields and try again.' }
  }
  if (error.status === 409) {
    return {
      title: 'Some items are no longer available in that quantity',
      message: error.message,
      cartHint: true,
    }
  }
  if (error.status === 400 || error.status === 404) {
    return { title: "We couldn't place your order", message: error.message, cartHint: true }
  }
  return { title: "We couldn't place your order", message: error.message }
}

function SectionCard({ step, title, description, action, children }) {
  return (
    <section aria-labelledby={`checkout-${step}`} className="card p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">
            {step}
          </span>
          <div>
            <h2 id={`checkout-${step}`} className="text-lg font-bold">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-stone-600">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function Checkout() {
  useDocumentTitle('Checkout')
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector(selectCurrentUser)
  const items = useSelector(selectCartItems)
  const itemCount = useSelector(selectCartCount)
  const subtotal = useSelector(selectCartSubtotal)
  const shipping = useSelector(selectShippingFee)
  const total = useSelector(selectCartTotal)
  const placing = useSelector(selectPlacingOrder)

  const [initialAddress] = useState(() => addressFromUser(user))
  const { errors, errorId, getFieldProps, setServerErrors, validateAll, values } = useValidatedForm(
    initialAddress,
    validateShippingAddress,
  )
  const [paymentMethod, setPaymentMethod] = useState('COD')
  const [orderError, setOrderError] = useState(null)
  // Set when the order is submitted: placing an order empties the cart, and this keeps the
  // "empty cart → back to /cart" redirect from racing the navigation to the new order.
  const [submitted, setSubmitted] = useState(false)
  const formRef = useRef(null)
  const errorRef = useRef(null)
  const isPlacing = submitted || placing.status === 'loading'
  const hasSavedAddress = Boolean(user?.address?.street)

  useEffect(() => {
    if (orderError) errorRef.current?.focus()
  }, [orderError])

  if (items.length === 0 && !submitted) return <Navigate to="/cart" replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isPlacing) return
    setOrderError(null)

    const clientErrors = validateAll()
    if (Object.keys(clientErrors).length > 0) {
      focusFirstInvalid(formRef.current, clientErrors)
      return
    }

    setSubmitted(true)
    try {
      const order = await dispatch(
        placeOrder({
          items: items.map(({ productId, quantity }) => ({ product: productId, quantity })),
          shippingAddress: trimValues(values),
          paymentMethod,
        }),
      ).unwrap()
      toast.success('Order placed — thank you for shopping with us!')
      navigate(`/orders/${order._id}?placed=1`, { replace: true })
    } catch (error) {
      setSubmitted(false)
      const mapped = setServerErrors(error.fieldErrors)
      setOrderError(describeOrderError(error, Object.keys(mapped).length))
      focusFirstInvalid(formRef.current, mapped)
    }
  }

  return (
    <div className="container-page py-8 sm:py-10">
      <Link to="/cart" className="link inline-flex min-h-10 items-center gap-1.5 text-sm">
        <FiArrowLeft aria-hidden="true" /> Back to cart
      </Link>
      <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Checkout</h1>

      <form
        ref={formRef}
        noValidate
        onSubmit={handleSubmit}
        aria-busy={isPlacing}
        className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-8"
      >
        <div className="min-w-0 space-y-6">
          {orderError && (
            <div ref={errorRef} tabIndex={-1} className="space-y-2 outline-none">
              <ErrorMessage title={orderError.title} message={orderError.message} />
              {orderError.cartHint && (
                <p className="text-sm text-stone-700">
                  Stock changes quickly.{' '}
                  <Link to="/cart" className="link">
                    Update your cart
                  </Link>{' '}
                  and try again.
                </p>
              )}
            </div>
          )}

          <SectionCard
            step={1}
            title="Shipping address"
            description={
              hasSavedAddress
                ? 'Prefilled from your profile — change anything for this order.'
                : 'Where should we deliver your order?'
            }
          >
            <AddressForm getFieldProps={getFieldProps} errors={errors} errorId={errorId} disabled={isPlacing} />
          </SectionCard>

          <SectionCard step={2} title="Payment method" description="Choose how you'd like to pay.">
            <PaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} disabled={isPlacing} />
          </SectionCard>

          <SectionCard
            step={3}
            title="Review items"
            description="Prices are confirmed by the server when you place the order."
            action={
              <Link to="/cart" className="link inline-flex min-h-10 items-center gap-1.5 text-sm">
                <FiShoppingCart aria-hidden="true" /> Edit cart
              </Link>
            }
          >
            <ul className="divide-y divide-stone-200">
              {items.map((item) => (
                <li key={item.productId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <ProductImage
                    src={item.image}
                    className="size-14 shrink-0 rounded-xl border border-stone-200 bg-stone-100 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-stone-900">{item.name}</p>
                    <p className="text-sm text-stone-500">
                      {item.quantity} × {formatPrice(item.price)}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold text-stone-900">{formatPrice(item.price * item.quantity)}</p>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <aside className="lg:sticky lg:top-24">
          <OrderSummary itemCount={itemCount} subtotal={subtotal} shipping={shipping} total={total}>
            <button type="submit" className="btn btn-accent btn-lg w-full" disabled={isPlacing}>
              {isPlacing ? 'Placing your order…' : `Place order · ${formatPrice(total)}`}
            </button>
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-stone-500">
              <FiLock aria-hidden="true" />
              {paymentMethod === 'CARD' ? 'Simulated payment — no card is charged.' : 'Pay when your order arrives.'}
            </p>
          </OrderSummary>
        </aside>
      </form>
    </div>
  )
}
