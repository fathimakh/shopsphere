import { isTokenExpired } from '../utils/jwt'
import { sanitizeCartItems } from './slices/cartSlice'

// localStorage persistence for the auth session and the cart (docs/API_CONTRACT.md §6).
// Everything read back is untrusted: it may be missing, malformed, edited by hand or written
// by an older version of the app, so each loader shape-checks the data and falls back to empty.

export const AUTH_STORAGE_KEY = 'shopsphere_auth'
export const CART_STORAGE_KEY = 'shopsphere_cart'

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

function readJson(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or disabled (e.g. strict private mode): the app still works for this tab.
  }
}

function remove(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Same as above — nothing useful to do.
  }
}

/** `{ token, user }` from storage, or null when absent, malformed or already expired. */
export function loadAuth() {
  const data = readJson(AUTH_STORAGE_KEY)
  const valid =
    isPlainObject(data) &&
    typeof data.token === 'string' &&
    isPlainObject(data.user) &&
    typeof data.user._id === 'string' &&
    typeof data.user.email === 'string'

  if (!valid || isTokenExpired(data.token)) {
    if (data) remove(AUTH_STORAGE_KEY)
    return null
  }
  return { token: data.token, user: data.user }
}

export function saveAuth({ token, user }) {
  writeJson(AUTH_STORAGE_KEY, { token, user })
}

export function clearAuth() {
  remove(AUTH_STORAGE_KEY)
}

/** Cart lines from storage; invalid entries are dropped one by one instead of losing the cart. */
export function loadCart() {
  const data = readJson(CART_STORAGE_KEY)
  return Array.isArray(data) ? sanitizeCartItems(data) : []
}

export function saveCart(items) {
  if (items.length) writeJson(CART_STORAGE_KEY, items)
  else remove(CART_STORAGE_KEY)
}
