import { discountPercent, formatPrice } from '../utils/format'

const SIZES = {
  sm: { price: 'text-base', mrp: 'text-xs', off: 'text-xs' },
  lg: { price: 'text-3xl', mrp: 'text-base', off: 'text-sm' },
}

/** Selling price, struck-through MRP and "% off" — shown only when there is a real markdown. */
export default function PriceTag({ price, mrp, size = 'sm', className = '' }) {
  const discount = discountPercent(price, mrp)
  const styles = SIZES[size] ?? SIZES.sm

  return (
    <p className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${className}`}>
      <span className={`${styles.price} font-bold text-stone-900 tabular-nums`}>
        <span className="sr-only">Price </span>
        {formatPrice(price)}
      </span>
      {discount > 0 && (
        <>
          <span className={`${styles.mrp} text-stone-500 tabular-nums`}>
            <span className="sr-only">MRP </span>
            <s>{formatPrice(mrp)}</s>
          </span>
          <span className={`${styles.off} font-bold text-emerald-700`}>{discount}% off</span>
        </>
      )}
    </p>
  )
}
