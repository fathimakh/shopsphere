import { useSyncExternalStore } from 'react'
import { FiLoader } from 'react-icons/fi'
import { getIsServerWaking, subscribeServerStatus } from '../api/serverStatus'

/**
 * Floating notice shown while API requests are unusually slow — typically the free hosting
 * tier booting the sleeping API. Fixed to the bottom so it never shifts the page layout.
 */
export default function ServerStatusBanner() {
  const waking = useSyncExternalStore(subscribeServerStatus, getIsServerWaking)

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-5 sm:bottom-5">
      {waking && (
        <div className="pointer-events-auto flex max-w-sm animate-fade-in items-start gap-3 rounded-2xl border border-accent-200 bg-white p-4 shadow-xl">
          <FiLoader className="mt-0.5 size-5 shrink-0 animate-spin text-accent-600" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-stone-900">Waking up the server…</p>
            <p className="mt-0.5 text-stone-600">
              Our free-tier API sleeps when idle, so the first request can take up to a minute. Thanks for waiting!
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
