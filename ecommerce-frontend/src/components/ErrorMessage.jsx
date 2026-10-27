import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi'

/** Inline error panel for failed API calls, with an optional "Try again" action. */
export default function ErrorMessage({ title = 'Something went wrong', message, onRetry, className = '' }) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center ${className}`}
    >
      <FiAlertTriangle className="size-5 shrink-0 text-red-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {message && <p className="mt-0.5 break-words text-red-700">{message}</p>}
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-sm btn-secondary">
          <FiRefreshCw aria-hidden="true" /> Try again
        </button>
      )}
    </div>
  )
}
