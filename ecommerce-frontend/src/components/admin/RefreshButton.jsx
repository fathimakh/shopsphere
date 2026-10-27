import { FiRefreshCw } from 'react-icons/fi'

/** "Refresh" button for admin lists; the icon spins while a reload is in flight. */
export default function RefreshButton({ onClick, loading = false, label = 'Refresh' }) {
  return (
    <button type="button" className="btn btn-secondary" onClick={onClick} disabled={loading}>
      <FiRefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
      {label}
    </button>
  )
}
