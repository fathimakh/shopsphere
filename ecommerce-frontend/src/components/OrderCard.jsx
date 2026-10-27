import { Link } from 'react-router-dom'
import { FiChevronRight } from 'react-icons/fi'
import ProductImage from './ProductImage'
import StatusBadge from './StatusBadge'
import { formatDate, formatPrice, pluralize, shortId } from '../utils/format'

const MAX_THUMBNAILS = 4

function paymentStatus(order) {
  if (order.isPaid) return { text: 'Paid', className: 'text-emerald-700' }
  if (order.status === 'cancelled') return { text: 'Not charged', className: 'text-stone-500' }
  return { text: order.paymentMethod === 'COD' ? 'Pay on delivery' : 'Payment pending', className: 'text-amber-700' }
}

/** Payment state of an order: paid / pay on delivery / not charged (cancelled before payment). */
export function PaymentStatus({ order, className = '' }) {
  const { text, className: tone } = paymentStatus(order)
  return <span className={`font-semibold ${tone} ${className}`}>{text}</span>
}

/** Summary card for the "My orders" list; the whole card links to the order page. */
export default function OrderCard({ order }) {
  const items = order.orderItems ?? []
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const hiddenCount = items.length - MAX_THUMBNAILS

  return (
    <article className="card relative p-4 transition hover:border-brand-300 hover:shadow-md focus-within:border-brand-300 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-stone-900">
            {/* Stretched link: the ::after overlay makes the whole card clickable. */}
            <Link
              to={`/orders/${order._id}`}
              className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand-600"
            >
              Order <span className="font-mono">{shortId(order._id)}</span>
            </Link>
          </h2>
          <p className="mt-0.5 text-sm text-stone-500">
            Placed on <time dateTime={order.createdAt}>{formatDate(order.createdAt)}</time>
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <ul className="flex items-center gap-2" aria-label="Items in this order">
          {items.slice(0, MAX_THUMBNAILS).map((item) => (
            <li key={item.product ?? item.name}>
              <ProductImage src={item.image} alt={item.name} className="size-12 rounded-xl border border-stone-200 bg-stone-100 object-cover sm:size-14" />
            </li>
          ))}
          {hiddenCount > 0 && (
            <li className="grid size-12 place-items-center rounded-xl bg-stone-100 text-sm font-semibold text-stone-600 sm:size-14">
              +{hiddenCount}
              <span className="sr-only"> more</span>
            </li>
          )}
        </ul>

        <div className="flex items-center gap-3 text-right">
          <div>
            <p className="text-sm text-stone-500">{pluralize(itemCount, 'item')}</p>
            <p className="text-lg font-bold text-stone-900">{formatPrice(order.totalPrice)}</p>
            <PaymentStatus order={order} className="block text-xs" />
          </div>
          <FiChevronRight className="size-5 text-stone-400" aria-hidden="true" />
        </div>
      </div>
    </article>
  )
}
