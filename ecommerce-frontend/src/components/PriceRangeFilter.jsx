import { useId, useState } from 'react'

/**
 * Min/max price inputs applied together (on "Apply" or Enter) rather than per keystroke.
 * Drafts follow the URL whenever the applied range changes from outside (chips, back button).
 */
export default function PriceRangeFilter({ minPrice, maxPrice, onApply }) {
  const id = useId()
  const errorId = `${id}-error`
  const [draft, setDraft] = useState({ min: minPrice, max: maxPrice })
  const [applied, setApplied] = useState({ min: minPrice, max: maxPrice })
  const [error, setError] = useState('')

  if (applied.min !== minPrice || applied.max !== maxPrice) {
    setApplied({ min: minPrice, max: maxPrice })
    setDraft({ min: minPrice, max: maxPrice })
    setError('')
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const min = draft.min.trim()
    const max = draft.max.trim()
    if ((min && Number(min) < 0) || (max && Number(max) < 0)) {
      setError('Prices cannot be negative')
      return
    }
    if (min && max && Number(min) > Number(max)) {
      setError('Minimum price must not exceed the maximum')
      return
    }
    setError('')
    onApply({ minPrice: min && String(Number(min)), maxPrice: max && String(Number(max)) })
  }

  const inputProps = (field) => ({
    type: 'number',
    inputMode: 'numeric',
    min: 0,
    step: 1,
    value: draft[field],
    onChange: (event) => {
      setDraft((current) => ({ ...current, [field]: event.target.value }))
      if (error) setError('')
    },
    'aria-invalid': Boolean(error) || undefined,
    'aria-describedby': error ? errorId : undefined,
    className: 'input h-10 pl-7',
  })

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-min`} className="mb-1 block text-xs font-medium text-stone-600">
            Min
          </label>
          <div className="relative">
            <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-stone-400">
              ₹
            </span>
            <input id={`${id}-min`} placeholder="0" {...inputProps('min')} />
          </div>
        </div>
        <span aria-hidden="true" className="pb-2.5 text-stone-400">
          –
        </span>
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-max`} className="mb-1 block text-xs font-medium text-stone-600">
            Max
          </label>
          <div className="relative">
            <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-stone-400">
              ₹
            </span>
            <input id={`${id}-max`} placeholder="Any" {...inputProps('max')} />
          </div>
        </div>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-secondary mt-2.5 h-10 w-full">
        Apply price
      </button>
    </form>
  )
}
