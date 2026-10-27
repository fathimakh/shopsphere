import axios, { AxiosError } from 'axios'

// Normalises API failures into UI-friendly messages (see docs/API_CONTRACT.md §2 for the
// error envelope: { success: false, message, code?, errors?: [{ field, message }] }).

const STATUS_MESSAGES = {
  400: 'The request was invalid. Please check your input.',
  401: 'Please log in to continue.',
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  409: 'That conflicts with the current data. Please refresh and try again.',
  429: 'Too many requests — please wait a moment and try again.',
  500: 'The server hit an unexpected error. Please try again shortly.',
  502: 'The server is unavailable right now — it may be restarting.',
  503: 'The server is unavailable right now — it may be restarting.',
}

/** Turns any thrown value (Axios error, Error, string) into a message fit for the UI. */
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback
  if (typeof error === 'string') return error
  if (!axios.isAxiosError(error)) return error.message || fallback
  if (axios.isCancel(error)) return 'The request was cancelled.'

  if (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT) {
    return 'The server took too long to respond — it may be waking up. Please try again in a few seconds.'
  }
  if (!error.response) {
    return navigator.onLine === false
      ? "You're offline. Check your internet connection and try again."
      : 'Cannot reach the ShopSphere server. Please check your connection and try again.'
  }

  const { status, data } = error.response
  const validationMessages = Array.isArray(data?.errors)
    ? data.errors.map((item) => item?.message).filter(Boolean)
    : []
  if (validationMessages.length) return validationMessages.join('. ')
  if (typeof data?.message === 'string' && data.message) return data.message
  return STATUS_MESSAGES[status] ?? fallback
}

/**
 * Maps server validation errors (`errors: [{ field, message }]`) to `{ field: message }`.
 * Nested paths such as "shippingAddress.city" or "images[0]" map to the form field name.
 */
export function getFieldErrors(error) {
  const items = error?.response?.data?.errors
  if (!Array.isArray(items)) return {}
  const fieldErrors = {}
  for (const { field, message } of items) {
    if (!field || !message) continue
    const name = String(field).split('.').pop().replace(/\[\d+\]$/, '')
    fieldErrors[name] ??= message
  }
  return fieldErrors
}

/** Serializable error payload used by every thunk's rejectWithValue. */
export function toApiError(error) {
  return {
    message: getErrorMessage(error),
    status: error?.response?.status ?? null,
    code: error?.response?.data?.code ?? null,
    fieldErrors: getFieldErrors(error),
  }
}
