// Display helpers shared across the app. Formatters are created once and reused.

const priceFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const compactFormatter = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 })

/** 1499 → "₹1,499" */
export function formatPrice(amount) {
  return priceFormatter.format(Number(amount) || 0)
}

/** 1234567 → "12.3L" style compact number for dashboard cards. */
export function formatCompact(value) {
  return compactFormatter.format(Number(value) || 0)
}

function toValidDate(value) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

/** ISO string → "27 Oct 2026" (empty string for missing/invalid dates). */
export function formatDate(value) {
  const date = toValidDate(value)
  return date ? dateFormatter.format(date) : ''
}

/** ISO string → "27 Oct 2026, 8:41 pm" */
export function formatDateTime(value) {
  const date = toValidDate(value)
  return date ? dateTimeFormatter.format(date) : ''
}

/** Category slugs are lowercase ("mens-shirts"); show them as "Mens Shirts". */
export function formatCategory(slug = '') {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** Whole-number discount percentage, or 0 when there is no real markdown. */
export function discountPercent(price, mrp) {
  if (!mrp || !price || mrp <= price) return 0
  return Math.round(((mrp - price) / mrp) * 100)
}

/** Human-friendly order reference: last 8 characters of the Mongo id. */
export function shortId(id = '') {
  return `#${String(id).slice(-8).toUpperCase()}`
}

/** "Asha Nair" → "AN" for avatar bubbles. */
export function initials(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || '?'
  )
}

/** 1 → "1 item", 3 → "3 items" */
export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}
