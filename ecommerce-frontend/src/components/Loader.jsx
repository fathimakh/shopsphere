import { FiLoader } from 'react-icons/fi'

/** Spinner with an accessible status label. `fullPage` reserves space so layouts don't jump. */
export default function Loader({ label = 'Loading…', fullPage = false, className = '' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center gap-3 text-sm font-medium text-stone-500 ${
        fullPage ? 'min-h-[50vh]' : 'py-10'
      } ${className}`}
    >
      <FiLoader className="size-5 animate-spin text-brand-600" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
