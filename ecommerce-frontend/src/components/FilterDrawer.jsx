import { useEffect, useId, useRef } from 'react'
import { FiX } from 'react-icons/fi'

// Matches Tailwind's `lg` breakpoint, where the filters move into the sidebar.
const DESKTOP_QUERY = '(min-width: 64rem)'

/**
 * Slide-over panel for the filters on phones and tablets, built on the native modal <dialog>
 * (focus trap, Esc and inert background for free). Controlled through `open`/`onClose`.
 */
export default function FilterDrawer({ open, onClose, title = 'Filters', footer, children }) {
  const dialogRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // A modal dialog doesn't stop the page behind it from scrolling, so lock it while open.
  useEffect(() => {
    if (!open) return undefined
    const root = document.documentElement
    const previousOverflow = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = previousOverflow
    }
  }, [open])

  // The drawer only exists on small screens: close it if the window grows to the sidebar layout.
  useEffect(() => {
    if (!open) return undefined
    const media = window.matchMedia(DESKTOP_QUERY)
    const handleChange = (event) => {
      if (event.matches) onClose()
    }
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [open, onClose])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
      className="fixed inset-y-0 right-0 left-auto m-0 h-full max-h-full w-[min(88vw,22rem)] max-w-full overflow-hidden bg-white p-0 text-stone-800 shadow-2xl open:animate-slide-in-right"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-stone-200 py-2 pr-2 pl-5">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}>
            <FiX aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5">{children}</div>
        {footer && <div className="border-t border-stone-200 bg-white px-4 py-3">{footer}</div>}
      </div>
    </dialog>
  )
}
