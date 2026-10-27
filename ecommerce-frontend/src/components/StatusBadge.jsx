// Order statuses (pending → delivered / cancelled) and contact-message statuses (new / read / resolved).
const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  processing: 'bg-sky-100 text-sky-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-stone-200 text-stone-700',
  new: 'bg-accent-100 text-accent-800',
  read: 'bg-sky-100 text-sky-800',
  resolved: 'bg-emerald-100 text-emerald-800',
}

export default function StatusBadge({ status, className = '' }) {
  return (
    <span className={`badge capitalize ${STATUS_STYLES[status] ?? 'bg-stone-100 text-stone-700'} ${className}`}>
      {status}
    </span>
  )
}
