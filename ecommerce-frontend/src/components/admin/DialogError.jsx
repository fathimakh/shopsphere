/** Error line shown inside a confirmation dialog so a failed action can be retried in place. */
export default function DialogError({ id, message }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      {message}
    </p>
  )
}
