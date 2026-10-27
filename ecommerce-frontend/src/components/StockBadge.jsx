import { FiAlertCircle, FiCheckCircle, FiXCircle } from 'react-icons/fi'

/** At or below this many units we nudge shoppers with "Only N left". */
const LOW_STOCK_THRESHOLD = 5

/**
 * Stock hint for a product. `compact` (cards) stays quiet while stock is healthy;
 * the full variant (product page) always says whether the item is available.
 */
export default function StockBadge({ stock = 0, compact = false, className = '' }) {
  if (stock <= 0) {
    return (
      <p className={`flex items-center gap-1 text-xs font-semibold text-red-700 ${className}`}>
        <FiXCircle aria-hidden="true" className="shrink-0" /> Out of stock
      </p>
    )
  }
  if (stock <= LOW_STOCK_THRESHOLD) {
    return (
      <p className={`flex items-center gap-1 text-xs font-semibold text-amber-700 ${className}`}>
        <FiAlertCircle aria-hidden="true" className="shrink-0" /> Only {stock} left
      </p>
    )
  }
  if (compact) return null
  return (
    <p className={`flex items-center gap-1 text-xs font-semibold text-emerald-700 ${className}`}>
      <FiCheckCircle aria-hidden="true" className="shrink-0" /> In stock
    </p>
  )
}
