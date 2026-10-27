import { useState } from 'react'
import { FiMinus, FiPlus } from 'react-icons/fi'

const SIZES = {
  md: { button: 'size-11', input: 'h-11 w-12 text-base' },
  sm: { button: 'size-10', input: 'h-10 w-10 text-sm' },
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

/**
 * − [n] + quantity control. The number can also be typed; the draft is committed (and clamped
 * to min…max) on blur or Enter, so half-typed values never reach the cart.
 * `max` < `min` (e.g. out of stock) disables the whole control.
 */
export default function QuantityStepper({
  value,
  min = 1,
  max = Infinity,
  onChange,
  size = 'md',
  label = 'Quantity',
  disabled = false,
  className = '',
}) {
  // Holds what the user is typing; null means "show the committed value".
  const [draft, setDraft] = useState(null)
  const styles = SIZES[size] ?? SIZES.md
  const isDisabled = disabled || max < min

  const commit = (next) => {
    setDraft(null)
    const parsed = Math.trunc(Number(next))
    if (!Number.isFinite(parsed) || isDisabled) return
    const clamped = clamp(parsed, min, max)
    if (clamped !== value) onChange(clamped)
  }

  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex items-center rounded-xl border border-stone-300 bg-white ${
        isDisabled ? 'opacity-60' : ''
      } ${className}`}
    >
      <button
        type="button"
        className={`${styles.button} grid place-items-center rounded-l-xl text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent`}
        onClick={() => commit(value - 1)}
        disabled={isDisabled || value <= min}
        aria-label="Decrease quantity"
      >
        <FiMinus aria-hidden="true" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={Number.isFinite(max) ? max : undefined}
        value={draft ?? value}
        disabled={isDisabled}
        aria-label={label}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit(event.currentTarget.value)
          }
        }}
        className={`${styles.input} border-x border-stone-200 bg-transparent text-center font-semibold text-stone-900 tabular-nums [appearance:textfield] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-inset [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />
      <button
        type="button"
        className={`${styles.button} grid place-items-center rounded-r-xl text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent`}
        onClick={() => commit(value + 1)}
        disabled={isDisabled || value >= max}
        aria-label="Increase quantity"
      >
        <FiPlus aria-hidden="true" />
      </button>
    </div>
  )
}
