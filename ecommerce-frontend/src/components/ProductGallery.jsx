import { useRef, useState } from 'react'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import ProductImage from './ProductImage'

/**
 * Main product image with a thumbnail strip. Thumbnails use a roving tabindex: Tab reaches
 * the strip once, then arrow keys / Home / End move between images. Remount it (key = product
 * id) when the product changes so the selection starts at the first image again.
 */
export default function ProductGallery({ images = [], name }) {
  const [active, setActive] = useState(0)
  const thumbRefs = useRef([])
  const sources = images.length ? images : [null]
  const count = sources.length
  const hasMany = count > 1

  const show = (index, { focus = false } = {}) => {
    const next = (index + count) % count
    setActive(next)
    if (focus) thumbRefs.current[next]?.focus()
  }

  const handleThumbKeyDown = (event) => {
    const moves = {
      ArrowRight: active + 1,
      ArrowDown: active + 1,
      ArrowLeft: active - 1,
      ArrowUp: active - 1,
      Home: 0,
      End: count - 1,
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    show(moves[event.key], { focus: true })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="card group relative aspect-square overflow-hidden bg-white">
        <ProductImage
          key={sources[active] ?? 'placeholder'}
          src={sources[active]}
          alt={hasMany ? `${name}, image ${active + 1} of ${count}` : name}
          loading="eager"
          className="size-full animate-fade-in object-contain p-6 sm:p-10"
        />
        {hasMany && (
          <>
            <button
              type="button"
              onClick={() => show(active - 1)}
              className="btn-icon absolute top-1/2 left-2 -translate-y-1/2 bg-white/90 shadow-md ring-1 ring-stone-200 hover:bg-white"
              aria-label="Previous image"
            >
              <FiChevronLeft aria-hidden="true" className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => show(active + 1)}
              className="btn-icon absolute top-1/2 right-2 -translate-y-1/2 bg-white/90 shadow-md ring-1 ring-stone-200 hover:bg-white"
              aria-label="Next image"
            >
              <FiChevronRight aria-hidden="true" className="size-5" />
            </button>
            <span className="badge absolute right-3 bottom-3 bg-stone-900/70 text-white" aria-hidden="true">
              {active + 1} / {count}
            </span>
          </>
        )}
      </div>

      {hasMany && (
        <div role="group" aria-label="Product images" className="scroll-x flex gap-2 pb-1" onKeyDown={handleThumbKeyDown}>
          {sources.map((src, index) => (
            <button
              key={`${src}-${index}`}
              ref={(element) => {
                thumbRefs.current[index] = element
              }}
              type="button"
              tabIndex={index === active ? 0 : -1}
              onClick={() => show(index)}
              aria-label={`Show image ${index + 1} of ${count}`}
              aria-pressed={index === active}
              className={`size-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white p-1 transition-colors sm:size-20 ${
                index === active ? 'border-brand-600' : 'border-stone-200 hover:border-stone-400'
              }`}
            >
              <ProductImage src={src} className="size-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
