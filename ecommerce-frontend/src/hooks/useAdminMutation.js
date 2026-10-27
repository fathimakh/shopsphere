import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import { toApiError } from '../api/axiosInstance'

/**
 * Runs admin write requests (create / update / delete) and tracks which one is in flight.
 *
 *   const { run, pendingKey, error, resetError } = useAdminMutation()
 *   const { ok, data } = await run(`delete:${id}`, () => api.delete(`/products/${id}`), {
 *     successMessage: 'Product deleted',
 *   })
 *
 * `run` never throws: it resolves to { ok, data, error }. Errors are kept in `error` (tagged with
 * the action key) so dialogs can show them inline; the caller decides whether to toast them.
 */
export default function useAdminMutation() {
  const [pendingKey, setPendingKey] = useState(null)
  const [error, setError] = useState(null)

  const run = useCallback(async (key, request, { successMessage } = {}) => {
    setPendingKey(key)
    setError(null)
    try {
      const { data } = await request()
      if (successMessage) toast.success(typeof successMessage === 'function' ? successMessage(data) : successMessage)
      return { ok: true, data, error: null }
    } catch (err) {
      const apiError = { key, ...toApiError(err) }
      setError(apiError)
      return { ok: false, data: null, error: apiError }
    } finally {
      setPendingKey(null)
    }
  }, [])

  const resetError = useCallback(() => setError(null), [])

  return { run, pendingKey, isPending: pendingKey !== null, error, resetError }
}
