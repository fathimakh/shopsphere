import { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiArrowLeft, FiCheckCircle, FiLock, FiSearch, FiX, FiXCircle } from 'react-icons/fi'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import ErrorMessage from '../components/ErrorMessage'
import Loader from '../components/Loader'
import { PaymentStatus } from '../components/OrderCard'
import OrderStatusTimeline from '../components/OrderStatusTimeline'
import OrderSummary from '../components/OrderSummary'
import ProductImage from '../components/ProductImage'
import StatusBadge from '../components/StatusBadge'
import useDocumentTitle from '../hooks/useDocumentTitle'
import { selectCurrentUser } from '../redux/slices/authSlice'
import { selectCurrentOrder } from '../redux/slices/orderSlice'
import { cancelOrder, fetchOrderById } from '../redux/thunks/orderThunks'
import { CANCELLABLE_STATUSES, PAYMENT_METHODS } from '../utils/constants'
import { formatDate, formatDateTime, formatPrice, pluralize, shortId } from '../utils/format'

const paymentLabel = (method) => PAYMENT_METHODS.find((option) => option.value === method)?.label ?? method

/** Mongo refs may arrive as an id string or as a populated document. */
const refId = (ref) => (ref && typeof ref === 'object' ? ref._id : ref)

function DetailCard({ title, children, className = '' }) {
  return (
    <section className={`card p-5 sm:p-6 ${className}`}>
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** Full-page states for an order that can't be shown (403 / 404 / other failures). */
function OrderLoadError({ status, message, onRetry }) {
  const backToOrders = (
    <Link to="/orders" className="btn btn-primary">
      View my orders
    </Link>
  )

  if (status === 403) {
    return (
      <EmptyState
        icon={FiLock}
        title="This order belongs to another account"
        message="You can only view orders placed with the account you're signed in with."
        action={backToOrders}
      />
    )
  }
  if (status === 404 || status === 400) {
    return (
      <EmptyState
        icon={FiSearch}
        title="Order not found"
        message="We couldn't find that order. The link may be incorrect, or the order was removed."
        action={backToOrders}
      />
    )
  }
  return <ErrorMessage title="We couldn't load this order" message={message} onRetry={onRetry} />
}

export default function OrderDetail() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const dispatch = useDispatch()
  const user = useSelector(selectCurrentUser)
  const { item, status } = useSelector(selectCurrentOrder)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // The slice holds the last order opened; only trust it when it is the one in the URL.
  const order = item?._id === id ? item : null
  const justPlaced = searchParams.get('placed') === '1'
  useDocumentTitle(order ? `Order ${shortId(order._id)}` : 'Order details')

  // The slice keeps only the error message; the HTTP status (403 vs 404) decides which state to
  // show, so the rejection of the request for *this* id is kept locally.
  const [failure, setFailure] = useState(null)

  const loadOrder = useCallback(() => {
    const request = dispatch(fetchOrderById(id))
    request.unwrap().catch((rejection) => {
      if (!request.signal.aborted) setFailure({ id, ...rejection })
    })
    return request
  }, [dispatch, id])

  useEffect(() => {
    const request = loadOrder()
    return () => request.abort()
  }, [loadOrder])

  const dismissPlacedBanner = () => {
    setSearchParams(
      (params) => {
        params.delete('placed')
        return params
      },
      { replace: true },
    )
  }

  const handleCancel = async () => {
    setCancelling(true)
    try {
      await dispatch(cancelOrder(id)).unwrap()
      toast.success('Your order has been cancelled')
    } catch (cancelError) {
      toast.error(cancelError.message)
      // 409: the status moved on (e.g. it shipped meanwhile) — show the current state.
      if (cancelError.status === 409) loadOrder()
    } finally {
      setCancelling(false)
      setConfirmingCancel(false)
    }
  }

  let content
  if (order) {
    const ownerId = refId(order.user)
    const isOwner = !ownerId || ownerId === user?._id
    const canCancel = isOwner && CANCELLABLE_STATUSES.includes(order.status)
    const items = order.orderItems ?? []
    const itemCount = items.reduce((sum, line) => sum + line.quantity, 0)
    const address = order.shippingAddress ?? {}

    content = (
      <>
        {justPlaced && (
          <div
            role="status"
            className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"
          >
            <FiCheckCircle className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Thank you! Your order has been placed.</p>
              <p className="mt-0.5 text-sm text-emerald-800">
                {order.isPaid
                  ? 'Your simulated card payment was successful. '
                  : 'You can pay when your order is delivered. '}
                Track its progress on this page any time from “My orders”.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissPlacedBanner}
              className="btn-icon -m-1.5 text-emerald-800 hover:bg-emerald-100"
              aria-label="Dismiss message"
            >
              <FiX aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold sm:text-3xl">
                Order <span className="font-mono">{shortId(order._id)}</span>
              </h1>
              <StatusBadge status={order.status} className="text-sm" />
            </div>
            <p className="mt-1 text-sm text-stone-600">
              Placed on <time dateTime={order.createdAt}>{formatDateTime(order.createdAt)}</time>
            </p>
            {!isOwner && typeof order.user === 'object' && (
              <p className="mt-1 text-sm text-stone-600">
                Customer: <span className="font-semibold">{order.user.name}</span> ({order.user.email})
              </p>
            )}
          </div>
          {canCancel && (
            <button
              type="button"
              onClick={() => setConfirmingCancel(true)}
              className="btn btn-secondary text-red-700 hover:border-red-300 hover:bg-red-50"
            >
              <FiXCircle aria-hidden="true" /> Cancel order
            </button>
          )}
        </div>

        {order.status === 'cancelled' && (
          <p className="mt-4 rounded-2xl bg-stone-100 p-4 text-sm text-stone-700">
            This order was cancelled
            {order.cancelledAt && (
              <>
                {' '}
                on <time dateTime={order.cancelledAt}>{formatDate(order.cancelledAt)}</time>
              </>
            )}
            .{order.isPaid && ' The card payment was simulated, so no money was taken.'}
          </p>
        )}

        <DetailCard title="Order progress" className="mt-6">
          <OrderStatusTimeline
            status={order.status}
            statusHistory={order.statusHistory}
            createdAt={order.createdAt}
          />
        </DetailCard>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <DetailCard title={`Items (${pluralize(itemCount, 'item')})`}>
            <ul className="divide-y divide-stone-200">
              {items.map((line) => {
                const productId = refId(line.product)
                return (
                  <li key={productId ?? line.name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 sm:gap-4">
                    <ProductImage
                      src={line.image}
                      className="size-16 shrink-0 rounded-xl border border-stone-200 bg-stone-100 object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      {productId ? (
                        <Link
                          to={`/product/${productId}`}
                          className="line-clamp-2 font-semibold text-stone-900 hover:text-brand-700"
                        >
                          {line.name}
                        </Link>
                      ) : (
                        <p className="line-clamp-2 font-semibold text-stone-900">{line.name}</p>
                      )}
                      <p className="text-sm text-stone-500">
                        {line.quantity} × {formatPrice(line.price)}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold text-stone-900">{formatPrice(line.price * line.quantity)}</p>
                  </li>
                )
              })}
            </ul>
          </DetailCard>

          <div className="space-y-6">
            <OrderSummary
              title="Price details"
              subtotal={order.itemsPrice}
              shipping={order.shippingPrice}
              total={order.totalPrice}
            />

            <DetailCard title="Payment">
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-600">Method</dt>
                  <dd className="text-right font-medium text-stone-900">{paymentLabel(order.paymentMethod)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-600">Status</dt>
                  <dd className="text-right">
                    <PaymentStatus order={order} />
                    {order.paidAt && (
                      <span className="block text-xs text-stone-500">{formatDateTime(order.paidAt)}</span>
                    )}
                  </dd>
                </div>
                {order.paymentResult?.reference && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-stone-600">Reference</dt>
                    <dd className="min-w-0 text-right">
                      <span className="font-mono text-xs break-all text-stone-900">
                        {order.paymentResult.reference}
                      </span>
                      <span className="block text-xs text-stone-500">Simulated — no card was charged</span>
                    </dd>
                  </div>
                )}
              </dl>
            </DetailCard>

            <DetailCard title="Shipping address">
              <address className="text-sm leading-relaxed text-stone-700 not-italic">
                <span className="font-semibold text-stone-900">{address.fullName}</span>
                <br />
                {address.street}
                <br />
                {[address.city, address.state, address.postalCode].filter(Boolean).join(', ')}
                <br />
                {address.country}
                {address.phone && (
                  <>
                    <br />
                    Phone: {address.phone}
                  </>
                )}
              </address>
            </DetailCard>
          </div>
        </div>

        <ConfirmDialog
          open={confirmingCancel}
          title="Cancel this order?"
          message={`Order ${shortId(order._id)} will be cancelled and its items returned to stock. This can't be undone.`}
          confirmLabel="Cancel order"
          cancelLabel="Keep order"
          busy={cancelling}
          onConfirm={handleCancel}
          onCancel={() => setConfirmingCancel(false)}
        />
      </>
    )
  } else if (status === 'failed' && failure?.id === id) {
    content = (
      <div className="mt-6">
        <h1 className="sr-only">Order details</h1>
        <OrderLoadError status={failure.status} message={failure.message} onRetry={loadOrder} />
      </div>
    )
  } else {
    content = <Loader label="Loading your order…" fullPage />
  }

  return (
    <div className="container-page max-w-6xl py-8 sm:py-10">
      <Link to="/orders" className="link inline-flex min-h-10 items-center gap-1.5 text-sm">
        <FiArrowLeft aria-hidden="true" /> All orders
      </Link>
      {content}
    </div>
  )
}
