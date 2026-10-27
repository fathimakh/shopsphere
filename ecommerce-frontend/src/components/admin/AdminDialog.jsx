import { useEffect, useId, useRef } from 'react'
import { FiX } from 'react-icons/fi'

const SIZES = {
  md: 'w-[min(96vw,32rem)]',
  lg: 'w-[min(96vw,44rem)]',
}

/**
 * Modal shell for admin forms and detail views, built on the native <dialog> (focus trap, Esc and
 * backdrop for free). Header and footer stay put while the body scrolls on small screens.
 * Closing is blocked while `busy` so an in-flight save can't be abandoned half way.
 */
export default function AdminDialog({ open, title, description, onClose, busy = false, size = 'lg', footer, children }) {
  const dialogRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const requestClose = () => {
    if (!busy) onClose?.()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault()
        requestClose()
      }}
      className={`m-auto max-h-[92dvh] ${SIZES[size] ?? SIZES.lg} overflow-hidden rounded-2xl bg-white p-0 text-stone-800 shadow-2xl open:flex open:flex-col`}
    >
      <header className="flex items-start gap-3 border-b border-stone-200 px-5 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="mt-0.5 text-sm text-stone-600">
              {description}
            </p>
          )}
        </div>
        <button type="button" className="btn-icon -mr-2 -mt-1" onClick={requestClose} disabled={busy} aria-label="Close">
          <FiX className="size-5" aria-hidden="true" />
        </button>
      </header>
      {/* Mounted only while open so forms start fresh each time. */}
      {open && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>}
      {open && footer && (
        <footer className="flex flex-col-reverse gap-2 border-t border-stone-200 bg-stone-50/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          {footer}
        </footer>
      )}
    </dialog>
  )
}
