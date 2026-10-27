import { FiEdit3, FiTrash2 } from 'react-icons/fi'
import AdminDialog from './AdminDialog'
import ErrorMessage from '../ErrorMessage'
import Loader from '../Loader'
import AdminThumbnail from './AdminThumbnail'
import StatusBadge from '../StatusBadge'
import { NEXT_ORDER_STATUSES, PAYMENT_METHODS } from '../../utils/constants'
import { formatDateTime, formatPrice, pluralize, shortId } from '../../utils/format'

const paymentLabel = (method) => PAYMENT_METHODS.find((option) => option.value === method)?.label ?? method

function Section({ title, children }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">{title}</h3>
      {children}
    </section>
  )
}

function OrderDetails({ order }) {
  const address = order.shippingAddress ?? {}
  const history = [...(order.statusHistory ?? [])].reverse()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-600">
        <StatusBadge status={order.status} />
        <span>Placed {formatDateTime(order.createdAt)}</span>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Customer">
          <p className="font-semibold text-stone-900">{order.user?.name ?? 'Unknown customer'}</p>
          {order.user?.email && (
            <a href={`mailto:${order.user.email}`} className="link text-sm break-all">
              {order.user.email}
            </a>
          )}
        </Section>
        <Section title="Shipping address">
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
                <span className="text-stone-500">Phone:</span> {address.phone}
              </>
            )}
          </address>
        </Section>
      </div>

      <Section title={pluralize(order.orderItems?.length ?? 0, 'item')}>
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
          {(order.orderItems ?? []).map((item, index) => (
            <li key={`${item.product}-${index}`} className="flex items-center gap-3 p-3">
              <AdminThumbnail src={item.image} className="size-12" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-stone-900">{item.name}</p>
                <p className="text-xs text-stone-500">
                  {item.quantity} × {formatPrice(item.price)}
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums">{formatPrice(item.price * item.quantity)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-600">Items</dt>
            <dd className="tabular-nums">{formatPrice(order.itemsPrice)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-600">Shipping</dt>
            <dd className="tabular-nums">{order.shippingPrice ? formatPrice(order.shippingPrice) : 'Free'}</dd>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-2 font-bold text-stone-900">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatPrice(order.totalPrice)}</dd>
          </div>
        </dl>
      </Section>

      <Section title="Payment">
        <p className="text-sm text-stone-700">
          {paymentLabel(order.paymentMethod)} ·{' '}
          {order.isPaid ? (
            <span className="font-semibold text-emerald-700">Paid {formatDateTime(order.paidAt)}</span>
          ) : (
            <span className="font-semibold text-amber-700">Not paid yet</span>
          )}
        </p>
        {order.paymentResult?.reference && (
          <p className="mt-0.5 text-xs text-stone-500">Reference {order.paymentResult.reference}</p>
        )}
      </Section>

      <Section title="Status history">
        <ol className="space-y-3 border-l-2 border-stone-200 pl-4">
          {history.map((entry, index) => (
            <li key={`${entry.status}-${entry.at}-${index}`} className="relative">
              <span
                className="absolute top-1.5 -left-[1.3125rem] size-2.5 rounded-full bg-brand-600 ring-4 ring-white"
                aria-hidden="true"
              />
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={entry.status} />
                <time dateTime={entry.at} className="text-xs text-stone-500">
                  {formatDateTime(entry.at)}
                </time>
              </div>
              {entry.note && <p className="mt-1 text-sm text-stone-700">{entry.note}</p>}
            </li>
          ))}
        </ol>
      </Section>
    </div>
  )
}

/**
 * Read-only order view for admins (items, totals, address, payment, history) with shortcuts to
 * the status update and delete actions. `order` may still be loading when opened from a link.
 */
export default function OrderDetailDialog({ orderId, order, status, error, onRetry, onClose, onUpdateStatus, onDelete }) {
  const canUpdate = Boolean(order && NEXT_ORDER_STATUSES[order.status]?.length)

  return (
    <AdminDialog
      open
      title={`Order ${shortId(orderId)}`}
      onClose={onClose}
      footer={
        order && (
          <>
            <button type="button" className="btn btn-secondary text-red-700" onClick={() => onDelete(order)}>
              <FiTrash2 aria-hidden="true" /> Delete
            </button>
            {canUpdate && (
              <button type="button" className="btn btn-primary" onClick={() => onUpdateStatus(order)}>
                <FiEdit3 aria-hidden="true" /> Update status
              </button>
            )}
          </>
        )
      }
    >
      {order ? (
        <OrderDetails order={order} />
      ) : status === 'failed' ? (
        <ErrorMessage title="Couldn't load this order" message={error?.message} onRetry={onRetry} />
      ) : (
        <Loader label="Loading order…" />
      )}
    </AdminDialog>
  )
}
