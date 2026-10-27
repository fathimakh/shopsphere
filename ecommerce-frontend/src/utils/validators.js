// Client-side form validation. Limits mirror the server rules in docs/API_CONTRACT.md so
// users see the same message before and after a round-trip. Every validator takes the
// form values and returns `{ field: message }` for invalid fields only (empty object = valid).

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
// Same shape as the API's rule: optional +, digits separated by spaces or dashes.
const PHONE_PATTERN = /^\+?\d[\d\s-]{5,18}\d$/
const POSTAL_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\s-]{2,9}$/
const HTTP_URL_PATTERN = /^https?:\/\/[^\s]+$/i

export const LIMITS = {
  name: { min: 2, max: 50 },
  contactName: { min: 2, max: 60 },
  subject: { min: 3, max: 120 },
  message: { min: 10, max: 2000 },
  password: { min: 8 },
  productName: { min: 2, max: 120 },
  description: { min: 10, max: 2000 },
  review: { min: 3, max: 1000 },
  street: { min: 3, max: 120 },
  addressPart: { min: 2, max: 60 },
}

const trimmed = (value) => String(value ?? '').trim()

/** Drops passing rules so callers can check `Object.keys(errors).length`. */
const collect = (errors) => Object.fromEntries(Object.entries(errors).filter(([, message]) => message))

function text(value, label, { min, max, required = true } = {}) {
  const str = trimmed(value)
  if (!str) return required ? `${label} is required` : undefined
  if (min && str.length < min) return `${label} must be at least ${min} characters`
  if (max && str.length > max) return `${label} must be ${max} characters or fewer`
  return undefined
}

function email(value) {
  const str = trimmed(value)
  if (!str) return 'Email is required'
  return EMAIL_PATTERN.test(str) ? undefined : 'Enter a valid email address'
}

function password(value, label = 'Password') {
  if (!value) return `${label} is required`
  if (value.length < LIMITS.password.min) return `${label} must be at least ${LIMITS.password.min} characters`
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return `${label} must include a letter and a number`
  return undefined
}

function phone(value, { required = true } = {}) {
  const str = trimmed(value)
  if (!str) return required ? 'Phone number is required' : undefined
  const digits = str.replace(/\D/g, '').length
  return PHONE_PATTERN.test(str) && digits >= 7 && digits <= 15 ? undefined : 'Enter a valid phone number'
}

function postalCode(value, { required = true } = {}) {
  const str = trimmed(value)
  if (!str) return required ? 'PIN / postal code is required' : undefined
  return POSTAL_CODE_PATTERN.test(str) ? undefined : 'Enter a valid PIN / postal code'
}

function confirmation(value, original) {
  if (!value) return 'Please confirm the password'
  return value === original ? undefined : 'Passwords do not match'
}

function number(value, label, { min = 0, integer = false, required = true } = {}) {
  if (trimmed(value) === '') return required ? `${label} is required` : undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return `${label} must be a number`
  if (integer && !Number.isInteger(parsed)) return `${label} must be a whole number`
  if (parsed < min) return `${label} must be ${min} or more`
  return undefined
}

export function validateLogin(values) {
  return collect({
    email: email(values.email),
    password: values.password ? undefined : 'Password is required',
  })
}

export function validateRegister(values) {
  return collect({
    name: text(values.name, 'Name', LIMITS.name),
    email: email(values.email),
    password: password(values.password),
    confirmPassword: confirmation(values.confirmPassword, values.password),
  })
}

export function validateContact(values) {
  return collect({
    name: text(values.name, 'Name', LIMITS.contactName),
    email: email(values.email),
    subject: text(values.subject, 'Subject', LIMITS.subject),
    message: text(values.message, 'Message', LIMITS.message),
  })
}

/** Checkout shipping address — every field except country is required by the API. */
export function validateShippingAddress(values) {
  return collect({
    fullName: text(values.fullName, 'Full name', LIMITS.contactName),
    phone: phone(values.phone),
    street: text(values.street, 'Street address', LIMITS.street),
    city: text(values.city, 'City', LIMITS.addressPart),
    state: text(values.state, 'State', LIMITS.addressPart),
    postalCode: postalCode(values.postalCode),
    country: text(values.country, 'Country', LIMITS.addressPart),
  })
}

/** Profile details — contact and address fields are optional but must be valid when present. */
export function validateProfile(values) {
  const optional = (value, label, limits) => text(value, label, { ...limits, required: false })
  return collect({
    name: text(values.name, 'Name', LIMITS.name),
    email: email(values.email),
    phone: phone(values.phone, { required: false }),
    street: optional(values.street, 'Street address', LIMITS.street),
    city: optional(values.city, 'City', LIMITS.addressPart),
    state: optional(values.state, 'State', LIMITS.addressPart),
    postalCode: postalCode(values.postalCode, { required: false }),
    country: optional(values.country, 'Country', LIMITS.addressPart),
  })
}

export function validatePasswordChange(values) {
  const newPassword =
    password(values.newPassword, 'New password') ??
    (values.newPassword === values.currentPassword ? 'New password must differ from the current one' : undefined)
  return collect({
    currentPassword: values.currentPassword ? undefined : 'Current password is required',
    newPassword,
    confirmPassword: confirmation(values.confirmPassword, values.newPassword),
  })
}

export function validateReview(values) {
  const rating = Number(values.rating)
  return collect({
    rating: rating >= 1 && rating <= 5 ? undefined : 'Choose a rating from 1 to 5 stars',
    comment: text(values.comment, 'Review', LIMITS.review),
  })
}

/** Splits the "one URL per line" textarea used by the admin product form. */
export function parseImageList(value) {
  return String(value ?? '')
    .split(/[\n,]+/)
    .map((url) => url.trim())
    .filter(Boolean)
}

export function validateProduct(values) {
  const images = parseImageList(values.images)
  const invalidImage = images.find((url) => !HTTP_URL_PATTERN.test(url))
  const priceError = number(values.price, 'Price')
  let mrpError = number(values.mrp, 'MRP', { required: false })
  if (!mrpError && !priceError && trimmed(values.mrp) !== '' && Number(values.mrp) < Number(values.price)) {
    mrpError = 'MRP cannot be lower than the selling price'
  }
  return collect({
    name: text(values.name, 'Name', LIMITS.productName),
    description: text(values.description, 'Description', LIMITS.description),
    price: priceError,
    mrp: mrpError,
    category: text(values.category, 'Category', { max: 60 }),
    stock: number(values.stock, 'Stock', { integer: true }),
    images: invalidImage ? `"${invalidImage}" is not a valid http(s) URL` : undefined,
    thumbnail:
      trimmed(values.thumbnail) && !HTTP_URL_PATTERN.test(trimmed(values.thumbnail))
        ? 'Thumbnail must be an http(s) URL'
        : undefined,
  })
}
