import { useId } from 'react'
import { FiTruck } from 'react-icons/fi'
import { FREE_SHIPPING_THRESHOLD } from '../utils/constants'
import { formatPrice, pluralize } from '../utils/format'

/**
 * Price breakdown shared by the cart, checkout and order pages:
 * items subtotal, shipping (free from ₹999) and total. Actions go in `children`.
 * `showShippingHint` adds the "add ₹X more for free shipping" nudge with a progress bar.
 */
export default function OrderSummary({
  title = 'Order summary',
  itemCount,
  subtotal,
  shipping,
  total,
  showShippingHint = false,
  note,
  className = '',
  children,
}) {
  const titleId = useId()
  const amountToFreeShipping = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0)
  const progress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100)

  return (
    <section aria-labelledby={titleId} className={`card p-5 sm:p-6 ${className}`}>
      <h2 id={titleId} className="text-lg font-bold">
        {title}
      </h2>

      {showShippingHint && subtotal > 0 && (
        <div className="mt-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
          <p className="flex items-start gap-2">
            <FiTruck className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
            {amountToFreeShipping > 0 ? (
              <span>
                Add <strong>{formatPrice(amountToFreeShipping)}</strong> more for <strong>free shipping</strong>.
              </span>
            ) : (
              <span>
                You&apos;ve unlocked <strong>free shipping</strong>!
              </span>
            )}
          </p>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-100"
            role="progressbar"
            aria-label="Progress towards free shipping"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
          >
            <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <dl className="mt-4 space-y-2.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-stone-600">
            Subtotal{itemCount !== undefined && ` (${pluralize(itemCount, 'item')})`}
          </dt>
          <dd className="font-medium text-stone-900">{formatPrice(subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-stone-600">Shipping</dt>
          <dd className={shipping === 0 ? 'font-semibold text-emerald-700' : 'font-medium text-stone-900'}>
            {shipping === 0 ? 'Free' : formatPrice(shipping)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-stone-200 pt-3 text-base">
          <dt className="font-bold text-stone-900">Total</dt>
          <dd className="font-bold text-stone-900">{formatPrice(total)}</dd>
        </div>
      </dl>

      {note && <p className="mt-3 text-xs text-stone-500">{note}</p>}
      {children && <div className="mt-5 space-y-2.5">{children}</div>}
    </section>
  )
}
