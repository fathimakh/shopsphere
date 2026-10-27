// Tracks in-flight API requests so the UI can tell users when the server is slow to answer.
// Free Render instances sleep when idle and need ~30–60 s to boot, so any request still
// pending after SLOW_REQUEST_MS flips `isServerWaking` to true until the slow ones settle.
// Exposed as a tiny external store for React's useSyncExternalStore.

const SLOW_REQUEST_MS = 4000
// Safety net: forget a slow request after this long even if its end was never reported,
// so the banner can never get stuck (axios itself times out after 20 s).
const MAX_TRACK_MS = 30000

const slowTimers = new Map() // requestId -> timeout handle
const slowRequests = new Set() // requestIds that have crossed the threshold
const listeners = new Set()
let nextRequestId = 0
let isServerWaking = false

function emitIfChanged() {
  const waking = slowRequests.size > 0
  if (waking === isServerWaking) return
  isServerWaking = waking
  listeners.forEach((listener) => listener())
}

/** Called by the request interceptor; returns an id to pass to `trackRequestEnd`. */
export function trackRequestStart() {
  const id = ++nextRequestId
  slowTimers.set(
    id,
    setTimeout(() => {
      slowRequests.add(id)
      slowTimers.set(
        id,
        setTimeout(() => trackRequestEnd(id), MAX_TRACK_MS),
      )
      emitIfChanged()
    }, SLOW_REQUEST_MS),
  )
  return id
}

/** Called by the response interceptor for both successes and failures. */
export function trackRequestEnd(id) {
  if (id === undefined) return
  clearTimeout(slowTimers.get(id))
  slowTimers.delete(id)
  slowRequests.delete(id)
  emitIfChanged()
}

export function subscribeServerStatus(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getIsServerWaking() {
  return isServerWaking
}
