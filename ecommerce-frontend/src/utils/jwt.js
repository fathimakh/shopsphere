// Client-side JWT helpers. These only *read* the token (to know when it expires);
// the signature is verified by the server on every request.

/** Decodes the payload of a JWT, or returns null when the token is malformed. */
export function decodeJwt(token) {
  if (typeof token !== 'string') return null
  const [, payload] = token.split('.')
  if (!payload) return null
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const json = decodeURIComponent(
      Array.from(atob(padded), (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

/** Expiry time in epoch milliseconds, or null if the token carries no `exp` claim. */
export function getTokenExpiry(token) {
  const exp = decodeJwt(token)?.exp
  return typeof exp === 'number' ? exp * 1000 : null
}

/** True when the token is malformed or its `exp` is in the past. */
export function isTokenExpired(token, now = Date.now()) {
  if (!decodeJwt(token)) return true
  const expiry = getTokenExpiry(token)
  return expiry !== null && expiry <= now
}
