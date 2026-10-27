import placeholder from '../assets/placeholder-product.svg'

/** Swaps a broken image for the local placeholder (once, so a broken placeholder can't loop). */
function showPlaceholder(event) {
  const image = event.currentTarget
  if (image.dataset.fallback) return
  image.dataset.fallback = 'true'
  image.src = placeholder
}

/**
 * Product photo that never renders as a broken icon: a missing `src` or a failed download
 * (hot-linked CDN images can disappear) falls back to the bundled placeholder.
 * Lazy-loaded by default; pass loading="eager" for above-the-fold images.
 */
export default function ProductImage({ src, alt = '', loading = 'lazy', className = '', ...props }) {
  return (
    <img
      src={src || placeholder}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={showPlaceholder}
      className={className}
      {...props}
    />
  )
}
