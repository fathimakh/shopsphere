import { useCallback, useEffect, useState } from 'react'
import api, { toApiError } from '../api/axiosInstance'

/** Drops empty filters so URLs stay clean (`?status=` would be rejected by some endpoints). */
function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

/**
 * Page-local server state for the admin screens: GET `path` with `params`, re-fetching whenever
 * either changes or `reload()` is called. Redux is kept for global state (auth, cart, catalogue).
 *
 *  - Superseded requests are aborted, and a response is only applied while its request is current,
 *    so a slow page-1 response can never overwrite page 2.
 *  - `data` is the full response body and is kept while a refetch runs, so lists don't flash empty.
 *  - `setData(updater)` patches the cached body after a mutation without a round trip.
 *
 * Returns { data, status: 'idle'|'loading'|'succeeded'|'failed', error: { message, … } | null, reload, setData }.
 */
export default function useAdminResource(path, { params, enabled = true } = {}) {
  const [reloadCount, setReloadCount] = useState(0)
  const [result, setResult] = useState({ key: null, data: undefined, error: null })

  const paramsKey = JSON.stringify(cleanParams(params))
  const requestKey = enabled && path ? `${path}?${paramsKey}#${reloadCount}` : null

  useEffect(() => {
    if (!requestKey) return undefined
    const controller = new AbortController()

    api
      .get(path, { params: JSON.parse(paramsKey), signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, data, error: null })
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setResult((previous) => ({ key: requestKey, data: previous.data, error: toApiError(error) }))
      })

    return () => controller.abort()
  }, [path, paramsKey, requestKey])

  // Status is derived rather than stored, so a new request key reads as "loading" immediately.
  let status = 'idle'
  if (requestKey) {
    if (result.key !== requestKey) status = 'loading'
    else status = result.error ? 'failed' : 'succeeded'
  }

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  const setData = useCallback((updater) => {
    setResult((previous) => ({
      ...previous,
      data: typeof updater === 'function' ? updater(previous.data) : updater,
    }))
  }, [])

  return {
    data: result.data,
    status,
    error: status === 'failed' ? result.error : null,
    reload,
    setData,
  }
}
