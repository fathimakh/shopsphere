import placeholder from '../../assets/placeholder-product.svg'

/** Swaps a broken image for the bundled placeholder (once, so it can never loop). */
function showPlaceholder(event) {
  const image = event.currentTarget
  if (image.dataset.fallback) return
  image.dataset.fallback = 'true'
  image.src = placeholder
}

/** Small square product image for admin lists and previews. Decorative unless `alt` is given. */
export default function AdminThumbnail({ src, alt = '', className = 'size-12' }) {
  return (
    <img
      src={src || placeholder}
      alt={alt}
      onError={showPlaceholder}
      loading="lazy"
      decoding="async"
      className={`shrink-0 rounded-xl border border-stone-200 bg-stone-100 object-cover ${className}`}
    />
  )
}
