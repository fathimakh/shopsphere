import { FiAlertCircle } from 'react-icons/fi'

/**
 * Label + control + inline error. The control itself (input/textarea/select) is passed as
 * children and must carry the matching `id`, `aria-invalid` and `aria-describedby`
 * (useValidatedForm's getFieldProps provides all three).
 */
export default function FormField({ label, htmlFor, error, errorId, optional = false, aside, className = '', children }) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="label">
          {label}
          {optional && <span className="ml-1 font-normal text-stone-500">(optional)</span>}
        </label>
        {aside}
      </div>
      {children}
      {error && (
        <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-sm text-red-700">
          <FiAlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
